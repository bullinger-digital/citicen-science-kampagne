import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "../common/modal";
import { insertPerson, insertPlace } from "@/lib/actions/citizen";
import { useServerAction } from "../common/serverActions";
import { Loading } from "../common/loadingIndicator";
import { OptionProps } from "react-select";
import { DynamicAsyncSelect } from "../common/dynamicAsyncSelect";

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="w-60">{children}</label>
);

const WithLabel = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="flex mb-4">
    <Label>{label}</Label>
    <div className="w-full">{children}</div>
  </div>
);

const InputWithLabel = ({
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
  required = false,
  pattern,
  title,
  children,
  onFocus,
  onBlur,
}: {
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  pattern?: string;
  title?: string;
  children?: React.ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
}) => (
  <WithLabel label={label}>
    <input
      onFocus={onFocus}
      onBlur={onBlur}
      className="w-full p-1 border border-gray-300 rounded-md invalid:border-red-500"
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      pattern={pattern}
      title={title}
    />
    {children}
  </WithLabel>
);

const EMPTY_NEW_PERSON = {
  forename: "",
  surname: "",
  gnd: "",
  hist_hub: "",
  wiki: "",
};

/**
 * Modal to edit a person. If an id is provided, the person with that id is edited. Otherwise, a new person is created.
 */
export const EditPersonModal = ({
  id,
  open,
  close,
}: {
  id?: number;
  open: boolean;
  close: (savedPerson?: Awaited<ReturnType<typeof execute>>) => void;
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const { execute, loading, error } = useServerAction(insertPerson);
  const [newPerson, setNewPerson] =
    useState<Parameters<typeof execute>[0]>(EMPTY_NEW_PERSON);

  return !open ? null : (
    <Modal
      open={open}
      title={id ? "Person bearbeiten" : "Neue Person erfassen"}
      save={() => {
        if (formRef.current?.checkValidity()) {
          formRef.current?.requestSubmit();
        } else {
          formRef.current?.reportValidity();
        }
      }}
      cancel={() => {
        setNewPerson(EMPTY_NEW_PERSON);
        close();
      }}
      maxWidth={600}
    >
      {error && <div className="bg-red-100 p-2 mb-4">{error}</div>}
      {loading && <Loading />}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const savedPerson = await execute(newPerson);
          if (savedPerson) {
            close(savedPerson);
          }
        }}
        ref={formRef}
        className="max-w-2xl"
      >
        <InputWithLabel
          value={newPerson.forename}
          onChange={(e) =>
            setNewPerson({ ...newPerson, forename: e.target.value })
          }
          label="Vorname"
          placeholder="Max"
          disabled={id !== undefined}
          required
        />
        <InputWithLabel
          value={newPerson.surname}
          onChange={(e) =>
            setNewPerson({ ...newPerson, surname: e.target.value })
          }
          label="Nachname"
          placeholder="Mustermann"
          disabled={id !== undefined}
          required
        />
        <InputWithLabel
          value={newPerson.wiki}
          onChange={(e) => setNewPerson({ ...newPerson, wiki: e.target.value })}
          label="Wikipedia-Link"
          placeholder="https://de.wikipedia.org/wiki/Musterseite"
          title="Wikipedia-Link im Format https://de.wikipedia.org/wiki/Musterseite"
        />
        <GndField
          value={newPerson.gnd}
          onChange={(v) => setNewPerson({ ...newPerson, gnd: v })}
          searchTerm={[newPerson.forename, newPerson.surname]
            .filter((n) => !!n)
            .join(" ")}
        />
        <InputWithLabel
          value={newPerson.hist_hub}
          onChange={(e) =>
            setNewPerson({ ...newPerson, hist_hub: e.target.value })
          }
          label="HistHub-ID"
          placeholder="123456789"
          title="HistHub-ID im Format 123456789"
        />
      </form>
    </Modal>
  );
};

// Source: https://de.wikipedia.org/wiki/Hilfe:GND#Format_der_Personen-GND-Nummern_oder:_%E2%80%9EWas_bedeutet_das_X?%E2%80%9C
// A GND is valid if it is a number with 9 or 10 digits, whereby the last digit is the modulo checksum of the other digits.
// If the modulo is 10, the last digit is X.
const isValidGndIdentifier = (value: string) => {
  if (!/\d{8,9}[0-9X]$/.test(value)) {
    return false;
  }
  // The checksum is calculated by multiplying each digit with its index and summing up the results modulo 11.
  // I have not found a source for this, but it seems that the index is 1-based for 10-digit GNDs and 2-based for 9-digit GNDs.
  const indexShift = value.length === 10 ? 1 : 2;
  const digits = value.slice(0, -1).split("").map(Number);
  const checksum =
    digits.reduce(
      (sum, digit, index) => sum + digit * (index + indexShift),
      0
    ) % 11;
  return checksum === (value.slice(-1) === "X" ? 10 : Number(value.slice(-1)));
};

const GndOptions = (props: OptionProps<{ value: string; label: string }>) => {
  return (
    <div ref={props.innerRef} {...props.innerProps}>
      <div
        className={`p-2 cursor-pointer ${props.isFocused ? "bg-emerald-100" : ""}`}
      >
        {props.data.label}
      </div>
    </div>
  );
};

