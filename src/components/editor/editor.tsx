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

  // const onBeforeUnload = useCallback(
  //   (e: BeforeUnloadEvent) => {
  //     if (actions.length > 0) {
  //       e.preventDefault();
  //       e.returnValue = "Sie haben ungespeicherte Änderungen.";
  //     }
  //   },
  //   [actions]
  // );

  // useEffect(() => {
  //   window.addEventListener("beforeunload", onBeforeUnload);
  //   return () => window.removeEventListener("beforeunload", onBeforeUnload);
  // });

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
                    <h2 className="text-xl mb-3">Regest</h2>
                    <div className="leading-8 font-serif">
                      <RenderText
                        nodes={Array.from(regestNode.childNodes || [])}
                      />
                    </div>
                  </div>
                )}
                <h2 className="text-xl mb-3">Brieftext</h2>
                <div className="leading-8 font-serif">
                  <RenderText nodes={Array.from(textNode?.childNodes || [])} />
                </div>
                {footNotes.length > 0 && (
                  <>
                    <h2 className="text-xl mb-3 mt-7">Fussnoten</h2>
                    <ol className="leading-8 font-serif">
                      {Array.from(footNotes).map((node, i) => (
                        <li className="flex" key={i}>
                          <span className="w-8 shrink-0 text-emerald-400">
                            {node.getAttribute("n")}
                          </span>
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
