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
import { AiOutlineLoading3Quarters } from "react-icons/ai";

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

const endAtTextNodeBefore = (range: Range, node: Node) => {
  let previousTextNode = range.endContainer!;
  limitedWhile(
    () =>
      Array.from(previousTextNode.parentNode?.childNodes || []).indexOf(
        previousTextNode as ChildNode
      ) === 0,
    () => (previousTextNode = previousTextNode.parentNode!)
  );
  previousTextNode = previousTextNode.previousSibling!;
  limitedWhile(
    () => previousTextNode.nodeType !== Node.TEXT_NODE,
    () => (previousTextNode = previousTextNode.lastChild!)
  );
  range.setEnd(previousTextNode, previousTextNode.textContent?.length || 0);
};

const startAtTextNodeAfter = (range: Range, node: Node) => {
  let nextTextNode = range.startContainer!;
  limitedWhile(
    () =>
      Array.from(nextTextNode.parentNode?.childNodes || []).indexOf(
        nextTextNode as ChildNode
      ) ===
      (nextTextNode.parentNode?.childNodes || []).length - 1,
    () => (nextTextNode = nextTextNode.parentNode!)
  );
  nextTextNode = nextTextNode.nextSibling!;
  limitedWhile(
    () => nextTextNode.nodeType !== Node.TEXT_NODE,
    () => (nextTextNode = nextTextNode.firstChild!)
  );
  range.setStart(nextTextNode, 0);
};

const limitedWhile = (
  condition: (i: number) => boolean,
  action: (i: number) => void,
  maxIterations = 20
) => {
  let i = 0;
  while (condition(i) && i < maxIterations) {
    action(i);
    i++;
  }
  if (i >= maxIterations) {
    console.error("Limited while loop reached maximum iterations");
  }
};

const sanitizeRange = (range: Range) => {
  // Trim leading and trailing whitespace
  const charsToTrim = [" ", "\n", "\t"];
  limitedWhile(
    () =>
      charsToTrim.find(
        (c) => c === range.startContainer.textContent?.[range.startOffset]
      ) !== undefined,
    () => range.setStart(range.startContainer, range.startOffset + 1)
  );
  limitedWhile(
    () =>
      charsToTrim.find(
        (c) => c === range.endContainer.textContent?.[range.endOffset - 1]
      ) !== undefined,
    () => range.setEnd(range.endContainer, range.endOffset - 1)
  );

  // If endOffset is 0 or endContainer is not a text node, end selection at previous node
  if (range.endOffset === 0 || range.endContainer.nodeType !== Node.TEXT_NODE) {
    endAtTextNodeBefore(range, range.endContainer);
  }

  // If startOffset is the last element or startContainer is not a text node, start selection at next node
  if (
    range.startOffset === range.startContainer.textContent?.length ||
    range.startContainer.nodeType !== Node.TEXT_NODE
  ) {
    startAtTextNodeAfter(range, range.startContainer);
  }

  // Prevent selections inside elements with class ne-prevent-select-inside (currently, footnote elements)
  let node = range.endContainer;
  const parents = [];
  while (node !== document.body) {
    parents.push(node);
    node = node.parentNode!;
  }
  const parentWithPreventSelect = parents.find((p) =>
    (p as HTMLElement)?.classList?.contains("ne-prevent-select-inside")
  );
  if (parentWithPreventSelect) {
    endAtTextNodeBefore(range, parentWithPreventSelect);
  }
};

const useHasMarkableSelection = () => {
  const [hasMarkableSelection, setHasMarkableSelection] =
    useState<boolean>(false);
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    const { isValid } = getXmlStartAndEndNode(selection);
    setHasMarkableSelection(isValid);
  }, []);

  const sanitizeSelection = useCallback(() => {
    // Timeout is required for browser to update selection before sanitizing
    setTimeout(() => {
      try {
        const selection = window.getSelection();
        const range =
          selection && selection?.rangeCount > 0
            ? selection?.getRangeAt(0)
            : null;
        if (!range) return;
        // If none of the node's parents has the class ne-editor-text, the selection is not within the editor - skip
        if (
          !range.startContainer.parentElement?.closest(".ne-editor-text") ||
          !range.endContainer.parentElement?.closest(".ne-editor-text")
        ) {
          return;
        }

        sanitizeRange(range);
      } catch (e) {
        console.error("Error while sanitizing selection");
        console.error(e);
      }
    }, 0);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mouseup", sanitizeSelection);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", sanitizeSelection);
    };
  }, [handleSelectionChange, sanitizeSelection]);

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
  const [finishLetterModalOpen, setFinishLetterModalOpen] = useState(false);
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
        attributes: {
          type: "citizen_name",
        },
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
      <div className="flex">
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
            {loading ? (
              <AiOutlineLoading3Quarters className="inline-block text-gray-400 animate-spin" />
            ) : (
              <FaSave className="text-xl" />
            )}
            <div className="text-sm">Änderungen speichern</div>
          </span>
        </ToolbarButton>
        <ToolbarButton
          disabled={toolbarDisabled || letterState === LetterState.Finished}
          onClick={() => {
            setFinishLetterModalOpen(true);
          }}
          title="Abschliessen (alle Personen und Ortschaften im Brief sind markiert)"
        >
          <IconButton icon={<FaCheck className="text-xl" />}>
            Brief abschliessen
          </IconButton>
        </ToolbarButton>
        <FinishLetterModal
          open={finishLetterModalOpen}
          setOpen={setFinishLetterModalOpen}
          finish={() => {
            setFinishLetterModalOpen(false);
            setLetterState(LetterState.Finished);
          }}
        />
      </div>
      {error && <div className="text-red-500">{error}</div>}
    </div>
  );
};

const FinishLetterModal = ({
  open,
  setOpen,
  finish,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  finish: () => void;
}) => {
  return (
    <>
      {open && (
        <Modal
          maxWidth={500}
          open={open}
          cancel={() => setOpen(false)}
          title="Brief abschliessen"
        >
          <div>
            <div className="mb-4">
              Markieren Sie den Brief als abgeschlossen, wenn Sie der Ansicht
              sind, dass alle Personen und Ortschaften in diesem Brief markiert
              und verifiziert sind.
            </div>
            <div className="mb-4">Möchten Sie diesen Brief abschliessen?</div>
            <div className="flex justify-end">
              <button
                className="bg-emerald-400 text-white p-2 rounded-md"
                onClick={finish}
              >
                Ja, Brief abschliessen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
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
