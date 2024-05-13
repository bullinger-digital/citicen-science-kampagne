import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "../common/modal";
import { insertPerson, insertPlace } from "@/lib/actions/citizen";
import { useServerAction } from "../common/serverActions";
import { Loading } from "../common/loadingIndicator";
import { TiDeleteOutline } from "react-icons/ti";
import { SearchInput } from "../common/searchInput";

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

const InputField = ({
  ...props
}: React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>) => (
  <input
    className="w-full p-1 border border-gray-300 rounded-md invalid:border-red-500"
    {...props}
  />
);

const InputWithLabel = ({
  label,
  ...props
}: {
  label: string;
} & React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>) => (
  <WithLabel label={label}>
    <InputField {...props} />
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
        <HistHubField
          value={newPerson.hist_hub}
          onChange={(v) => setNewPerson({ ...newPerson, hist_hub: v })}
          searchTerm={[newPerson.forename, newPerson.surname]
            .filter((n) => !!n)
            .join(" ")}
        />
      </form>
    </Modal>
  );
};

const HistHubField = ({
  value,
  onChange,
  searchTerm,
}: {
  value: string | undefined;
  onChange: (e: string) => void;
  searchTerm?: string;
}) => {
  const loadOptions = useCallback(async (inputValue: string) => {
    const res = await fetch(`https://data.histhub.ch/api/search/person/`, {
      headers: {
        "User-Agent": "Bullinger Digital - Citizen Science Kampagne",
      },
      method: "POST",
      body: JSON.stringify({
        version: 1,
        "names.fullname": inputValue,
      }),
    });
    const data = await res.json();
    console.log(data);
    return data.map((m: any) => {
      const infoArray = [
        m.label_name,
        m.titles?.map((t: any) => t?.term?.labels?.deu).join(", "),
        m.occupations?.map((a: any) => a?.term?.labels?.deu).join(", "),
        getYear(m.existences?.[0]?.start?.date) +
          "-" +
          getYear(m.existences?.[0]?.end?.date),
      ].filter((i) => !!i);

      return {
        value: "https://data.histhub.ch/person/" + m.hhb_id,
        label: infoArray.join(" | "),
      };
    }) as { value: string; label: string }[];
  }, []);

  const histHubId = value?.replace("https://data.histhub.ch/person/", "");

  const [histHubResult, setHistHubResult] = useState<any | null>(null);
  useEffect(() => {
    if (histHubId && typeof histHubId === "string") {
      fetch(
        `https://data.histhub.ch/api/person/${encodeURIComponent(histHubId)}`,
        {
          headers: {
            "User-Agent": "Bullinger Digital - Citizen Science Kampagne",
          },
        }
      )
        .then((res) => res.json())
        .then((data) => setHistHubResult(data))
        .catch(() => setHistHubResult(null));
    } else {
      setHistHubResult(null);
    }
  }, [histHubId]);

  return (
    <WithLabel label={"HistHub-ID"}>
      {value ? (
        <div className="flex justify-between">
          <div>
            {histHubId}
            {histHubResult && (
              <div>
                <a
                  target="_blank"
                  className="text-emerald-400"
                  href={`https://data.histhub.ch/person/${histHubId}`}
                >
                  {histHubResult.label_name}
                </a>
              </div>
            )}
            {/* {gndId && !isValidGndIdentifier(gndId || "") && (
              <div>Ungültige GND-ID</div>
            )} */}
          </div>
          <button
            onClick={() => onChange("")}
            className="ml-2 text-2xl p-2 text-emerald-400"
            title="HistHub-ID entfernen"
          >
            <TiDeleteOutline />
          </button>
        </div>
      ) : (
        <SearchInput
          fallbackTerm={searchTerm}
          searchFn={loadOptions}
          onSelect={(result) => onChange(result.value)}
          SelectionComponent={({ item, isFocused }) => {
            return (
              <div className={`p-2 ${isFocused ? "bg-emerald-100" : ""}`}>
                <div>{item.label}</div>
                <div>{item.value}</div>
              </div>
            );
          }}
          InputComponent={InputField}
        ></SearchInput>
      )}
    </WithLabel>
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

const GndField = ({
  value,
  onChange,
  searchTerm,
}: {
  value: string | undefined;
  onChange: (e: string) => void;
  searchTerm?: string;
}) => {
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
    <WithLabel label={"GND-ID"}>
      {value ? (
        <div className="flex justify-between">
          <div>
            {gndId}
            {gndResult && (
              <div>
                <a
                  target="_blank"
                  className="text-emerald-400"
                  href={`https://d-nb.info/gnd/${gndId}`}
                >
                  {gndResult.preferredName}
                </a>
              </div>
            )}
            {gndId && !isValidGndIdentifier(gndId || "") && (
              <div>Ungültige GND-ID</div>
            )}
          </div>
          <button
            onClick={() => onChange("")}
            className="ml-2 text-2xl p-2 text-emerald-400"
            title="GND-ID entfernen"
          >
            <TiDeleteOutline />
          </button>
        </div>
      ) : (
        <SearchInput
          fallbackTerm={searchTerm}
          searchFn={loadOptions}
          onSelect={(result) => onChange(result.value)}
          SelectionComponent={({ item, isFocused }) => {
            return (
              <div className={`p-2 ${isFocused ? "bg-emerald-100" : ""}`}>
                <div>{item.label}</div>
                <div>{item.value}</div>
              </div>
            );
          }}
          InputComponent={InputField}
        ></SearchInput>
      )}
    </WithLabel>
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
