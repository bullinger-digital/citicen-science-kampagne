import { saveVersion } from "@/lib/actions/citizen";
import { EditorAction, applyNewActions, getPathFromNode } from "@/lib/xml";
import { Selectable } from "kysely";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useNodeObserver } from "./useNodeObserver";
import { xmlSerializeToString } from "@/lib/xmlSerialize";
import { LetterVersion } from "@/lib/generated/kysely-codegen";
import { useServerAction } from "../common/serverActions";

export type EditorContextProps = {
  selectedNode: Node | null;
  setSelectedNode: (node: Node | null) => void;
  actions: EditorAction[];
  addAction: (action: EditorAction) => void;
  prepareAndSaveVersion: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  xmlDoc: Document | null;
  xml: string;
  redoableActions: EditorAction[];
  loading: boolean;
  error: string | null;
  letterState: LetterState;
  setLetterState: (state: LetterState) => void;
};

export enum LetterState {
  Touched = "touched",
  Finished = "finished",
}

export const EditorContext = createContext<EditorContextProps | null>(null);

export const useEditorState = ({
  letter_version,
  refetch,
}: {
  letter_version: Selectable<LetterVersion>;
  refetch: () => void;
}) => {
  const [xml, setXml] = useState(letter_version.xml);
  const [xmlDoc, setXmlDoc] = useState<Document>(() => {
    const parser = new DOMParser();
    return parser.parseFromString(letter_version.xml, "text/xml");
  });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [actions, setActions] = useState<EditorAction[]>([]);
  const [redoableActions, setRedoableActions] = useState<EditorAction[]>([]);
  const [saveRequested, setSaveRequested] = useState(false);

  const { execute: save, loading, error } = useServerAction(saveVersion);

  const prepareAndSaveVersion = useCallback(async () => {
    await save({
      id: letter_version.id,
      version_id: letter_version.version_id,
      xml: xml,
      actions: actions.map((a) => ({ ...a, dom: undefined })),
    });
    refetch();
  }, [
    xml,
    actions,
    letter_version.id,
    letter_version.version_id,
    refetch,
    save,
  ]);

  useNodeObserver(
    xmlDoc?.querySelector("TEI"),
    useCallback(async () => {
      setXml(xmlSerializeToString(xmlDoc));
    }, [xmlDoc])
  );

  useEffect(() => {
    if (saveRequested) {
      setSaveRequested(false);
      prepareAndSaveVersion();
    }
  }, [saveRequested, prepareAndSaveVersion]);

  useEffect(() => {
    applyNewActions(xmlDoc, actions);
    // Remove selection because the current node would
    // belong to the previous DOM
    setSelectedNode(null);

    // Try to select dom node of latest action
    const latestAction = actions[actions.length - 1];
    if (!latestAction) return;
    const node =
      latestAction.type === "change-attributes"
        ? latestAction.dom?.affectedNode
        : latestAction.type === "wrap"
          ? latestAction.dom?.affectedNodes[0]
          : null;

    if (node) {
      setSelectedNode(node);
    }
  }, [actions, xmlDoc]);

  const addAction = (action: EditorAction) => {
    setRedoableActions([]);
    setActions([...actions, action]);
  };

  const undo = () => {
    const latestAction = actions[actions.length - 1];
    setRedoableActions([...redoableActions, latestAction]);
    const actionsExceptLast = actions
      .slice(0, -1)
      .map((a) => ({ ...a, dom: undefined }));
    setActions(actionsExceptLast);
    const parser = new DOMParser();
    const xmlDocRaw = parser.parseFromString(letter_version.xml, "text/xml");
    applyNewActions(xmlDocRaw, actionsExceptLast);
    setXmlDoc(xmlDocRaw);
  };

  const redo = () => {
    // Add latest redoable action to actions
    const latestRedoableAction = redoableActions[redoableActions.length - 1];
    const parser = new DOMParser();
    const xmlDocRaw = parser.parseFromString(letter_version.xml, "text/xml");
    // Temporarily set actions to [] to avoid applying actions to the DOM
    setActions([]);
    setXmlDoc(xmlDocRaw);
    setActions(
      [...actions, latestRedoableAction].map((a) => ({ ...a, dom: undefined }))
    );
    // Remove latest redoable action from redoable actions
    const redoableActionsExceptLast = redoableActions.slice(0, -1);
    setRedoableActions(redoableActionsExceptLast);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Remove selection on escape
      if (e.key === "Escape") {
        setSelectedNode(null);
      }
      // Undo on ctrl+z (or cmd+z on Mac)
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        undo();
      }

      // Select next/last instance of persName or placeName with arrow keys
      if (["ArrowRight", "ArrowLeft"].includes(e.key)) {
        if (e.target !== document.body) return;
        const allPersNameAndPlaceNameNodes = Array.from(
          xmlDoc!.querySelectorAll("persName, placeName")
        ).filter((n) => !!(n as any).domNode); // Filter out nodes that are not rendered
        const currentIndex = allPersNameAndPlaceNameNodes.indexOf(
          selectedNode as Element
        );
        const nextIndex = selectedNode
          ? e.key === "ArrowLeft"
            ? currentIndex - 1
            : currentIndex + 1
          : 0;
        const nextNode = allPersNameAndPlaceNameNodes[nextIndex];
        if (nextNode) {
          setSelectedNode(nextNode as Node);
          // Scroll to DOM node
          (nextNode as any).domNode.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  const revisionDescNode = xmlDoc?.querySelector(
    "TEI > teiHeader > revisionDesc"
  );
  const letterState = revisionDescNode?.getAttribute("status") as LetterState;
  const setLetterState = (state: LetterState) => {
    addAction({
      type: "change-attributes",
      attributes: { status: state },
      nodePath: getPathFromNode(revisionDescNode as Node),
    });
    // Todo: Hacky way to trigger save after state change
    setTimeout(() => {
      setSaveRequested(true);
    }, 0);
  };

  return {
    xmlDoc,
    xml,
    selectedNode,
    setSelectedNode,
    actions,
    addAction,
    prepareAndSaveVersion,
    undo,
    redo,
    redoableActions,
    loading,
    error,
    letterState,
    setLetterState,
  };
};

export const DebugActionsView = () => {
  const { actions } = useContext(EditorContext)!;
  return (
    <>
      <h3>Actions (debug)</h3>
      {actions.map((action, index) => {
        return (
          <div className="border border-gray-200" key={index}>
            <label className="block px-2 py-2">
              <input className="mr-2" type="checkbox" />
              {action.type}{" "}
              {action.type === "wrap" && (
                <span
                  onMouseEnter={(e) =>
                    ((
                      action.dom?.affectedNodes[0] as HTMLSpanElement
                    ).style.background = "#FAFAFA")
                  }
                  onMouseLeave={(e) =>
                    ((
                      action.dom?.affectedNodes[0] as HTMLSpanElement
                    ).style.background = "none")
                  }
                >
                  {action.nodeName}
                </span>
              )}
            </label>
          </div>
        );
      })}
    </>
  );
};
