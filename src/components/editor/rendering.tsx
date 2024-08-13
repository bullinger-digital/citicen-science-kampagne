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
  return (
    <div className="ne-editor-text">
      <RenderTextInternal nodes={nodes} />
    </div>
  );
};

const RenderTextInternal = ({ nodes }: { nodes: ChildNode[] }) => {
  return nodes
    .filter(
      (n) =>
        !(n.nodeType === NodeTypes.text && n.textContent?.match(/^[\n\t]*$/g))
    )
    .map((node, index) => {
      const nodeName =
        node.nodeType === NodeTypes.text
          ? "_text"
          : node.nodeName.toLowerCase();
      const Renderer = renderers[nodeName] || renderers._error;
      return <Renderer key={index} node={node} />;
    });
};

const useShouldHighlight = (selector: string) => {
  const highlights = window.location.hash
    ?.split("#")[1]
    ?.split("&")
    ?.filter((h) => h.split("=")[0] === "highlight");

  return (
    highlights?.[0]
      ?.split(",")
      .map((h) => {
        return decodeURIComponent(h.split("=")[1]);
      })
      .some((h) => h === selector) || false
  );
};

const linkXmlAndDomNodes = (
  xmlNode: Node | undefined | null,
  domNode: HTMLElement | undefined | null
) => {
  if (!xmlNode || !domNode) return;
  (domNode as any).xmlNode = xmlNode;
  (xmlNode as any).domNode = domNode;
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
      <span ref={(r) => linkXmlAndDomNodes(node, r)}>{node.textContent}</span>
    );
  },
  p: ({ node }) => {
    return (
      // We can't use <p> here because p cannot contain divs, which is required for footnotes etc.
      <div className="text-paragraph">
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </div>
    );
  },
  s: ({ node }) => {
    return (
      <span>
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
        <span className="ne-prevent-select-inside"> </span>
      </span>
    );
  },
  div: ({ node }) => {
    return (
      <div>
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </div>
    );
  },
  note: ({ node }) => {
    if (node.getAttribute("type") === "footnote") {
      return (
        <sup className="text-gray-400 ne-prevent-select-inside">
          <Popover
            content={<RenderTextInternal nodes={Array.from(node.childNodes)} />}
          >
            {node.getAttribute("n")}
          </Popover>
        </sup>
      );
    } else {
      return (
        <div className="text-gray-400">
          <RenderTextInternal nodes={Array.from(node.childNodes)} />
        </div>
      );
    }
  },
  persname: function PersName({ node }) {
    const c = useContext(EditorContext);
    const cert = node.getAttribute("cert");
    const ref = node.getAttribute("ref");
    const highlight = useShouldHighlight(`persName[ref=${ref}]`);

    return (
      <span
        ref={(r) => linkXmlAndDomNodes(node, r)}
        className={`border-b-4 border-sky-600 ${highlight ? " outline-red-300 outline-4 outline-offset-2 outline" : ""} ${
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
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  // Span elements appear in persName elements and denote an "inserted pronoun"
  span: function Span({ node }) {
    return (
      <span className="italic">
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  placename: function PlaceName({ node }) {
    const c = useContext(EditorContext);
    const cert = node.getAttribute("cert");
    const ref = node.getAttribute("ref");
    const highlight = useShouldHighlight(`placeName[ref=${ref}]`);

    return (
      <span
        ref={(r) => linkXmlAndDomNodes(node, r)}
        className={`border-b-4 border-yellow-600  ${highlight ? " outline-red-300 outline-4 outline-offset-2 outline" : ""} ${
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
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  pb: ({ node }) => {
    return <span title="Seitenumbruch">||</span>;
  },
  foreign: ({ node }) => {
    return (
      <span className="italic">
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  ref: ({ node }) => {
    const target = node.getAttribute("target");
    return target ? (
      <a
        href={`https://tei.bullinger-digital.ch/${node.getAttribute("target")}`}
        className="text-gray-400"
        target="_blank"
      >
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </a>
    ) : (
      <RenderTextInternal nodes={Array.from(node.childNodes)} />
    );
  },
  bibl: ({ node }) => {
    return (
      <span className="italic">
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  cit: ({ node }) => {
    return (
      <span className="italic">
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  hi: ({ node }) => {
    return (
      <span className="italic">
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  lb: ({ node }) => {
    // Linebreaks are currently not displayed as such - Todo: check if this is the desired behavior
    return (
      <>
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </>
    );
  },
  ptr: ({ node }) => {
    return (
      <span className="bg-yellow-200">
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
  del: ({ node }) => {
    return (
      <span className="line-through">
        <RenderTextInternal nodes={Array.from(node.childNodes)} />
      </span>
    );
  },
};
