/** Paths are in format div[0]/p[1]/s[0] - using index of the node in the parent */
type NodePath = {
  index: number;
  nodeName: string;
};

type NodeAttributes = { [key: string]: string | number | boolean | null };

export type EditorAction =
  | {
      type: "wrap";
      dom?: {
        affectedNodes: Node[];
        applied: boolean;
      };
      startNode: NodePath[];
      startOffset: number;
      endNode: NodePath[];
      endOffset: number;
      text: string;
      nodeName: "persName" | "placeName";
      attributes?: NodeAttributes;
    }
  | {
      type: "unwrap";
      dom?: {
        affectedNode: Node;
        applied: boolean;
      };
      nodePath: NodePath[];
    }
  | {
      type: "change-attributes";
      dom?: {
        affectedNode: Node;
        applied: boolean;
      };
      nodePath: NodePath[];
      attributes: NodeAttributes;
    }
  | {
      // Used for moving usages of a person/place to another id (in admin actions)
      type: "selector-set-attributes";
      dom?: {
        affectedNodes: Node[];
        applied: boolean;
      };
      selector: string;
      attributes: NodeAttributes;
    };

const allParents = (node: Node): Node[] => {
  if (node.parentNode && node != node.ownerDocument?.documentElement) {
    return [...allParents(node.parentNode), node.parentNode];
  } else {
    return [];
  }
};

export const getPathFromNode = (node: Node): NodePath[] => {
  const nodeChain = [...allParents(node), node];
  return nodeChain.map((n) => {
    const index = Array.from(n.parentNode!.childNodes).indexOf(n as ChildNode);
    return { index, nodeName: n.nodeName };
  });
};

const getNodeFromPath = (dom: Document, path: NodePath[]): Node => {
  let node = dom as Node;
  path.forEach((step) => {
    node = node.childNodes[step.index];
    if (!node) {
      throw new Error("Node path is invalid, node not found");
    }
    if (step.nodeName !== node.nodeName) {
      throw new Error(
        "Node path is invalid, expected " +
          step.nodeName +
          " but found: " +
          node.nodeName
      );
    }
  });
  return node;
};

const applyNodeAttributes = (node: Node, attributes: NodeAttributes) => {
  Object.entries(attributes)
    .sort((a, b) => {
      // Order attributes by key
      return a[0].localeCompare(b[0]);
    })
    .forEach(([key, value]) => {
      if (value === null) node.removeAttribute(key);
      else node.setAttribute(key, String(value));
    });
};

export const applyNewActions = (dom: Document, actions: EditorAction[]) => {
  const unappliedActions = actions.filter((a) => !a.dom || !a.dom?.applied);
  unappliedActions.forEach((action) => {
    switch (action.type) {
      case "wrap": {
        const startNode = getNodeFromPath(dom, action.startNode);
        const endNode = getNodeFromPath(dom, action.endNode);
        const annotationNode = dom.createElementNS(
          "http://www.tei-c.org/ns/1.0",
          action.nodeName
        ) as Node;
        if (action.attributes) {
          applyNodeAttributes(annotationNode, action.attributes);
        }
        const range = dom.createRange();
        range.setStart(startNode, action.startOffset);
        range.setEnd(endNode, action.endOffset);
        range.surroundContents(annotationNode);
        action.dom = { affectedNodes: [annotationNode], applied: true };
        break;
      }
      case "unwrap": {
        const node = getNodeFromPath(dom, action.nodePath) as ChildNode;
        const parent = node.parentNode!;
        node.replaceWith(...Array.from(node.childNodes));
        action.dom = { affectedNode: parent, applied: true };
        break;
      }
      case "change-attributes": {
        const node = getNodeFromPath(dom, action.nodePath);
        applyNodeAttributes(node, action.attributes);
        action.dom = { affectedNode: node, applied: true };
        break;
      }
      case "selector-set-attributes": {
        const nodes = Array.from(dom.querySelectorAll(action.selector));
        nodes.forEach((node) => {
          applyNodeAttributes(node as Node, action.attributes);
        });
        action.dom = { affectedNodes: nodes as Node[], applied: true };
        break;
      }
      default:
        throw new Error("Unknown action type: " + (action as any).type);
    }

    // Todo: Is this required? (https://developer.mozilla.org/en-US/docs/Web/API/Node/normalize)
    dom.normalize();
  });
};

export const prepareActionsForSave = (actions: EditorAction[]): string => {
  return JSON.stringify(
    actions.map((a) => {
      return {
        ...a,
        dom: undefined,
      };
    })
  );
};
