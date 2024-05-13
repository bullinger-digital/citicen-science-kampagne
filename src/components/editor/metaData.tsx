import React from "react";
import { InfoIcon } from "../common/info";
import { useServerFetch } from "../common/serverActions";
import { orgNameByRef, personById } from "@/lib/actions/citizen";
import { xmlParseFromString } from "@/lib/xmlSerialize";

export const LetterMetaData = ({
  letterId,
  xml,
}: {
  letterId: number;
  xml: Document;
}) => {
  return <LetterMetaDataInternal letterId={letterId} xml={xml} />;
};

const LetterMetaDataInternal = ({
  letterId,
  xml,
}: {
  letterId: number;
  xml: Document;
}) => {
  const senderNode = xml.querySelector(
    "TEI > teiHeader > profileDesc > correspDesc > correspAction[type='sent']"
  );
  const recipientNode = xml.querySelector(
    "TEI > teiHeader > profileDesc > correspDesc > correspAction[type='received']"
  );
  const dateNode = senderNode?.querySelector(":scope > date");
  const placeNode = senderNode?.querySelector(":scope > placeName");

  return (
    <div className="pr-4 mb-4 flex justify-between">
      <div>
        <div>
          {senderNode && (
            <span className="text-emerald-500 font-bold">
              <RenderCorrespondents correspActionNode={senderNode} />
            </span>
          )}{" "}
          an{" "}
          {recipientNode && (
            <span className="text-emerald-500 font-bold">
              <RenderCorrespondents correspActionNode={recipientNode} />
            </span>
          )}
        </div>
        <div>
          {dateNode && (
            <>
              <RenderDate dateNode={dateNode} />
            </>
          )}
          , {placeNode ? <span>{placeNode.textContent}</span> : "[...]"}
        </div>
      </div>
      <div className="text-right">
        Brief {letterId}
        <br />
        <a
          target="_blank"
          className=" text-emerald-400"
          href={`https://tei.bullinger-digital.ch/file${letterId}`}
        >
          Im TEI-Publisher ansehen
        </a>
      </div>
    </div>
  );
};

const directTextContent = (node: Element) => {
  return Array.from(node.childNodes).reduce(function (a, b) {
    return a + (b.nodeType === 3 ? b.textContent : "");
  }, "");
};

const RenderCorrespondents = ({
  correspActionNode,
}: {
  correspActionNode: Element;
}) => {
  // Inside the correspActionNode, we can have a variety of child node
  // 1. one or multiple persName nodes, which can contain text and/or a ref attribute
  // 2. one or multiple roleName nodes, which can contain text and/or a ref attribute
  const targets = Array.from(
    correspActionNode.querySelectorAll(":scope > persName, :scope > orgName")
  );

  return targets.length === 0
    ? "[...]"
    : targets.map((node, i) => (
        <span key={i}>
          <RenderSingleCorrespondent
            persNameOrOrgNameNode={node as Element}
            key={i}
          />
          {targets.indexOf(node) < targets.length - 1 && ", "}
        </span>
      ));
};

const RenderSingleCorrespondent = ({
  persNameOrOrgNameNode,
}: {
  persNameOrOrgNameNode: Element;
}) => {
  const type = persNameOrOrgNameNode.nodeName;
  switch (type) {
    case "persName":
      return <RenderSinglePerson personNode={persNameOrOrgNameNode} />;
    case "orgName":
      return <RenderSingleOrg orgNode={persNameOrOrgNameNode} />;
    default:
      console.error(`Rendering correspondents: Unknown node type: ${type}`);
      return "(Fehler)";
  }
};

const RenderSingleOrg = ({ orgNode }: { orgNode: Element }) => {
  const ref = orgNode.getAttribute("ref");
  const text = directTextContent(orgNode);

  const { loading, data } = useServerFetch(
    orgNameByRef,
    { ref: ref! },
    { skip: !!text || !ref }
  );

  const orgName = data?.xml
    ? xmlParseFromString(data?.xml).querySelector("orgName")?.textContent
    : null;

  if (text) return <span>{text}</span>;
  else return <span>{orgName}</span>;
};

const RenderSinglePerson = ({ personNode }: { personNode: Element }) => {
  const ref = personNode.getAttribute("ref")?.replace("p", "");
  const { loading, data } = useServerFetch(
    personById,
    { id: ref! },
    { skip: !ref }
  );
  // Todo: Reuse code from properties.tsx
  const mainAlias = data?.aliases.find((a) => a.type === "main");
  return (
    <>
      {mainAlias?.forename} {mainAlias?.surname}
    </>
  );
};

const RenderDate = ({ dateNode }: { dateNode: Element }) => {
  const dateNote = dateNode.querySelector("note");
  const dateText = dateAsString(dateNode);
  return (
    <>
      <span>{dateText}</span>
      {dateNote?.textContent && <InfoIcon content={dateNote.textContent} />}
    </>
  );
};

const dateAsString = (dateNode: Element) => {
  const dateText = directTextContent(dateNode);
  if (dateText) {
    return dateText;
  }

  // Otherwise, we either have a when, notBefore, notAfter, or both notBefore and notAfter attribute
  const when = dateNode.getAttribute("when");
  const notBefore = dateNode.getAttribute("notBefore");
  const notAfter = dateNode.getAttribute("notAfter");

  // If we have a when attribute, render it
  if (when) {
    return singleDate(when);
  }

  // If we have a notBefore and notAfter attribute, render both
  if (notBefore && notAfter) {
    return `Zwischen ${singleDate(notBefore)} und ${singleDate(notAfter)}`;
  }

  // If we have a notBefore attribute only, render it
  if (notBefore) {
    return `Nach ${singleDate(notBefore)}`;
  }

  // If we have a notAfter attribute only, render it
  if (notAfter) {
    return `Vor ${singleDate(notAfter)}`;
  }
};

const singleDate = (date: string) => {
  // A date string can contain a date in the format YYYY-MM-DD whereby the month and day are optional
  const dateParts = date.split("-");
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2] ? dateParts[2].replace(/^0+/g, "") : null;

  // Derive month name from month number by converting the date to a Date object
  const dateObj = new Date(date);
  const monthName = dateObj.toLocaleString("de", { month: "long" });

  // If we have a year only, return the year
  if (!month) {
    return year;
  }

  // If we have a month and day, return the full date
  if (day) {
    return `${day}. ${monthName} ${year}`;
  }

  // If we have a month only, return the month and year
  return `${monthName} ${year}`;
};
