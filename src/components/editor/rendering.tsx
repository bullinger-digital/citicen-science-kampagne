import { ReactElement, useContext } from "react";
import { Popover } from "../common/info";
import { EditorContext } from "./editorContext";
import { getPathFromNode } from "@/lib/xml";

type RendererProps = {
  node: ChildNode;
};

const NodeTypes = {
  text: 3,
  element: 1,
};

// Operations to support
// - wrap selected text in annotation
// - remove annotation
// - change annotation properties

export const RenderText = ({ nodes }: { nodes: ChildNode[] }) => {
  return nodes.map((node, index) => {
    const nodeName =
      node.nodeType === NodeTypes.text ? "_text" : node.nodeName.toLowerCase();
    const Renderer = renderers[nodeName] || renderers._error;
    return <Renderer key={index} node={node} />;
  });
};

const renderers: {
  [key: string]: (props: RendererProps) => ReactElement<RendererProps>;
} = {
  _error: ({ node }) => {
    return (
      <span className="text-red-400">[Unsupported Node: {node.nodeName}]</span>
    );
  },
  _text: ({ node }) => {
    return (
      <span
        ref={(r) => {
          if (!r) return;
          (r as any).xmlNode = node;
          (node as any).domNode = r;
        }}
      >
        {node.textContent}
      </span>
    );
  },
  p: ({ node }) => {
    return (
      // We can't use <p> here because p cannot contain divs, which is required for footnotes etc.
      <div className="text-paragraph">
        <RenderText nodes={Array.from(node.childNodes)} />
      </div>
    );
  },
  s: ({ node }) => {
    return (
      <span>
        <RenderText nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  div: ({ node }) => {
    return (
      <div>
        <RenderText nodes={Array.from(node.childNodes)} />
      </div>
    );
  },
  note: ({ node }) => {
    if (node.getAttribute("type") === "footnote") {
      return (
        <sup className="text-gray-400">
          <Popover content={<RenderText nodes={Array.from(node.childNodes)} />}>
            {node.getAttribute("n")}
          </Popover>
        </sup>
      );
    } else {
      return (
        <div className="text-gray-400">
          <RenderText nodes={Array.from(node.childNodes)} />
        </div>
      );
    }
  },
  persname: function PersName({ node }) {
    const c = useContext(EditorContext);
    const cert = node.getAttribute("cert");
    const ref = node.getAttribute("ref");
    return (
      <span
        className={`border-b-4 border-sky-600 ${
          c?.selectedNode === node ? " bg-sky-100" : ""
        } ${
          cert === "high" && !!ref
            ? ""
            : !ref
            ? "border-double"
            : "border-dashed"
        }`}
        onClick={(e) => {
          c?.setSelectedNode(node);
        }}
      >
        <RenderText nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  placename: function PlaceName({ node }) {
    const c = useContext(EditorContext);
    const cert = node.getAttribute("cert");
    const ref = node.getAttribute("ref");
    return (
      <span
        className={`border-b-4 border-yellow-600 ${
          c?.selectedNode === node ? " bg-yellow-100" : ""
        } ${
          cert === "high" && !!ref
            ? ""
            : !ref
            ? "border-double"
            : "border-dashed"
        }`}
        onClick={(e) => {
          c?.setSelectedNode(node);
        }}
      >
        <RenderText nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  pb: ({ node }) => {
    return <span title="Seitenumbruch">||</span>;
  },
  foreign: ({ node }) => {
    return (
      <span className="italic">
        <RenderText nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  ref: ({ node }) => {
    return (
      <a
        href={`https://tei.bullinger-digital.ch/${node.getAttribute("target")}`}
        className="text-gray-400"
        target="_blank"
      >
        <RenderText nodes={Array.from(node.childNodes)} />
      </a>
    );
  },
  bibl: ({ node }) => {
    return (
      <span className="italic">
        <RenderText nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  hi: ({ node }) => {
    return (
      <span className="italic">
        <RenderText nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  lb: ({ node }) => {
    // Linebreaks are currently not displayed as such - Todo: check if this is the desired behavior
    return (
      <>
        <RenderText nodes={Array.from(node.childNodes)} />
      </>
    );
  },
  ptr: ({ node }) => {
    return (
      <span className="bg-yellow-200">
        <RenderText nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  del: ({ node }) => {
    return (
      <span className="line-through">
        <RenderText nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
};
