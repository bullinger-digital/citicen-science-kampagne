import { useEffect } from "react";

export const useNodeObserver = (
  node: Element | Node | null | undefined,
  outerCallback: () => void
) => {
  useEffect(() => {
    if (typeof node === "undefined" || node === null) {
      return;
    }

    const config: MutationObserverInit = {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    };

    const callback: MutationCallback = (_mutationList, _observer) => {
      outerCallback();
    };

    const observer = new MutationObserver(callback);
    observer.observe(node as Node, config);
    return () => {
      observer.disconnect();
    };
  }, [node, outerCallback]);

  return {};
};
