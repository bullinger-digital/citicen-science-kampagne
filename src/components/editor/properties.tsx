import {
  personById,
  placeById,
  searchPerson,
  searchPlace,
} from "@/lib/actions/citizen";
import {
  MouseEventHandler,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { InfoIcon, Popover } from "../common/info";
import { EditorContext } from "./editorContext";
import { ContextBox } from "./editor";
import { FaEdit, FaExternalLinkAlt, FaSearch, FaUnlink } from "react-icons/fa";
import { FaLink } from "react-icons/fa6";
import { getPathFromNode } from "@/lib/xml";
import { Loading } from "../common/loadingIndicator";
import { EditPersonModal, EditPlaceModal } from "./modals/modals";
import { useServerFetch } from "../common/serverActions";
import { Link } from "../common/navigation-block/link";
import { getYear } from "./modals/common";
import ReactDOM from "react-dom";
import { GndResult } from "@/lib/actions/gnd";
import { Versioned } from "@/lib/versioning";
import { UsagesModal } from "./modals/usagesModal";

const PersName = ({ node }: { node: Node }) => {
  const c = useContext(EditorContext);
  const id = node.getAttribute("ref")?.replace("p", "");

  return id ? (
    <div>
      <RemoveReferenceButton node={node} />
      <CertToggle node={node} />
      <PersonItemDetails id={id} isPreview={false} />
    </div>
  ) : (
    <EntitySelector
      onSelect={(id) => {
        c?.addAction({
          type: "change-attributes",
          attributes: { type: "citizen_name", ref: `p${id}` },
          nodePath: getPathFromNode(node),
        });
      }}
      key={node.textContent}
      initialSearch={node.textContent}
      searchFn={searchPerson}
      displayComponent={PersonItem}
      detailsComponent={PersonItemDetails}
      editModal={EditPersonModal}
    />
  );
};

const PlaceName = ({ node }: { node: Node }) => {
  const c = useContext(EditorContext);
  const id = node.getAttribute("ref")?.replace("l", "");

  return id ? (
    <div>
      <RemoveReferenceButton node={node} />
      <CertToggle node={node} />
      <PlaceItemDetails id={id} isPreview={false} />
    </div>
  ) : (
    <EntitySelector
      onSelect={(id) => {
        c?.addAction({
          type: "change-attributes",
          attributes: { type: "citizen_name", ref: `l${id}` },
          nodePath: getPathFromNode(node),
        });
      }}
      key={node.textContent}
      initialSearch={node.textContent}
      searchFn={searchPlace}
      displayComponent={PlaceItem}
      detailsComponent={PlaceItemDetails}
      editModal={EditPlaceModal}
    />
  );
};

const PersonItem = ({
  entity,
}: {
  entity: Awaited<ReturnType<typeof searchPerson>>["result"][0];
}) => {
  return (
    <div className="relative flex items-center space-x-2 justify-between">
      <span title={"ID: " + entity.id}>
        {entity.forename} {entity.surname}
      </span>
    </div>
  );
};

export const PersonItemDetails = ({
  id,
  isPreview,
}: {
  id: string;
  isPreview: boolean;
}) => {
  const {
    loading,
    error,
    data: selectedPerson,
    refetch,
  } = useServerFetch(
    personById,
    { id, includeGndData: true },
    {
      skip: !id,
    }
  );

  const [editModalOpen, setEditModalOpen] = useState(false);

  const aliases = selectedPerson?.aliases || [];

  if (loading) {
    return <Loading />;
  }

  if (!selectedPerson || error) {
    return <div>Beim Laden der Person ist ein Fehler aufgetreten.</div>;
  }

  if (selectedPerson) {
    return (
      <div>
        <div>
          <div className="flex justify-between">
            <span className="font-bold">
              {selectedPerson.forename} {selectedPerson.surname}
              <span className="text-gray-400 font-normal">
                {" "}
                ID {selectedPerson.id}
              </span>
            </span>
            {!isPreview && (
              <button
                title="Änderung vorschlagen"
                onClick={() => {
                  setEditModalOpen(true);
                }}
              >
                <FaEdit />
              </button>
            )}
          </div>
          {editModalOpen && (
            <EditPersonModal
              open={editModalOpen}
              close={() => {
                setEditModalOpen(false);
                refetch();
              }}
              id={parseInt(id)}
            />
          )}
          {aliases.length > 1 && (
            <div>
              <Popover
                content={
                  <div className="overflow-auto text-left max-h-36">
                    {aliases.map((a) => (
                      <div key={a.id}>
                        {a.forename} {a.surname}
                      </div>
                    ))}
                  </div>
                }
              >
                <div className="text-sm">{aliases.length} Namensvarianten</div>
              </Popover>
            </div>
          )}
        </div>
        <div className="text-sm">
          <EntityLinksList
            table="person"
            id={selectedPerson.id}
            usageCount={selectedPerson.computed_link_counts}
          />
        </div>
        <div>
          <GndDataDisplay gndData={selectedPerson.gndData} />
        </div>
      </div>
    );
  }
};

const GndDataDisplay = ({
  gndData,
}: {
  gndData: GndResult | undefined | null;
}) => {
  if (!gndData) {
    return null;
  }

  const yearBirth = gndData.dateOfBirth && getYear(gndData.dateOfBirth[0]);
  const yearDeath = gndData.dateOfDeath && getYear(gndData.dateOfDeath[0]);

  return (
    <div className="relative mt-6 rounded-md border text-sm border-gray-200 py-3 px-4">
      <h6 className="flex -top-3 left-2 px-2 space-x-2 absolute bg-white">
        <span>Informationen aus GND</span>
        {gndData.id && (
          <Link className="inline-block" href={gndData.id} target="_blank">
            <FaExternalLinkAlt className="mt-0.5" />
          </Link>
        )}
      </h6>
      <p>{gndData.preferredName}</p>
      {(yearBirth || yearDeath) && (
        <div title="Lebensdaten">
          <span>Lebensdaten: </span>
          {yearBirth}-{yearDeath}
        </div>
      )}
      {gndData.placeOfBirth && gndData.placeOfBirth.length > 0 && (
        <div title="Geburtsort">
          <span>Geburtsort: </span>
          {gndData.placeOfBirth.map((p) => p?.label).join(", ")}
        </div>
      )}
      {(gndData.placeOfActivity || []).length > 0 && (
        <div title="Wirkungsort(e)">
          <span>Wirkungsort(e): </span>
          {gndData.placeOfActivity?.map((p) => p?.label).join(", ")}
        </div>
      )}
      <div title="Beschreibung" className="max-h-60 overflow-y-auto">
        {gndData.biographicalOrHistoricalInformation?.map((b) => (
          <div key={b}>{b}</div>
        ))}
      </div>
      {gndData.professionOrOccupation && (
        <div title="Beruf / Tätigkeit">
          <span>Beruf / Tätigkeit: </span>
          {gndData.professionOrOccupation.map((p) => p?.label).join(", ")}
        </div>
      )}
    </div>
  );
};

export const PlaceItemDetails = ({
  id,
  isPreview,
}: {
  id: string;
  isPreview: boolean;
}) => {
  const [editModalOpen, setEditModalOpen] = useState(false);

  const {
    loading,
    data: selectedPlace,
    error,
    refetch,
  } = useServerFetch(
    placeById,
    { id },
    {
      skip: !id,
    }
  );

  if (loading) {
    return <Loading />;
  }

  if (!selectedPlace || error) {
    return <div>Beim Laden der Ortschaft ist ein Fehler aufgetreten.</div>;
  }

  if (selectedPlace) {
    return (
      <div>
        <div className="flex justify-between">
          <span className="font-bold">
            {[
              selectedPlace.settlement,
              selectedPlace.district,
              selectedPlace.country,
            ]
              .filter((s) => !!s)
              .join(", ")}
            <span className="text-gray-400 font-normal">
              {" "}
              ID {selectedPlace.id}
            </span>
          </span>
          {!isPreview && (
            <button
              title="Änderung vorschlagen"
              onClick={() => {
                setEditModalOpen(true);
              }}
            >
              <FaEdit />
            </button>
          )}
        </div>
        {editModalOpen && (
          <EditPlaceModal
            open={editModalOpen}
            close={() => {
              setEditModalOpen(false);
              refetch();
            }}
            id={parseInt(id)}
          />
        )}
        <div className="text-sm">
          <EntityLinksList
            table="place"
            id={selectedPlace.id}
            usageCount={selectedPlace.computed_link_counts}
          />
        </div>
      </div>
    );
  }
};

const PlaceItem = ({
  entity,
}: {
  entity: Awaited<ReturnType<typeof searchPlace>>["result"][0];
}) => {
  return (
    <span title={"ID: " + entity.id}>
      {[entity.settlement, entity.district, entity.country]
        .filter((s) => !!s)
        .join(", ")}
    </span>
  );
};

export const EntityLinksList = ({
  table,
  id,
  usageCount,
}: {
  table: Extract<Versioned, "person" | "place">;
  id: number;
  usageCount?: number | null;
}) => {
  return (
    <div>
      Verwendet in{" "}
      <EntityUsagesModalTrigger id={id} table={table}>
        {usageCount} Briefen
      </EntityUsagesModalTrigger>
    </div>
  );
};

export const EntityUsagesModalTrigger = ({
  id,
  table,
  children,
}: {
  id: number;
  table: Extract<Versioned, "person" | "place">;
  children: ReactNode;
}) => {
  const [usagesModalVisible, setUsagesModalVisible] = useState(false);

  return (
    <>
      <button className="font-bold" onClick={() => setUsagesModalVisible(true)}>
        {children}
      </button>
      {usagesModalVisible && (
        <UsagesModal
          table={table}
          id={id}
          open={usagesModalVisible}
          close={() => setUsagesModalVisible(false)}
        />
      )}
    </>
  );
};

const CertToggle = ({ node }: { node: Node }) => {
  const c = useContext(EditorContext);
  const cert = node.getAttribute("cert");
  const verified = cert === "high";

  return (
    <label
      className={`${
        verified ? "bg-green-100" : "bg-blue-100"
      } p-2 inline-block w-full rounded-md mb-3`}
    >
      <input
        type="checkbox"
        checked={verified}
        onChange={() => {
          c?.addAction({
            type: "change-attributes",
            attributes: {
              type: "citizen_name",
              cert: cert === "high" ? "low" : "high",
            },
            nodePath: getPathFromNode(node),
          });
        }}
      />{" "}
      Verifiziert{" "}
      <InfoIcon content="Setzen Sie das Element dann auf verifiziert, wenn Sie sicher sind, dass es sich um die ausgewählte Person / die ausgewählte Ortschaft handelt." />
    </label>
  );
};

type SearchFunction = typeof searchPerson | typeof searchPlace;

const useDequeued = (value: string, intervalMs: number) => {
  const [dequeuedValue, setDequeuedValue] = useState(value);
  const [queueing, setQueueing] = useState(false);

  useEffect(() => {
    setQueueing(true);
    const timeout = setTimeout(() => {
      setDequeuedValue(value);
      console.log("Dequeued value", value);
      setQueueing(false);
    }, intervalMs);
    return () => clearTimeout(timeout);
  }, [value, intervalMs]);

  return { dequeuedValue, queueing };
};

const EntitySelector = <T extends SearchFunction>({
  initialSearch,
  onSelect,
  searchFn,
  displayComponent,
  detailsComponent,
  editModal,
}: {
  initialSearch: string | undefined | null;
  onSelect: (id: number) => void;
  searchFn: T;
  displayComponent: (props: {
    entity: Awaited<ReturnType<T>>["result"][0];
  }) => JSX.Element | undefined;
  detailsComponent: (props: {
    id: string;
    isPreview: boolean;
  }) => JSX.Element | undefined;
  editModal: typeof EditPersonModal | typeof EditPlaceModal;
}) => {
  const [query, setQuery] = useState(
    (initialSearch || "")
      .replace(/[\[\]]/gi, "")
      .replace(/[ ]+/gi, " ")
      .replace(/[\t\n]+/gi, " ")
      .trim()
  );

  const { queueing, dequeuedValue } = useDequeued(query, 500);

  const { loading, data } = useServerFetch<
    Parameters<T>[0],
    Awaited<ReturnType<T>>
  >(
    // Todo: fix typing
    searchFn as any,
    { query: dequeuedValue }
  );

  const entities = data?.result;

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [showDetailsFor, setShowDetailsFor] = useState<
    | {
        item: Awaited<ReturnType<T>>["result"][0];
        element: HTMLButtonElement;
      }
    | undefined
  >(undefined);
  const Component = displayComponent;
  const DetailsComponent = detailsComponent;
  const EditModal = editModal;

  return (
    <div className="relative">
      <div className="mb-2 italic">Nicht zugewiesen</div>
      <SearchField query={query} setQuery={setQuery} />

      {loading || queueing || !entities ? (
        <Loading />
      ) : (
        <div className="mt-2 overflow-y-auto max-h-[500px]">
          {entities.map((p) => (
            <AddReferenceButton
              key={p.id}
              onClick={() => onSelect(p.id)}
              onMouseEnter={(e) =>
                setShowDetailsFor({ item: p, element: e.currentTarget })
              }
              onMouseLeave={() => setShowDetailsFor(undefined)}
            >
              <div>
                <Component entity={p} />
              </div>
              <span className="text-sm text-gray-400">
                Verwendet in {p.computed_link_counts} Briefen
              </span>
            </AddReferenceButton>
          ))}
          {entities.length === 0 && query && (
            <div className="italic pt-1 pb-4">Keine Ergebnisse gefunden</div>
          )}
        </div>
      )}

      {showDetailsFor &&
        ReactDOM.createPortal(
          <div
            style={{
              top:
                showDetailsFor.element.getBoundingClientRect().top +
                window.scrollY,
              left:
                showDetailsFor.element.getBoundingClientRect().right -
                showDetailsFor.element.getBoundingClientRect().width -
                400 -
                20,
              width: 400,
            }}
            className="absolute min-h-32 border border-gray-200 p-7 bg-white shadow-2xl"
          >
            <DetailsComponent
              id={showDetailsFor.item.id.toString()}
              isPreview={true}
            />
          </div>,
          window.document.body
        )}

      <div className="w-full pt-2 text-sm text-left border-t border-gray-200">
        Der Eintrag existiert noch nicht?{" "}
        <button
          className="text-emerald-400"
          onClick={(e) => setNewModalOpen(true)}
        >
          Neu erfassen
        </button>{" "}
        <InfoIcon
          content={
            "Erstellen Sie einen neuen Eintrag für die ausgewählte Person / Ortschaft."
          }
        />
        <EditModal
          close={(id) => {
            if (id) {
              onSelect(id);
            }
            setNewModalOpen(false);
          }}
          open={newModalOpen}
        />
      </div>
    </div>
  );
};

const RemoveReferenceButton = ({ node }: { node: Node }) => {
  const c = useContext(EditorContext);
  return (
    <button
      title="Zuweisung entfernen"
      onClick={() => {
        c?.addAction({
          type: "change-attributes",
          attributes: { type: "citizen_name", ref: null },
          nodePath: getPathFromNode(node),
        });
      }}
      className="flex items-center mb-2 space-x-2 text-red-400 cursor-pointer hover:text-red-600"
    >
      <FaUnlink />
      <span>Zuweisung entfernen</span>
    </button>
  );
};

const AddReferenceButton = ({
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  onClick: () => void;
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}) => {
  return (
    <button
      className="flex items-center w-full p-1 cursor-pointer text-emerald-400 hover:text-emerald-600"
      title="Zuweisen"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="mr-2">
        <FaLink />
      </div>
      <div className="text-left w-full">{children}</div>
    </button>
  );
};

const SearchField = ({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (query: string) => void;
}) => {
  return (
    <div className="flex items-center">
      <FaSearch className="inline-block mr-2 text-gray-300" />
      <input
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        className="w-full p-2 border"
        placeholder="Suche"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );
};

export const Properties = () => {
  const { selectedNode } = useContext(EditorContext)!;
  if (!selectedNode) {
    return (
      <ContextBox title="Eigenschaften">
        <div className="italic">Kein Element ausgewählt</div>
      </ContextBox>
    );
  }
  const nodeName = selectedNode.nodeName.toLowerCase();
  if (nodeName === "persname") {
    return (
      <ContextBox title="Eigenschaften – Person">
        <PersName node={selectedNode} />
      </ContextBox>
    );
  }
  if (nodeName === "placename") {
    return (
      <ContextBox title="Eigenschaften – Ortschaft">
        <PlaceName node={selectedNode} />
      </ContextBox>
    );
  }
  return <div>Unsupported node selected {selectedNode.nodeName}</div>;
};
