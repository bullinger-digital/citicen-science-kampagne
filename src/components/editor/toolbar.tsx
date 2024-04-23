import { isInRole } from "@/lib/security/isInRole";
import { getPathFromNode } from "@/lib/xml";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useCallback, useContext, useEffect, useState } from "react";
import {
  FaUndo,
  FaRedo,
  FaSave,
  FaPlus,
  FaMinus,
  FaCheck,
} from "react-icons/fa";
import Modal from "../common/modal";
import { EditorContext, LetterState } from "./editorContext";
import dynamic from "next/dynamic";
const XmlView = dynamic(
  () => import("./xmlCodeView").then((mod) => mod.XmlView),
  { ssr: false }
);
import { BsFiletypeXml, BsPersonFill } from "react-icons/bs";
import { TbLocation } from "react-icons/tb";
import { Loading } from "../common/loadingIndicator";

const ToolbarButton = ({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) => {
  return (
    <button
      className="relative p-2 text-lg disabled:text-gray-300 hover:text-emerald-500"
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
};

const getXmlStartAndEndNode = (selection: Selection | null) => {
  if (selection?.rangeCount === 0 || selection?.isCollapsed) {
    return { isValid: false };
  }
  const range = selection?.getRangeAt(0);
  if (!range) {
    return { isValid: false };
  }

  // Todo: Verify selection is within a text node and does not overlap other nodes
  // Todo: extend selection to include siblings if it is not within a text node? Or if offset is = 0 and is has no previous sibling
  // or exclude element from end of selection if offset = 0
  // Selection cleanup seams not so easy, because browsers are not consistent in how they handle selections (needs proper testing in all major browsers)

  const startNode = (range?.startContainer.parentElement as any)
    .xmlNode as Node;
  const endNode = (range?.endContainer.parentElement as any).xmlNode as Node;

  // Todo: Prevent nesting of markups
  const isValid =
    !!startNode &&
    !!endNode &&
    startNode.parentElement === endNode.parentElement;

  return { startNode, endNode, isValid, range };
};

const useHasMarkableSelection = () => {
  const [hasMarkableSelection, setHasMarkableSelection] =
    useState<boolean>(false);
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    const { isValid } = getXmlStartAndEndNode(selection);
    setHasMarkableSelection(isValid);
  }, []);
  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [handleSelectionChange]);

  return { hasMarkableSelection };
};

