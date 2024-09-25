import { useState, useCallback, useEffect, ComponentType } from "react";
import { debounce } from "./debounce";
import { Loading } from "./loadingIndicator";
import { FaSearch } from "react-icons/fa";

export const SearchInput = <T,>({
  fallbackTerm,
  searchFn,
  onSelect,
  SelectionComponent,
  InputComponent,
  noResultsText = "Keine Ergebnisse gefunden",
}: {
  fallbackTerm: string | undefined;
  searchFn: (term: string) => Promise<T[]>;
  onSelect: (result: T) => void;
  SelectionComponent: ({
    item,
    isFocused,
  }: {
    item: T;
    isFocused: boolean;
  }) => React.ReactNode;
  InputComponent?: ComponentType<
    React.DetailedHTMLProps<
      React.InputHTMLAttributes<HTMLInputElement>,
      HTMLInputElement
    >
  >;
  noResultsText?: React.ReactNode;
}) => {
  const [results, setResults] = useState<T[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [term, setTerm] = useState("");
  const [hasFocus, setHasFocus] = useState(false);
  const [focusedItem, setFocusedItem] = useState<T | null | undefined>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(
    async (t: string | undefined) => {
      if (!t) return;
      searchFn(t)
        .then((res) => {
          setErrors([]);
          setResults(res);
          setIsLoading(false);
          setFocusedItem(res[0]);
        })
        .catch((e) => {
          setErrors([e.message]);
          setResults([]);
          setIsLoading(false);
        });
    },
    [searchFn]
  );

  /* eslint-disable react-hooks/exhaustive-deps */
  const debouncedLoad = useCallback(debounce(load, 500), [load]);

  useEffect(() => {
    if (!hasFocus) {
      return;
    }
    if (term || fallbackTerm) {
      setIsLoading(true);
      debouncedLoad(term || fallbackTerm);
    } else {
      setResults(null);
    }
  }, [term, fallbackTerm, hasFocus, load]);

  const Input = InputComponent || "input";

  return (
    <div
      onFocus={() => setHasFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setHasFocus(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setHasFocus(false);
        }
        if (e.key === "ArrowDown") {
          const index = focusedItem ? results?.indexOf(focusedItem)! : -1;
          setFocusedItem(results?.[index + 1]);
        }
        if (e.key === "ArrowUp") {
          const index = focusedItem ? results?.indexOf(focusedItem)! : 1;
          setFocusedItem(results?.[index - 1]);
        }
        if (e.key === "Enter") {
          if (focusedItem) onSelect(focusedItem);
          setHasFocus(false);
        }
      }}
    >
      <div className="relative">
        <div className="text-gray-400 pb-2">Nicht zugewiesen</div>
        <div className="flex items-center space-x-2">
          <FaSearch className="text-gray-400" />
          <Input
            value={term}
            onChange={(v) => setTerm(v.currentTarget.value)}
            placeholder="Suche"
          />
        </div>
        {
          <div className="absolute z-[501] text-sm bg-gray-50 overflow-auto max-h-72 w-full shadow-2xl">
            {isLoading && (
              <div className="w-full">
                <Loading />
              </div>
            )}
            {!isLoading &&
              hasFocus &&
              results?.map((m, i) => {
                return (
                  <button
                    className="w-full text-left cursor-pointer"
                    key={i}
                    onClick={(e) => {
                      onSelect(m);
                      e.preventDefault();
                      e.stopPropagation();
                      setHasFocus(false);
                    }}
                    onMouseEnter={() => setFocusedItem(m)}
                    onMouseLeave={() => setFocusedItem(null)}
                  >
                    <SelectionComponent
                      item={m}
                      isFocused={m === focusedItem}
                    />
                  </button>
                );
              })}
            {!isLoading && hasFocus && results?.length === 0 && (
              <div className="text-gray-300 p-2">{noResultsText}</div>
            )}
            {!isLoading &&
              hasFocus &&
              errors.length > 0 &&
              errors.map((e, i) => (
                <div key={i} className="text-red-300 p-2">
                  Bei der Suche ist ein Fehler aufgetreten. Möglicherweise ist
                  der externe Dienst nicht verfügbar. Details: {e}
                </div>
              ))}
          </div>
        }
      </div>
    </div>
  );
};
