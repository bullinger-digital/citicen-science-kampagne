import { useCallback, useEffect } from "react";

export const useOutsideClick = (
  ref: React.RefObject<HTMLElement>,
  onOutsideClick: (e: MouseEvent) => void
) => {
  const handleOutsideClick = useCallback(
    (e: MouseEvent) => {
      if (
        ref.current &&
        e.target instanceof Node &&
        !ref.current.contains(e.target)
      ) {
        onOutsideClick(e);
      }
    },
    [ref, onOutsideClick]
  );

  useEffect(() => {
    window.addEventListener("click", handleOutsideClick);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
    };
  });
};
