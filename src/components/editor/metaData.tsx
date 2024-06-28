import React from "react";
import { InfoIcon } from "../common/info";
import { useServerFetch } from "../common/serverActions";
import { orgNameByRef, personById } from "@/lib/actions/citizen";
import { xmlParseFromString } from "@/lib/xmlSerialize";
import { dateAsString, directTextContent } from "@/lib/metadataCommon";

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
  return (
    <>
      {data?.forename} {data?.surname}
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
