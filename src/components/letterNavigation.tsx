"use client";

import {
  ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FaAnglesLeft, FaAnglesRight, FaDice } from "react-icons/fa6";
import { IoFilterSharp } from "react-icons/io5";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useOutsideClick } from "./common/useOutsideClick";
import { useServerFetch } from "./common/serverActions";
import {
  LetterNavigationFilter,
  letterNavigation,
  letterProgressList,
  personById,
  searchPerson,
} from "@/lib/actions/citizen";
import { usePathname } from "next/navigation";
import { Link } from "./common/navigation-block/link";
import { DynamicAsyncSelect } from "./common/dynamicAsyncSelect";
import { useUser } from "@auth0/nextjs-auth0/client";
import Modal from "./common/modal";
import { Loading } from "./common/loadingIndicator";
import { MdOutlineCheckBox } from "react-icons/md";

const INPUT_CLASSNAMES =
  "w-full px-2 py-2 border-b-2 border-gray-300 outline-none focus:border-beige-500 placeholder-gray-300 text-gray-700";

const DEFAULT_FILTER: LetterNavigationFilter = {
  status: "!finished",
};

const useLocalStorage = <T,>(key: string, fallbackValue: T) => {
  const [value, setValue] = useState<T>(fallbackValue);

  // Read from localstorage on first render
  useEffect(() => {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      setValue(JSON.parse(storedValue));
    }
  }, [setValue, key, fallbackValue]);

  const setStoredValue = (newValue: T) => {
    setValue(newValue);
    localStorage.setItem(key, JSON.stringify(newValue));
  };

  return [value, setStoredValue] as const;
};

export const LetterNavigation = () => {
  const [showFilter, setShowFilter] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const session = useUser();

  // Read filter from localstorage if available; otherwise use DEFAULT_FILTER
  const [filter, setFilter] = useLocalStorage(
    "letterNavigationFilter-v2",
    DEFAULT_FILTER
  );

  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const pathname = usePathname();
  const current_letter_id = parseInt(pathname?.split("/").pop() || "");

  const { data, error, loading, refetch } = useServerFetch(
    letterNavigation,
    {
      filter: filter,
      current_letter_id: current_letter_id,
    },
    {
      skip: !session.user,
    }
  );

  useOutsideClick(
    filterButtonRef,
    useCallback(() => setShowFilter(false), [setShowFilter])
  );

  return !session.user ? (
    <div className="border-l border-gray-300">&nbsp;</div>
  ) : (
    <div className="flex">
      <div className="flex bg-blue-100 rounded-lg relative">
        <NavigationButton
          ref={filterButtonRef}
          label="Filter"
          onClick={() => setShowFilter(!showFilter)}
          showActiveIcon={Object.entries(filter).some(
            ([k, v]) => v !== (DEFAULT_FILTER as any)[k]
          )}
        >
          <IoFilterSharp className="text-2xl" />
        </NavigationButton>
        <div
          onClick={(e) => e.stopPropagation()}
          className={`text-left absolute top-full w-96 z-40 bg-white shadow-2xl p-3 border-gray-200 border text-base ${showFilter ? "block" : "hidden"}`}
        >
          <FilterWithLabel label="Briefsprache">
            <select
              className={INPUT_CLASSNAMES}
              value={filter.language || ""}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  language: e.target.value ? e.target.value : undefined,
                })
              }
            >
              <option value="">Sprache auswählen</option>
              <option value="la">Latein</option>
              <option value="de">Deutsch</option>
              <option value="el">Griechisch</option>
              <option value="fr">Französisch</option>
              <option value="he">Hebräisch</option>
              <option value="it">Italienisch</option>
              <option value="en">Englisch</option>
            </select>
          </FilterWithLabel>
          <FilterWithLabel label="Korrespondent">
            <PersonDropdown
              personId={filter.person_id}
              onChange={(personId) =>
                setFilter({
                  ...filter,
                  person_id: personId,
                })
              }
            />
          </FilterWithLabel>
          <FilterWithLabel label="Brief-Status">
            <select
              className={INPUT_CLASSNAMES}
              value={filter.status || ""}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  status: e.target.value ? e.target.value : undefined,
                })
              }
            >
              <option value="!finished">Zu bearbeiten</option>
              <option value="finished">Abgeschlossen</option>
              <option value="low-hanging-fruit">
                Briefe mit einer einzigen fehlenden Referenz
              </option>
              <option value="">Alle</option>
            </select>
          </FilterWithLabel>

          <div className="flex justify-end">
            <a
              className=" bg-emerald-100 hover:bg-emerald-200 py-2 px-3 first:rounded-l-md last:rounded-r-md"
              onClick={() => {
                setFilter(DEFAULT_FILTER);
              }}
            >
              Filter zurücksetzen
            </a>
            <Link
              className={`${data?.random ? "bg-emerald-300 hover:bg-emerald-400" : "bg-gray-200 text-gray-400"} py-2 px-3 first:rounded-l-md last:rounded-r-md`}
              aria-disabled={!data?.random}
              href={data?.random ? `/letter/${data?.random}` : ""}
              title="Mit zufälligem Brief beginnen"
              onClick={(e) =>
                data?.random ? setShowFilter(false) : e.preventDefault()
              }
            >
              Loslegen
            </Link>
          </div>
        </div>
        <NavigationButton
          label="Zufälligen Brief auswählen"
          href={`/letter/${data?.random}`}
          disabled={!data?.random}
        >
          <FaDice className="text-3xl" />
        </NavigationButton>
        <NavigationButton
          label="Erster Brief"
          href={data?.first ? `/letter/${data.first}` : undefined}
          disabled={!data?.first || data?.first === current_letter_id}
        >
          <FaAnglesLeft className="text-2xl" />
        </NavigationButton>
        <NavigationButton
          label="Vorheriger Brief"
          href={data?.previous ? `/letter/${data.previous}` : undefined}
          disabled={!data?.previous}
        >
          <FaChevronLeft className="text-2xl" />
        </NavigationButton>
        <NavigationButton
          label="Nächster Brief"
          href={data?.next ? `/letter/${data?.next}` : undefined}
          disabled={!data?.next}
        >
          <FaChevronRight className="text-2xl" />
        </NavigationButton>
        <NavigationButton
          label="Letzter Brief"
          href={data?.last ? `/letter/${data.last}` : undefined}
          disabled={!data?.last || data?.last === current_letter_id}
        >
          <FaAnglesRight className="text-2xl" />
        </NavigationButton>
        <NavigationButton
          className="text-sm flex items-center pl-2 pr-4"
          label="Briefe mit den gewählten Filter-Kriterien"
          onClick={() => setShowProgressModal(true)}
        >
          <MdOutlineCheckBox className="inline-block text-xl -mt-1" />{" "}
          {data?.count} Briefe
        </NavigationButton>
        {showProgressModal && (
          <ProgressModal
            currentLetter={current_letter_id}
            close={() => setShowProgressModal(false)}
            filters={filter}
          />
        )}
      </div>
    </div>
  );
};

