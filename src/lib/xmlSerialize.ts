import { type DOMWindow } from "jsdom";

const getWindow = (): (Window & typeof globalThis) | DOMWindow => {
  const isServer = typeof window === "undefined";
  if (isServer) {
    const w = (globalThis as any).jsDomWindow as DOMWindow;
    if (!w) {
      throw new Error("JSDOM window not available");
    }
    return w;
  } else {
    return window;
  }
};

const getXmlSerializer = () => {
  const { XMLSerializer } = getWindow();
  return new XMLSerializer();
};

const getDomParser = () => {
  const { DOMParser } = getWindow();
  return new DOMParser();
};

const XML_DECLARAION = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';

export const xmlSerializeToString = (dom: Document) => {
  const s = getXmlSerializer();
  let str = s.serializeToString(dom);

  // Some browsers (like Chrome) do not add a newline after the xml declaration
  if (str.startsWith(XML_DECLARAION + "<TEI")) {
    str = str.replace(XML_DECLARAION, XML_DECLARAION + "\n");
  }

  // JSDOM does not add an xml declaration, so we need to add it manually
  if (!str.startsWith("<?xml ")) {
    str = XML_DECLARAION + "\n" + str;
  }

  // Some browsers / OS combinations use \r\n as newline, so we need to normalize it
  str = str.replace(/\r\n/g, "\n");

  return str;
};

export const xmlParseFromString = (xml: string) => {
  const p = getDomParser();
  return p.parseFromString(xml, "text/xml");
};