export const Toolbar = () => {
  const {
    actions,
    redoableActions,
    undo,
    redo,
    addAction,
    prepareAndSaveVersion,
    xmlDoc,
    xml,
    selectedNode,
    setSelectedNode,
    loading,
    error,
    letterState,
    setLetterState,
  } = useContext(EditorContext)!;
  const [showXmlView, setShowXmlView] = useState(false);
  const { hasMarkableSelection } = useHasMarkableSelection();
  const session = useUser();

  const addMark = useCallback(
    (nodeName: "persName" | "placeName") => {
      const selection = window.getSelection();
      const { startNode, endNode, range, isValid } =
        getXmlStartAndEndNode(selection);
      if (!isValid || !startNode || !endNode) {
        alert(
          "Markierung konnte nicht hinzugefügt werden - bitte selektieren Sie den Text erneut."
        );
        return;
      }

      const startNodePath = getPathFromNode(startNode);
      const endNodePath = getPathFromNode(endNode);

      // Extract text from selection
      const xmlRange = xmlDoc!.createRange();
      xmlRange.setStart(startNode, range.startOffset);
      xmlRange.setEnd(endNode, range.endOffset);
      const text = range.cloneContents().textContent || "";

      addAction({
        type: "wrap",
        nodeName: nodeName,
        startNode: startNodePath,
        endNode: endNodePath,
        startOffset: range?.startOffset || 0,
        endOffset: range?.endOffset || 0,
        text: text,
      });

      selection?.removeAllRanges();
    },
    [addAction, xmlDoc]
  );

  const removeMark = useCallback(() => {
    addAction({
      type: "unwrap",
      nodePath: getPathFromNode(selectedNode!),
    });
    setSelectedNode(null);
  }, [addAction, selectedNode, setSelectedNode]);

  const toolbarDisabled = loading;

  // onDoubleClick={(e) => {
  //   c?.addAction({
  //     type: "unwrap",
  //     nodePath: getPathFromNode(node),
  //   });
  //   c?.setSelectedNode(null);
  // }}

  return (
    <div className="flex justify-between border-b-2 border-gray-200 mb-7">
      <div>
        <ToolbarButton
          title="Letzte Änderung rückgängig machen"
          onClick={() => undo()}
          disabled={toolbarDisabled || actions.length === 0}
        >
          <FaUndo className="text-xl" />
        </ToolbarButton>
        <ToolbarButton
          title="Letzte Änderung wiederherstellen"
          onClick={() => redo()}
          disabled={toolbarDisabled || redoableActions.length === 0}
        >
          <FaRedo className="text-xl" />
        </ToolbarButton>
        <div className="inline-block mx-4 border-gray-400 border-l border h-5">
          {" "}
        </div>
        <ToolbarButton
          disabled={toolbarDisabled || !hasMarkableSelection}
          onClick={() => addMark("persName")}
          title="Person markieren"
        >
          <BsPersonFill className="text-2xl" />
          <FaPlus className="text-sm absolute bottom-0 right-0" />
        </ToolbarButton>
        <ToolbarButton
          disabled={
            toolbarDisabled ||
            !selectedNode ||
            selectedNode.nodeName !== "persName"
          }
          onClick={() => removeMark()}
          title="Personen-Markierung entfernen"
        >
          <BsPersonFill className="text-2xl" />
          <FaMinus className="text-sm absolute bottom-0 right-0" />
        </ToolbarButton>

        <ToolbarButton
          disabled={toolbarDisabled || !hasMarkableSelection}
          onClick={() => addMark("placeName")}
          title="Ortschaft markieren"
        >
          <TbLocation className="text-2xl" />
          <FaPlus className="text-sm absolute bottom-0 right-0" />
        </ToolbarButton>
        <ToolbarButton
          disabled={
            toolbarDisabled ||
            !selectedNode ||
            selectedNode.nodeName !== "placeName"
          }
          onClick={() => removeMark()}
          title="Ortschafts-Markierung entfernen"
        >
          <TbLocation className="text-2xl" />
          <FaMinus className="text-sm absolute bottom-0 right-0" />
        </ToolbarButton>
        <Modal
          open={showXmlView}
          cancel={() => setShowXmlView(false)}
          title="XML-Ansicht (nur für Administratoren)"
        >
          <div>
            <XmlView initialXmlString={xml} />
          </div>
        </Modal>
      </div>
      <div>
        {isInRole(session, "admin") && (
          <ToolbarButton onClick={() => setShowXmlView(true)} title="XML">
            <BsFiletypeXml />
          </ToolbarButton>
        )}
        <ToolbarButton
          disabled={toolbarDisabled || actions.length === 0}
          onClick={() => prepareAndSaveVersion()}
          title="Speichern"
        >
          <span className="flex space-x-1 items-center">
            <FaSave className="text-xl" />
            <div className="text-sm">Änderungen speichern</div>
          </span>
        </ToolbarButton>
        <ToolbarButton
          disabled={toolbarDisabled || letterState === LetterState.Finished}
          onClick={() => {
            setLetterState(LetterState.Finished);
          }}
          title="Abschliessen (alle Personen und Ortschaften im Brief sind markiert)"
        >
          <IconButton icon={<FaCheck className="text-xl" />}>
            Brief abschliessen
          </IconButton>
        </ToolbarButton>
      </div>
      {error && <div className="text-red-500">{error}</div>}
    </div>
  );
};

const IconButton = ({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) => {
  return (
    <div className="flex space-x-2 items-center">
      {icon}
      <div className="text-sm">{children}</div>
    </div>
  );
};
