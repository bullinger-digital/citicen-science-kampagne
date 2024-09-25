"use client";

import { ReactNode, useCallback, useEffect } from "react";
import {
  DebugActionsView,
  EditorContext,
  LetterState,
  useEditorState,
} from "./editorContext";
import { RenderText } from "./rendering";
import { fileOnCurrentCommit } from "@/lib/actions/citizen";
import { Properties } from "./properties";
import { Selectable } from "kysely";
import { Toolbar } from "./toolbar";
import { Loading } from "../common/loadingIndicator";
import { LetterVersion } from "@/lib/generated/kysely-codegen";
import { isInRole } from "@/lib/security/isInRole";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useServerFetch } from "../common/serverActions";
import { LockOverlay, useLetterLock } from "./locking";
import { LetterMetaData } from "./metaData";
import { Blocker } from "../common/navigation-block/navigation-block";
import { Comments } from "../common/comments";
import { InfoIcon, Popover } from "../common/info";

export const Editor = ({ letterId }: { letterId: number }) => {
  const {
    data: file,
    loading,
    error,
    refetch,
  } = useServerFetch(fileOnCurrentCommit, {
    id: letterId.toString(),
  });
  if (error) return <div className="text-center">Fehler: {error}</div>;
  return loading || !file ? (
    <Loading />
  ) : (
    <EditorInternal letter_version={file} refetch={refetch} />
  );
};