const ProgressModal = ({
  currentLetter,
  filters,
  close,
}: {
  currentLetter?: number;
  filters: LetterNavigationFilter;
  close: () => void;
}) => {
  const [sortBy, setSortBy] = useState<"extract_date" | "id">("extract_date");
  const { data, loading, error } = useServerFetch(letterProgressList, {
    filter: filters,
    sortBy: sortBy,
  });

  return (
    <Modal
      closeOnOutsideClick={true}
      cancel={close}
      open={true}
      title={
        <span>
          Fortschritts-Übersicht für die gewählten Filter{" "}
          <IoFilterSharp className="inline-block -mt-1" />
        </span>
      }
    >
      <div>
        Sortiert nach{" "}
        <select
          className="mb-4 bg-slate-100"
          onChange={(e) => setSortBy(e.currentTarget.value as any)}
          value={sortBy}
        >
          <option value="extract_date">Datum</option>
          <option value="id">Brief-ID</option>
        </select>
      </div>
      {loading && <Loading />}
      {error && <div>{error}</div>}
      {data && !loading && (
        <>
          <div className="mb-3 text-sm flex justify-between">
            <div>{data.length} Briefe</div>
            <ul className="flex space-x-4 items-center">
              <li className="flex items-center">
                <span
                  className={`inline-block mr-1 w-4 h-4 ${mapColor({ extract_status: "touched", extract_names_without_ref_count: 1 })}`}
                ></span>
                Eine fehlende Referenz (
                {
                  data.filter(
                    (a) =>
                      a.extract_names_without_ref_count === 1 &&
                      a.extract_status !== "finished"
                  ).length
                }
                )
              </li>
              <li className="flex items-center">
                <span
                  className={`inline-block mr-1 w-4 h-4 ${mapColor({ extract_status: "touched" })}`}
                ></span>
                Noch nicht abgeschlossen (
                {data.filter((a) => a.extract_status === "touched").length})
              </li>
              <li className="flex items-center">
                <span
                  className={`inline-block mr-1 w-4 h-4 ${mapColor({ extract_status: "finished" })}`}
                ></span>
                Abgeschlossen (
                {data.filter((a) => a.extract_status === "finished").length})
              </li>
            </ul>
          </div>
          <LetterGrid
            currentLetter={currentLetter}
            close={close}
            letters={data}
          />
        </>
      )}
    </Modal>
  );
};

