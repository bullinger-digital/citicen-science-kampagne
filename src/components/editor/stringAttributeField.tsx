import { memo, useState } from "react";
import { useNodeObserver } from "./useNodeObserver";

// Todo: Improve before using in production
const StringAttributeField = memo(function StringAttributeField({
  attribute,
  node,
}: {
  attribute: string;
  node: Node;
}) {
  const [it, setIt] = useState(0);
  // const [value, setValue] = useState(node.getAttribute(attribute));
  const setValueOnNode = (value: string) => {
    node.setAttribute(attribute, value);
  };

  useNodeObserver(node, () => {
    console.log("value of node has changed");
    setIt(it + 1);
    // setValue(node.getAttribute(attribute));
  });

  console.log("re-rendering string field attribute", attribute);

  return (
    <>
      <input
        type="text"
        value={node.getAttribute(attribute) || ""}
        onChange={(e) => {
          setValueOnNode(e.currentTarget.value);
          setIt(it + 1);
          console.log("new value is", node.getAttribute(attribute));
          //setValue(e.currentTarget.value);
        }}
      ></input>
      {node.getAttribute(attribute)}
    </>
  );
});
