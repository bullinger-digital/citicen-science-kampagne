interface Node {
  getAttribute(attr: string): string;
  setAttribute(attr: string, value: string): void;
  removeAttribute(attr: string): void;
}
