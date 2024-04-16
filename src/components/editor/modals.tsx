import { useEffect, useRef, useState } from "react";
import Modal from "../common/modal";
import { insertPerson, insertPlace } from "@/lib/actions/citizen";
import { useServerAction } from "../common/serverActions";
import { Loading } from "../common/loadingIndicator";

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="w-60">{children}</label>
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
}) => (
  <div className="flex mb-4">
    <Label>{label}</Label>
    <div className="w-full">
      <input
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
    </div>
  </div>
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
        <GndField
          value={newPerson.gnd}
          onChange={(v) => setNewPerson({ ...newPerson, gnd: v })}
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
        <InputWithLabel
          value={newPerson.wiki}
          onChange={(e) => setNewPerson({ ...newPerson, wiki: e.target.value })}
          label="Wikipedia-Link"
          placeholder="https://de.wikipedia.org/wiki/Musterseite"
          title="Wikipedia-Link im Format https://de.wikipedia.org/wiki/Musterseite"
        />
      </form>
    </Modal>
  );
};

const GndField = ({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (e: string) => void;
}) => {
  const [gndResult, setGndResult] = useState<any | null>(null);
  useEffect(() => {
    if (value && typeof value === "string" && value.match(/^\d{9}$/)) {
      fetch(`https://lobid.org/gnd/${value}.json`, {
        headers: {
          "User-Agent": "Bullinger Digital - Citizen Science Kampagne",
        },
      })
        .then((res) => res.json())
        .then((data) => setGndResult(data));
    }
  }, [value]);

  return (
    <>
      <InputWithLabel
        value={value}
        onChange={(v) => onChange(v.currentTarget.value)}
        label="GND-ID"
        placeholder="123456789"
        title="GND-ID im Format 123456789"
      >
        {gndResult && (
          <a
            target="_blank"
            className="text-emerald-400"
            href={`https://d-nb.info/gnd/${value}`}
          >
            {gndResult.preferredName}
          </a>
        )}
      </InputWithLabel>
    </>
  );
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
          required
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
