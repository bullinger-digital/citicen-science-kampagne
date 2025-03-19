import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "../../common/modal";
import {
  insertOrUpdatePerson,
  insertOrUpdatePlace,
  personById,
  placeById,
} from "@/lib/actions/citizen";
import { useServerAction, useServerFetch } from "../../common/serverActions";
import { Loading } from "../../common/loadingIndicator";
import { TiDeleteOutline } from "react-icons/ti";
import { SearchInput } from "../../common/searchInput";
import { isValidGndIdentifier, searchGnd } from "./gnd";
import { searchMetagrid, singleMetagridResult } from "./metaGrid";
import dynamic from "next/dynamic";
import { Comments } from "@/components/common/comments";
import { FaChevronDown, FaChevronUp } from "react-icons/fa6";
import {
  EntityUsagesModalTrigger,
  PersonItemDetails,
  PlaceItemDetails,
} from "../properties";
import { getGeoname, searchGeonames } from "@/lib/actions/geonames";
import type { Geoname } from "@/lib/actions/geonames";
import { getSingleGndResult } from "@/lib/actions/gnd";
import { IoWarning } from "react-icons/io5";
import { Versioned } from "@/lib/versioning";
import { useUser } from "@auth0/nextjs-auth0/client";
import { isInRole } from "@/lib/security/isInRole";
import { AliasesField } from "./aliases";
const LeafletMap = dynamic(() => import("./map").then((m) => m.LeafletMap), {
  ssr: false,
});

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="w-60">{children}</label>
);

