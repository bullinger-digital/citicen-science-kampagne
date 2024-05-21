import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "../../common/modal";
import {
  insertOrUpdatePerson,
  insertOrUpdatePlace,
  personById,
  placeById,
} from "@/lib/actions/citizen";
import { useServerAction } from "../../common/serverActions";
import { Loading } from "../../common/loadingIndicator";
import { TiDeleteOutline } from "react-icons/ti";
import { SearchInput } from "../../common/searchInput";
import { getSingleGndResult, isValidGndIdentifier, searchGnd } from "./gnd";
import { searchHistHub, singleHistHubResult } from "./histHub";
import dynamic from "next/dynamic";
const LeafletMap = dynamic(() => import("./map").then((m) => m.LeafletMap), {
  ssr: false,
});

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
  id?: number | null;
  open: boolean;
  close: (savedPerson?: Awaited<ReturnType<typeof execute>>) => void;
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const { execute, loading, error } = useServerAction(insertOrUpdatePerson);
  const [isLoading, setIsLoading] = useState(false);
  const [newPerson, setNewPerson] =
    useState<Parameters<typeof execute>[0]>(EMPTY_NEW_PERSON);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      personById({ id: id.toString() }).then((p) => {
        const primaryAlias = p.aliases.find((a) => a.type === "main");
        setNewPerson({
          forename: primaryAlias?.forename || "",
          surname: primaryAlias?.surname || "",
          gnd: p.gnd || "",
          hist_hub: p.hist_hub || "",
          wiki: p.wiki || "",
        });
        setIsLoading(false);
      });
    }
  }, [id]);

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
      {(loading || isLoading) && <Loading />}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const savedPerson = await execute({
            ...newPerson,
            id: id,
          });
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
  const histHubId = value?.replace("https://data.histhub.ch/person/", "");

  const [histHubResult, setHistHubResult] = useState<any | null>(null);
  useEffect(() => {
    if (histHubId && typeof histHubId === "string") {
      singleHistHubResult(histHubId)
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
          searchFn={searchHistHub}
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

const GndField = ({
  value,
  onChange,
  searchTerm,
}: {
  value: string | undefined;
  onChange: (e: string) => void;
  searchTerm?: string;
}) => {
  const gndId = value?.replace("https://d-nb.info/gnd/", "");

  const [gndResult, setGndResult] = useState<any | null>(null);
  useEffect(() => {
    if (gndId && typeof gndId === "string" && isValidGndIdentifier(gndId)) {
      getSingleGndResult(gndId)
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
          searchFn={searchGnd}
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
  id?: number | null;
  open: boolean;
  close: (savedPlace?: Awaited<ReturnType<typeof execute>>) => void;
}) => {
  const formRef = useRef<HTMLFormElement>(null);

  const { execute, loading, error } = useServerAction(insertOrUpdatePlace);
  const [isLoading, setIsLoading] = useState(false);

  const [newPlace, setNewPlace] =
    useState<Parameters<typeof execute>[0]>(EMPTY_NEW_PLACE);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      placeById({ id: id.toString() }).then((p) => {
        setNewPlace(p);
        setIsLoading(false);
      });
    }
  }, [id]);

  const setPosition = useCallback(
    (position: [number, number]) => {
      setNewPlace({
        ...newPlace,
        latitude: position[0],
        longitude: position[1],
      });
    },
    [setNewPlace, newPlace]
  );

  return !open ? null : (
    <Modal
      open={open}
      title={id ? `Ortschaft ${id} bearbeiten` : "Neue Ortschaft erfassen"}
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
      {(loading || isLoading) && <Loading />}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const savedPlace = await execute({
            ...newPlace,
            id: id,
          });
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
        <div>
          Karte &mdash; {newPlace.latitude?.toFixed(7)},{" "}
          {newPlace.longitude?.toFixed(7)}
          {newPlace.latitude && newPlace.longitude && (
            <LeafletMap
              position={[newPlace.latitude, newPlace.longitude]}
              readOnly={false}
              setPosition={setPosition}
            />
          )}
        </div>
      </form>
    </Modal>
  );
};