const mapColor = ({
  extract_status,
  extract_names_without_ref_count,
}: {
  extract_status: string | null;
  extract_names_without_ref_count?: number | null;
}) => {
  if (extract_status === "finished")
    return "bg-emerald-400 hover:bg-emerald-600";
  if (extract_names_without_ref_count === 1)
    return "bg-yellow-200 hover:bg-yellow-400";
  if (extract_status === "touched") return "bg-slate-300 hover:bg-slate-500";
  return "bg-gray-300 hover:bg-gray-500";
};

const LetterGrid = ({
  currentLetter,
  letters,
  close,
}: {
  currentLetter?: number;
  letters: Awaited<ReturnType<typeof letterProgressList>>;
  close: () => void;
}) => {
  return (
    <div className="leading-[0.2]">
      {letters.map((d) => {
        const missingRefs = d.extract_names_without_ref_count;
        return (
          <Link
            onClick={() => close()}
            href={`/letter/${d.id}`}
            className={`inline-block relative mx-[1px] my-[1px] w-4 h-4 ${mapColor(d) || ""} ${currentLetter === d.id ? "outline outline-1 outline-gray-500" : ""}`}
            key={d.id}
            title={`${d.id} - ${d.extract_date_string}, ${missingRefs} fehlende Referenzen`}
          >
            {!!missingRefs && (
              <span className="overflow-hidden block absolute top-0 left-0 h-full w-full text-xs text-center text-gray-500">
                {missingRefs >= 10 ? ">" : missingRefs}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
};

type NavigationButtonProps = {
  children: ReactNode;
  label: string;
  onClick?: () => void | undefined;
  href?: string;
  disabled?: boolean;
  showActiveIcon?: boolean;
  className?: string;
};

const NavigationButton = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  NavigationButtonProps
>(function NavigationButton(props, ref) {
  const Component = props.href && !props.disabled ? Link : "button";
  return (
    <Component
      title={props.label}
      ref={ref as any}
      href={props.href!}
      className={`text-sm min-w-12 h-12 relative first:rounded-l-lg last:rounded-r-lg hover:bg-blue-200 flex items-center justify-center disabled:text-gray-300 ${props.className ? props.className : ""}`}
      onClick={(e) => !props.disabled && props.onClick && props.onClick()}
      aria-label={props.label}
      disabled={props.disabled}
    >
      <div>{props.children}</div>
      {props.showActiveIcon && (
        <div
          title="Filter aktiv"
          className="absolute z-30 -top-1 -right-1 w-4 h-4 rounded-full bg-red-300"
        ></div>
      )}
    </Component>
  );
});

const FilterWithLabel = ({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) => (
  <div className="mb-5 last:mb-0">
    <label className="w-40 shrink-0 grow-0 text-gray-400 text-sm">
      {label}
    </label>
    <div>{children}</div>
  </div>
);

const personDisplayName = (
  p:
    | Awaited<ReturnType<typeof personById>>
    | Awaited<ReturnType<typeof searchPerson>>["result"][0]
) => {
  return `${p?.forename} ${p?.surname}`;
};

const PersonDropdown = ({
  personId,
  onChange,
}: {
  personId: number | null | undefined;
  onChange: (personId: number | null | undefined) => void;
}) => {
  const { data: selectedPerson } = useServerFetch(
    personById,
    { id: personId?.toString() || "" },
    { skip: !personId }
  );

  const fetchOptions = useCallback(async (v: string) => {
    const res = await searchPerson({
      query: v,
      includeOnlyCorrespondents: true,
    });
    return res.result.map((p) => {
      return {
        value: p.id,
        label: personDisplayName(p),
      };
    });
  }, []);

  return (
    <DynamicAsyncSelect
      noOptionsMessage={() =>
        "Geben Sie einen Namen ein, um Korrespondenten zu suchen."
      }
      placeholder="Korrespondent suchen"
      value={
        selectedPerson
          ? { value: personId, label: personDisplayName(selectedPerson) }
          : null
      }
      onChange={(v) => onChange((v as any)?.value)}
      isClearable
      defaultOptions={false}
      loadOptions={fetchOptions}
    />
  );
};
