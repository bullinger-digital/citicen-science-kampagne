import { saveVersion } from "@/lib/actions/citizen";
import { EditorAction, applyNewActions } from "@/lib/xml";
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
  setActions: (actions: EditorAction[]) => void;
  addAction: (action: EditorAction) => void;
  prepareAndSaveVersion: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  xmlDoc: Document | null;
  xml: string;
  redoableActions: EditorAction[];
  loading: boolean;
  error: string | null;
};

export const EditorContext = createContext<EditorContextProps | null>(null);

export const useEditorState = ({
  letter_version,
  refetch,
}: {
  letter_version: Selectable<LetterVersion>;
  refetch: () => void;
}) => {
  const [xml, setXml] = useState(letter_version.xml);
  const [iteration, setIteration] = useState(0);
  const [xmlDoc, setXmlDoc] = useState<Document | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [actions, setActions] = useState<EditorAction[]>([]);
  const [redoableActions, setRedoableActions] = useState<EditorAction[]>([]);

  const { execute: save, loading, error } = useServerAction(saveVersion);

  const prepareAndSaveVersion = async () => {
    await save({
      id: letter_version.id,
      version_id: letter_version.version_id,
      xml: xml,
      actions: actions.map((a) => ({ ...a, dom: undefined })),
    });
    refetch();
  };

  useEffect(() => {
    if (!xmlDoc) return;
    applyNewActions(xmlDoc!, actions);
    setIteration((i) => i + 1);

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
    if (!xmlDoc) throw new Error("Not ready yet: DOM is null");
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
    const actionsExceptLast = [...actions, latestRedoableAction].map((a) => ({
      ...a,
      dom: undefined,
    }));
    const parser = new DOMParser();
    const xmlDocRaw = parser.parseFromString(letter_version.xml, "text/xml");
    applyNewActions(xmlDocRaw, actionsExceptLast);
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

  useEffect(() => {
    const parser = new DOMParser();
    const xmlDocRaw = parser.parseFromString(letter_version.xml, "text/xml");
    setXmlDoc(xmlDocRaw);
  }, [letter_version.xml]);

  useNodeObserver(
    xmlDoc?.querySelector("TEI"),
    useCallback(async () => {
      console.log("DOM has changed");
      if (!xmlDoc) return;
      setXml(xmlSerializeToString(xmlDoc));
    }, [xmlDoc])
  );

  return {
    xmlDoc,
    xml,
    selectedNode,
    setSelectedNode,
    actions,
    setActions,
    addAction,
    prepareAndSaveVersion,
    undo,
    redo,
    redoableActions,
    loading,
    error,
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