const GndField = ({
  value,
  onChange,
  searchTerm,
}: {
  value: string | undefined;
  onChange: (e: string) => void;
  searchTerm?: string;
}) => {
  const [term, setTerm] = useState(searchTerm);

  const loadOptions = useCallback(async (inputValue: string) => {
    const filter = "type:Person AND dateOfBirth:[-2000 TO 1700]";
    const res = await fetch(
      `https://lobid.org/gnd/search?q=${encodeURIComponent(
        inputValue
      )}&filter=${encodeURIComponent(filter)}&format=json`,
      {
        headers: {
          "User-Agent": "Bullinger Digital - Citizen Science Kampagne",
        },
      }
    );
    const data = await res.json();

    return data.member.map((m: any) => {
      const infoArray = [
        m.preferredName,
        m.biographicalOrHistoricalInformation,
        m.professionOrOccupation?.map((o: any) => o.label).join(", "),
        getYear(m.dateOfBirth?.[0]) + " - " + getYear(m.dateOfDeath?.[0]),
        m.placeOfActivity?.map((p: any) => p.label).join(", "),
      ].filter((i) => !!i);

      return {
        value: m.id,
        label: infoArray.join(" | "),
      };
    }) as { value: string; label: string }[];
  }, []);

  const gndId = value?.replace("https://d-nb.info/gnd/", "");

  const [gndResult, setGndResult] = useState<any | null>(null);
  useEffect(() => {
    if (gndId && typeof gndId === "string" && isValidGndIdentifier(gndId)) {
      fetch(`https://lobid.org/gnd/${encodeURIComponent(gndId)}.json`, {
        headers: {
          "User-Agent": "Bullinger Digital - Citizen Science Kampagne",
        },
      })
        .then((res) => res.json())
        .then((data) => setGndResult(data))
        .catch(() => setGndResult(null));
    } else {
      setGndResult(null);
    }
  }, [gndId]);

  return (
    <>
      <WithLabel label={"GND-ID"}>
        {value ? (
          <>
            {gndId}
            <button onClick={() => onChange("")} className="ml-2 text-red-500">
              X
            </button>
            {gndResult && (
              <a
                target="_blank"
                className="text-emerald-400"
                href={`https://d-nb.info/gnd/${value}`}
              >
                {gndResult.preferredName}
              </a>
            )}
            {gndId && !isValidGndIdentifier(gndId || "") && (
              <div>Ungültige GND-ID</div>
            )}
          </>
        ) : (
          <DynamicAsyncSelect
            inputValue={term}
            onInputChange={(v, m) => m.action === "input-change" && setTerm(v)}
            onFocus={() => {
              if (term === "") {
                setTerm(searchTerm || "");
              }
            }}
            loadOptions={loadOptions}
            components={{
              Option: GndOptions,
            }}
            isMulti={false}
            isSearchable={true}
            onChange={(e) => onChange(e?.value || "")}
          ></DynamicAsyncSelect>
        )}
      </WithLabel>

      <div className="relative"></div>
    </>
  );
};

const getYear = (date: string) => {
  // Dates can be in the format "yyyy", "yyyy-mm", "yyyy-mm-dd"
  // Return only the year
  return date?.split("-")[0] || "";
};

const EMPTY_NEW_PLACE = {
  settlement: "",
  district: "",
  country: "",
};

/**
 * Modal to edit a place. If an id is provided, the place with that id is edited. Otherwise, a new place is created.
 */
export const EditPlaceModal = ({
  id,
  open,
  close,
}: {
  id?: number;
  open: boolean;
  close: (savedPlace?: Awaited<ReturnType<typeof execute>>) => void;
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const { execute, loading, error } = useServerAction(insertPlace);
  const [newPlace, setNewPlace] =
    useState<Parameters<typeof execute>[0]>(EMPTY_NEW_PLACE);

  return !open ? null : (
    <Modal
      open={open}
      title={id ? "Ortschaft bearbeiten" : "Neue Ortschaft erfassen"}
      save={() => {
        if (formRef.current?.checkValidity()) {
          formRef.current?.requestSubmit();
        } else {
          formRef.current?.reportValidity();
        }
      }}
      cancel={() => {
        setNewPlace(EMPTY_NEW_PLACE);
        close();
      }}
      maxWidth={600}
    >
      {error && <div className="bg-red-100 p-2 mb-4">{error}</div>}
      {loading && <Loading />}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const savedPlace = await execute(newPlace);
          if (savedPlace) {
            close(savedPlace);
          }
        }}
        ref={formRef}
        className="max-w-2xl"
      >
        <InputWithLabel
          value={newPlace.settlement}
          onChange={(e) =>
            setNewPlace({ ...newPlace, settlement: e.target.value })
          }
          label="Ortschaft"
          placeholder="Zürich"
          disabled={id !== undefined}
        />
        <InputWithLabel
          value={newPlace.district}
          onChange={(e) =>
            setNewPlace({ ...newPlace, district: e.target.value })
          }
          label="Bezirk"
          placeholder=""
        />
        <InputWithLabel
          value={newPlace.country}
          onChange={(e) =>
            setNewPlace({ ...newPlace, country: e.target.value })
          }
          label="Land"
          placeholder="Schweiz"
        />
      </form>
    </Modal>
  );
};
