"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import {
  DebugActionsView,
  EditorContext,
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

const useFile = (fileId: number) => {
  // Todo: what is the purpose of loading and isLoading?
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<Selectable<LetterVersion> | null>(null);

  const fetchFile = async (f: number) => {
    setIsLoading(true);
    setFile(null);
    setError(null);
    try {
      const file = await fileOnCurrentCommit({
        id: f.toString(),
      });
      if (!file) {
        setError(`Der Eintrag mit ID ${f} konnte nicht gefunden werden.`);
      } else {
        setFile(file || null);
      }
    } catch (e) {
      setError(
        `Beim Laden des Eintrags ist ein Fehler aufgetreten. ${
          typeof e === "string"
            ? e
            : e instanceof Error
            ? e.message
            : "Unbekannter Fehler"
        }`
      );
    }

    setLoading(false);
    setIsLoading(false);
  };

  useEffect(() => {
    if (loading && !isLoading && !file) fetchFile(fileId);
  }, [fileId, loading, isLoading, file]);

  const refetch = useCallback(() => fetchFile(fileId), [fileId]);

  return { file, loading, error, refetch };
};

export const Editor = ({ letterId }: { letterId: number }) => {
  const { file, loading, error, refetch } = useFile(letterId);
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
  const session = useUser();
  const { xmlDoc, actions } = state;

  const onBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (actions.length > 0) {
        e.preventDefault();
        e.returnValue = "Sie haben ungespeicherte Änderungen.";
      }
    },
    [actions]
  );

  useEffect(() => {
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  });

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

  return (
    <EditorContext.Provider value={state}>
      <div className="">
        <div className="flex items-stretch space-x-2">
          <div className="p-5 bg-white shadow-xl border">
            <Toolbar />
            <div className="overflow-y-auto max-h-[calc(100vh-13rem)]">
              <div className="pr-4 mb-4">
                Brief {letter_version.id} -{" "}
                <a
                  target="_blank"
                  className=" text-emerald-400"
                  href={`https://tei.bullinger-digital.ch/file${letter_version.id}`}
                >
                  Im TEI-Publisher ansehen
                </a>
              </div>
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
              </div>
            </div>
          </div>
          <div className="grow-0 shrink-0 basis-[26rem]">
            <Properties />
            <ContextBox title="Bedeutung der Markierungen">
              <div className="self-center">
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
            {isInRole(session, "admin") && (
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
