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

  const isAutomaticTranscription =
    xmlDoc.querySelector("TEI")?.getAttribute("source") === "keine";

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
            {isAutomaticTranscription && (
              <div className="bg-yellow-100 p-2 mb-2">
                Bei untenstehendem Text handelt es sich um eine automatische
                Transkription. Diese sind momentan nicht zu annotieren. Bitte
                fahren Sie mit einem anderen Brief fort.
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
            <ContextBox title="Kommentare zum Brief">
              <Comments target={"letter/" + letter_version.id.toString()} />
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