export const WithLabel = ({
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

export const InputField = ({
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
  hls: "",
  hist_hub: "",
  wiki: "",
  portrait: "",
  aliases: [],
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
  close: (personId?: number) => void;
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const { execute, loading, error } = useServerAction(insertOrUpdatePerson);
  const [isLoading, setIsLoading] = useState(false);
  const [newPerson, setNewPerson] =
    useState<Parameters<typeof execute>[0]>(EMPTY_NEW_PERSON);
  const [usages, setUsages] = useState<number | null | undefined>();
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const user = useUser();
  const isAdmin = isInRole(user, "admin");

  useEffect(() => {
    if (id) {
      setLoadingError(null);
      setIsLoading(true);
      personById({ id: id.toString() }).then((p) => {
        if (!p) {
          setLoadingError("Person nicht gefunden");
          setIsLoading(false);
          return;
        }
        setNewPerson({
          forename: p.forename || "",
          surname: p.surname || "",
          gnd: p.gnd || "",
          hls: p.hls || "",
          hist_hub: p.hist_hub || "",
          wiki: p.wiki || "",
          portrait: p.portrait || "",
          aliases: p.aliases || [],
        });
        setUsages(p.computed_link_counts);
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
      maxWidth={700}
    >
      <EditWarning table={"person"} id={id} usages={usages} />
      {(error || loadingError) && (
        <div className="bg-red-100 p-2 mb-4">
          {error} {loadingError}
        </div>
      )}
      {(loading || isLoading) && <Loading />}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const savedPerson = await execute({
            ...newPerson,
            id: id,
          });
          if (savedPerson) {
            close(savedPerson.id);
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
        />
        <InputWithLabel
          value={newPerson.surname}
          onChange={(e) =>
            setNewPerson({ ...newPerson, surname: e.target.value })
          }
          label="Nachname"
          placeholder="Mustermann"
        />
        {isAdmin && (
          <AliasesField
            value={newPerson.aliases}
            onChange={(v) => setNewPerson({ ...newPerson, aliases: v })}
          />
        )}
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
        {!id && (
          <PersonMightAlreadyExistHint
            gnd={newPerson.gnd}
            onUseExisting={(id) => close(id)}
          />
        )}
        <InputWithLabel
          value={newPerson.hls || ""}
          onChange={(e) => setNewPerson({ ...newPerson, hls: e.target.value })}
          label="HLS-Link"
          placeholder="https://hls-dhs-dss.ch/de/articles/000000/0000-00-00/"
          title="HLS-Link im Format https://hls-dhs-dss.ch/de/articles/000000/0000-00-00/"
        />
        {/* <MetaGridField
          value={newPerson.meta_grid}
          onChange={(v) => setNewPerson({ ...newPerson, meta_grid: v })}
          searchTerm={[newPerson.forename, newPerson.surname]
            .filter((n) => !!n)
            .join(" ")}
        /> */}
        {/* Todo: before enabling this (for admins first), make sure diffs are visible in the admin panel */}
        {/* <WithLabel label="Namensvarianten">
          <ul>
            {newPerson.aliases.map((alias, i) => (
              <li key={i}>
                {alias.forename} {alias.surname}{" "}
                <button
                  onClick={(e) => {
                    setNewPerson({
                      ...newPerson,
                      aliases: newPerson.aliases.filter((_, j) => j !== i),
                    });
                    e.preventDefault();
                  }}
                  className="text-emerald-400"
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        </WithLabel> */}
      </form>
      {id && <CommentsWrapper target={"person/" + id.toString()} />}
    </Modal>
  );
};

const PersonMightAlreadyExistHint = ({
  gnd,
  onUseExisting,
}: {
  gnd?: string;
  onUseExisting: (id: number) => void;
}) => {
  const existing = useServerFetch(
    personById,
    {
      gnd: gnd,
      includeGndData: true,
    },
    {
      skip: !gnd,
    }
  );

  if (existing.loading || !existing.data) {
    return null;
  }

  if (existing.data.id) {
    return (
      <div className="bg-yellow-100 p-2 mb-4 text-sm">
        <div className="flex space-x-2">
          <IoWarning className="text-lg" />
          <span>Es existiert bereits eine Person mit dieser GND-ID</span>
        </div>
        <div className="pl-4 pt-2 pb-4">
          <button
            onClick={() => onUseExisting(existing.data!.id!)}
            className="underline pb-2 rounded-sm text-emerald-400"
          >
            Diese Person verwenden, anstatt neu zu erfassen
          </button>
          <PersonItemDetails
            id={existing.data.id.toString()}
            isPreview={true}
          />
        </div>
      </div>
    );
  }
};

const PlaceMightAlreadyExistHint = ({
  geonames,
  onUseExisting,
}: {
  geonames?: string;
  onUseExisting: (id: number) => void;
}) => {
  const existing = useServerFetch(
    placeById,
    {
      geonames: geonames!,
    },
    {
      skip: !geonames,
    }
  );

  if (existing.loading || !existing.data) {
    return null;
  }

  if (existing.data.id) {
    return (
      <div className="bg-yellow-100 p-2 mb-4 text-sm">
        <div className="flex space-x-2">
          <IoWarning className="text-lg" />
          <span>
            Es existiert bereits eine Ortschaft mit dieser Geonames-ID
          </span>
        </div>
        <div className="pl-4 pt-2 pb-4">
          <button
            onClick={() => onUseExisting(existing.data!.id!)}
            className="underline pb-2 rounded-sm text-emerald-400"
          >
            Diese Ortschaft verwenden, anstatt neu zu erfassen
          </button>
          <PlaceItemDetails id={existing.data.id.toString()} isPreview={true} />
        </div>
      </div>
    );
  }
};

export const CommentsWrapper = ({
  target,
  commentCount,
}: {
  target: string;
  commentCount?: number;
}) => {
  const [showComments, setShowComments] = useState(false);

  return (
    <div className="mt-4">
      <button
        className="text-gray-600"
        onClick={() => setShowComments(!showComments)}
      >
        {showComments ? (
          <>
            <FaChevronUp className="inline-block" /> Kommentare ausblenden{" "}
          </>
        ) : (
          <>
            <FaChevronDown className="inline-block" /> Kommentare anzeigen{" "}
          </>
        )}
        {commentCount !== undefined && commentCount > 0 && (
          <span className="rounded-full bg-red-200 px-2">{commentCount}</span>
        )}
      </button>

      {showComments && (
        <div>
          <Comments target={target} />
        </div>
      )}
    </div>
  );
};

const MetaGridField = ({
  value,
  onChange,
  searchTerm,
}: {
  value: string | undefined;
  onChange: (e: string) => void;
  searchTerm?: string;
}) => {
  const metaGridId = value?.replace(
    /https?\:\/\/api\.metagrid\.ch\/concordance\/(.+)\/.json/gi,
    "$1"
  );

  const [metaGridResult, setMetaGridResult] = useState<any | null>(null);
  useEffect(() => {
    if (metaGridId && typeof metaGridId === "string") {
      singleMetagridResult(metaGridId)
        .then((data) => setMetaGridResult(data))
        .catch(() => setMetaGridResult(null));
    } else {
      setMetaGridResult(null);
    }
  }, [metaGridId]);

  return (
    <WithLabel label={"MetaGrid-ID"}>
      {value ? (
        <div className="flex justify-between">
          <div>
            {metaGridId}
            {metaGridResult && (
              <div>
                <a
                  target="_blank"
                  className="text-emerald-400"
                  href={`https://metagrid.ch/metagrid_search/#!/concordance/${metaGridId}.html`}
                >
                  {metaGridResult.label_name}
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
            title="MetaGrid-ID entfernen"
          >
            <TiDeleteOutline />
          </button>
        </div>
      ) : (
        <SearchInput
          fallbackTerm={searchTerm}
          searchFn={searchMetagrid}
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

  const gndResult = useServerFetch(
    getSingleGndResult,
    {
      id: gndId,
    },
    {
      // Prevent fetching if the id is not valid
      skip: !gndId || typeof gndId !== "string" || !isValidGndIdentifier(gndId),
    }
  );

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
                  {gndResult.data?.preferredName}
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
          noResultsText={
            "Keine Ergebnisse gefunden - Hinweis: Sie können eine GND-ID auch manuell in das Feld kopieren"
          }
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
  geonames: "",
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
  close: (savedId?: number) => void;
}) => {
  const formRef = useRef<HTMLFormElement>(null);

  const { execute, loading, error } = useServerAction(insertOrUpdatePlace);
  const [isLoading, setIsLoading] = useState(false);
  const [usages, setUsages] = useState<number | undefined | null>();
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [newPlace, setNewPlace] =
    useState<Parameters<typeof execute>[0]>(EMPTY_NEW_PLACE);

  useEffect(() => {
    if (id) {
      setLoadingError(null);
      setIsLoading(true);
      placeById({ id: id.toString() }).then((p) => {
        if (!p) {
          setLoadingError("Person nicht gefunden");
          setIsLoading(false);
          return;
        }
        setNewPlace(p);
        setIsLoading(false);
        setUsages(p.computed_link_counts);
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
      <EditWarning table={"place"} id={id} usages={usages} />
      {(error || loadingError) && (
        <div className="bg-red-100 p-2 mb-4">
          {error} {loadingError}
        </div>
      )}
      {(loading || isLoading) && <Loading />}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const savedPlace = await execute({
            ...newPlace,
            id: id,
          });
          if (savedPlace) {
            close(savedPlace.id);
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
          placeholder=""
        />
        <InputWithLabel
          value={newPlace.district}
          onChange={(e) =>
            setNewPlace({ ...newPlace, district: e.target.value })
          }
          label="Kanton / Bundesland"
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
        <GeonamesField
          value={newPlace.geonames}
          onChange={(v) =>
            setNewPlace({
              ...newPlace,
              geonames: v.id ? "https://www.geonames.org/" + v.id : "",
              latitude: v.lat || newPlace.latitude,
              longitude: v.lng || newPlace.longitude,
            })
          }
          searchTerm={[newPlace.settlement, newPlace.district, newPlace.country]
            .filter((n) => !!n)
            .join(" ")}
        ></GeonamesField>
        {!id && (
          <PlaceMightAlreadyExistHint
            geonames={newPlace.geonames}
            onUseExisting={(id) => close(id)}
          />
        )}
        <div>
          <WithLabel label="Koordinaten">
            {newPlace.latitude && newPlace.longitude ? (
              <>
                <div className="w-full flex">
                  <div>
                    {[
                      newPlace.latitude?.toFixed(7),
                      newPlace.longitude?.toFixed(7),
                    ].join(", ")}
                  </div>
                  {!newPlace.geonames && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setNewPlace({
                          ...newPlace,
                          latitude: undefined,
                          longitude: undefined,
                        });
                      }}
                      className="w-8 ml-2 relative text-2xl text-emerald-400"
                      title="Koordinaten entfernen"
                    >
                      <TiDeleteOutline />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <span className="text-gray-400">Keine Angabe</span>
            )}
          </WithLabel>
          <LeafletMap
            latitude={newPlace.latitude}
            longitude={newPlace.longitude}
            readOnly={!!newPlace.geonames}
            setPosition={setPosition}
          />
        </div>
      </form>
      {id && <CommentsWrapper target={"place/" + id} />}
    </Modal>
  );
};

const isValidGeonamesIdentifier = (id: string) => {
  return /^\d+$/.test(id);
};

const GeonamesField = ({
  value,
  onChange,
  searchTerm,
}: {
  value: string | undefined;
  onChange: (e: {
    id: string;
    lat: number | undefined;
    lng: number | undefined;
  }) => void;
  searchTerm?: string;
}) => {
  const geonamesId = value
    ?.replace("https://www.geonames.org/", "")
    .split("/")[0];

  const [result, setResult] = useState<Awaited<
    ReturnType<typeof getGeoname>
  > | null>(null);
  useEffect(() => {
    if (
      geonamesId &&
      typeof geonamesId === "string" &&
      isValidGeonamesIdentifier(geonamesId)
    ) {
      getGeoname(geonamesId)
        .then((data) => setResult(data))
        .catch(() => setResult(null));
    } else {
      setResult(null);
    }
  }, [geonamesId]);

  return (
    <WithLabel label={"Geonames-ID"}>
      {value ? (
        <div className="flex justify-between">
          <div>
            {geonamesId}
            {result && (
              <div>
                <a
                  target="_blank"
                  className="text-emerald-400"
                  href={`https://www.geonames.org/${geonamesId}`}
                >
                  <DisplayGenoname geoname={result} />
                </a>
              </div>
            )}
            {geonamesId && !isValidGeonamesIdentifier(geonamesId || "") && (
              <div>Ungültige Geonames-ID</div>
            )}
          </div>
          <button
            onClick={() =>
              onChange({
                id: "",
                lat: undefined,
                lng: undefined,
              })
            }
            className="ml-2 text-2xl p-2 text-emerald-400"
            title="Geonames-ID entfernen"
          >
            <TiDeleteOutline />
          </button>
        </div>
      ) : (
        <SearchInput
          fallbackTerm={searchTerm}
          searchFn={searchGeonames}
          onSelect={(result) =>
            onChange({
              id: result.geonameId.toString(),
              lat: parseFloat(result.lat),
              lng: parseFloat(result.lng),
            })
          }
          SelectionComponent={({ item, isFocused }) => {
            return (
              <div className={`p-2 ${isFocused ? "bg-emerald-100" : ""}`}>
                <DisplayGenoname geoname={item} />
              </div>
            );
          }}
          InputComponent={InputField}
        ></SearchInput>
      )}
    </WithLabel>
  );
};

const DisplayGenoname = ({ geoname }: { geoname: Geoname }) => {
  return (
    <div>
      {[
        geoname.name,
        geoname.adminName1,
        geoname.adminName2,
        geoname.adminName3,
        geoname.adminName4,
        geoname.adminName5,
        geoname.countryCode,
      ]
        .filter((i) => !!i)
        .join(", ")}{" "}
      <span className="bg-gray-200 inline-block py-0.5 px-1 rounded-sm">
        {geoname.fclName}
      </span>
    </div>
  );
};

const EditWarning = ({
  table,
  id,
  usages,
}: {
  table: Extract<Versioned, "person" | "place">;
  id?: number | null;
  usages: number | undefined | null;
}) => {
  if (!id || !usages || usages === 0) {
    return null;
  }
  // Todo: add possibility to create a new entry directly
  return (
    <div className="bg-yellow-100 p-2 mb-4 text-sm">
      Achtung: Sie verändern einen bestehenden Eintrag, der in{" "}
      <EntityUsagesModalTrigger table={table} id={id}>
        {usages} Briefen
      </EntityUsagesModalTrigger>{" "}
      verwendet wird. Änderungen betreffen alle Verwendungen. Falls Sie die
      Person oder den Ort lediglich an der aktuellen Stelle ändern möchten,
      entfernen Sie die Zuweisung und erstellen Sie einen neuen Eintrag.
    </div>
  );
};