const EditorInternal = ({
  letter_version,
  refetch,
}: {
  letter_version: Selectable<LetterVersion>;
  refetch: () => void;
}) => {
  const state = useEditorState({ letter_version, refetch });
  const lock = useLetterLock(letter_version.id, refetch);
  const session = useUser();
  const { xmlDoc, actions } = state;

  if (!xmlDoc) return <Loading />;

  const fileType = xmlDoc.querySelector("TEI")?.getAttribute("type") || "";

  if (["Hinweis", "Verweis"].includes(fileType))
    return (
      <div className="p-5 border border-gray-200 my-5 bg-blue-50">
        Einträge vom Typ <em>{fileType}</em> können nicht bearbeitet werden.
        Bitte wählen Sie einen anderen Eintrag.
      </div>
    );

  const regestNode = xmlDoc.querySelector(
    "TEI > teiHeader > fileDesc > sourceDesc > msDesc > msContents > summary"
  );
  const textNode = xmlDoc.querySelector("TEI > text > body");
  const footNotes = xmlDoc.querySelectorAll("TEI note[type=footnote]");
  const sourceDesc = xmlDoc.querySelector(
    "TEI > teiHeader > fileDesc > sourceDesc"
  );
  const sourceText = sourceDesc?.querySelector(
    "sourceDesc > bibl[type=transcription]"
  )?.textContent;
  const sourceRegest =
    sourceDesc?.querySelector("bibl[type=regest]")?.textContent;
  const sourceFootNotes = sourceDesc?.querySelector(
    "bibl[type=footnotes]"
  )?.textContent;

  return (
    <EditorContext.Provider value={state}>
      {actions.length > 0 && <Blocker />}
      <div className="relative">
        <LockOverlay lock={lock} />
        <div className="flex items-stretch space-x-2">
          <div className="p-5 bg-white shadow-xl border">
            {state.letterState === LetterState.Finished && (
              <div className="bg-green-100 p-2 mb-2">
                Dieser Brief wurde als abgeschlossen markiert.
              </div>
            )}
            <Toolbar />
            <div className="overflow-y-auto max-h-[calc(100vh-13rem)]">
              <LetterMetaData xml={xmlDoc} letterId={letter_version.id} />
              <div className="pr-4">
                {regestNode && (
                  <div className="mb-8">
                    <div className="flex">
                      <h2 className="text-xl mb-3">Regest</h2>
                      {sourceRegest && (
                        <InfoIcon
                          className="text-gray-300 ml-2 top-0.5"
                          content={`Quelle: ${sourceRegest}`}
                        />
                      )}
                    </div>
                    <div className="leading-8 font-serif">
                      <RenderText
                        nodes={Array.from(regestNode.childNodes || [])}
                      />
                    </div>
                  </div>
                )}
                <div className="flex">
                  <h2 className="text-xl mb-3">Brieftext</h2>
                  {sourceText && (
                    <InfoIcon
                      className="text-gray-300 ml-2 top-0.5"
                      content={`Quelle: ${sourceText}`}
                    />
                  )}
                </div>
                <div className="leading-8 font-serif">
                  <RenderText nodes={Array.from(textNode?.childNodes || [])} />
                </div>
                {footNotes.length > 0 && (
                  <>
                    <div className="flex mt-7">
                      <h2 className="text-xl mb-3">Fussnoten</h2>
                      {sourceFootNotes && (
                        <InfoIcon
                          className="text-gray-300 ml-2 top-0.5"
                          content={`Quelle: ${sourceFootNotes}`}
                        />
                      )}
                    </div>
                    <ol className="leading-8 font-serif">
                      {Array.from(footNotes)
                        .sort((a, b) => {
                          // n attribute could be missing, so we need to handle that
                          try {
                            return parseInt(a.getAttribute("n") || "0") <
                              parseInt(b.getAttribute("n") || "0")
                              ? -1
                              : 1;
                          } catch (e) {
                            return 0;
                          }
                        })
                        .map((node, i) => (
                          <li className="flex" key={i}>
                            <span className="w-8 shrink-0 text-emerald-400">
                              {node.getAttribute("n")}
                            </span>
                            {node.getAttribute("subtype") === "metadata" && (
                              <span>
                                <Popover
                                  trigger="hover"
                                  content="Diese Fussnote bezieht sich auf Informationen in den Metadaten des Briefes (Absender, Empfänger, Datum etc.)"
                                >
                                  <span className=" text-xs mr-3 bg-gray-200 p-1 rounded-xl font-sans">
                                    Metadaten
                                  </span>
                                </Popover>
                              </span>
                            )}
                            <div>
                              <RenderText nodes={Array.from(node.childNodes)} />
                            </div>
                          </li>
                        ))}
                    </ol>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="grow-0 shrink-0 w-[26rem] basis-[26rem]">
            <Properties />
            <ContextBox title="Bedeutung der Markierungen">
              <div className="self-center">
                <div className="flex mb-2 space-x-4 text-sm text-gray-400">
                  <div className="text-sky-600">Personen</div>
                  <div className="text-yellow-600">Ortschaften</div>
                </div>
                <div className="flex space-x-4 text-sm text-gray-400">
                  <div className="border-gray-400 border-b-4">Verifiziert</div>
                  <div className="border-gray-400 border-b-4 border-dashed">
                    Nicht verifiziert
                  </div>
                  <div className="border-gray-400 border-b-4 border-double">
                    Keine Zuweisung
                  </div>
                </div>
              </div>
            </ContextBox>
            <ContextBox title="Kommentare">
              <Comments target={"letter/" + letter_version.id.toString()} />
            </ContextBox>
            <ContextBox title="Vorschläge">
              <Proposals doc={xmlDoc} />
            </ContextBox>
            {isInRole(session, "data-admin") && (
              <ContextBox title="Debug">
                <DebugActionsView />
              </ContextBox>
            )}
          </div>
        </div>
      </div>
    </EditorContext.Provider>
  );
};

import Fuse from "fuse.js";

const Proposals = ({ doc }: { doc: Document }) => {
  // WIP: This is a very basic implementation of a proposal system. It should be improved.
  // Another idea is to mark proposals directly in the text. Not easy because users should be able to accept or reject them.
  // We could place the proposals in a second "tab" of the sidebar, which would save vertical space.

  const persNames = Array.from(doc.querySelectorAll("persName")).map(
    (node) => ({
      type: "persName",
      text: node.textContent,
    })
  );

  const searchables = doc.querySelectorAll(
    "TEI > text > body, TEI > text > note[type=footnote], TEI > teiHeader > fileDesc > sourceDesc > msDesc > msContents > summary"
  );

  const textNodes = Array.from(searchables).reduce((acc, node) => {
    const textNodes = searchableNodes(doc, node as Element);
    return acc.concat(textNodes);
  }, [] as Element[]);

  const proposals = textNodes.reduce(
    (acc, node) => {
      const text = node.textContent;
      if (!text) return acc;
      // Todo: Match only whole words; take care of multiple matches in one text node
      const matches = persNames.filter((persName) =>
        persName.text ? text.includes(persName.text) : false
      );
      for (const match of matches) {
        acc.push({
          node: node,
          text: match.text || "",
          index: text.indexOf(match.text || ""),
          excerpt: text.slice(
            Math.max(0, (text.indexOf(match.text || "") || 0) - 25),
            Math.min(text.length, (text.indexOf(match.text || "") || 0) + 50)
          ),
        });
      }
      return acc;
    },
    [] as { node: Element; text: string; index: number; excerpt: string }[]
  );

  return (
    <div>
      {proposals.map((proposal, i) => (
        <div
          key={i}
          className="mb-3"
          onMouseEnter={(e) => {
            const domNode = (proposal.node as any).domNode as HTMLElement;
            if (domNode) {
              domNode.scrollIntoView({ behavior: "smooth", block: "nearest" });
              domNode.style.background = "#f1dd38";
            }
          }}
          onMouseLeave={(e) => {
            const domNode = (proposal.node as any).domNode as HTMLElement;
            if (domNode) {
              domNode.scrollIntoView({ behavior: "smooth", block: "nearest" });
              domNode.style.background = "";
            }
          }}
          onClick={() => {
            // Todo: We can't directy insert a new node here - we need to use the existing API to wrap nodes
            const newNode = doc.createElement("persName");
            newNode.textContent = proposal.text;
            const beforeText = proposal.node.textContent?.slice(
              0,
              proposal.index
            );
            const afterText = proposal.node.textContent?.slice(
              proposal.index + proposal.text.length
            );
            proposal.node.textContent = beforeText || null;
            proposal.node.after(newNode as Node);
            if (afterText) {
              const afterNode = doc.createTextNode(afterText);
              newNode.after(afterNode);
            }
          }}
        >
          <div className="text-gray-400 text-sm">{proposal.text} in:</div>
          <div className="bg-gray-50 p-2 rounded-lg font-serif whitespace-nowrap overflow-hidden text-ellipsis">
            {proposal.excerpt}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Retrieves an array of all text nodes we want proposals for
 * https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker
 */
const searchableNodes = (doc: Document, el: Element) => {
  const children: Node[] = [];
  const walker = doc.createTreeWalker(el as Node, NodeFilter.SHOW_ALL, (e) => {
    if (e.nodeType === Node.TEXT_NODE) {
      return NodeFilter.FILTER_ACCEPT;
    } else if (
      e.nodeName.toLowerCase() === "persname" ||
      e.nodeName.toLowerCase() === "placename"
    ) {
      return NodeFilter.FILTER_REJECT;
    } else {
      return NodeFilter.FILTER_SKIP;
    }
  });
  while (walker.nextNode()) {
    children.push(walker.currentNode);
  }
  return children as Element[];
};

export const ContextBox = ({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) => {
  return (
    <div className="bg-white shadow-xl border mb-2 last:mb-0">
      <h2 className="p-5 border-b font-light">{title}</h2>
      <div className="p-5">{children}</div>
    </div>
  );
};
