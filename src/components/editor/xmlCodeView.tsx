"use client";

import CodeMirror from "@uiw/react-codemirror";
import { xml as cmXml } from "@codemirror/lang-xml";

export const XmlView = ({ initialXmlString }: { initialXmlString: string }) => {
  return (
    <CodeMirror
      extensions={[cmXml()]}
      value={initialXmlString}
      readOnly={true}
      height="600px"
    />
  );
};
