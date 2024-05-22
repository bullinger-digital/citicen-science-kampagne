import {
  personById,
  placeById,
  searchPerson,
  searchPlace,
} from "@/lib/actions/citizen";
import { ReactNode, useContext, useState } from "react";
import { InfoIcon, Popover } from "../common/info";
import { EditorContext } from "./editorContext";
import { ContextBox } from "./editor";
import { FaEdit, FaSearch, FaUnlink } from "react-icons/fa";
import { FaLink } from "react-icons/fa6";
import { getPathFromNode } from "@/lib/xml";
import { Loading } from "../common/loadingIndicator";
import { EditPersonModal, EditPlaceModal } from "./modals/modals";
import { useServerFetch } from "../common/serverActions";
import { Link } from "../common/navigation-block/link";

const PersName = ({ node }: { node: Node }) => {
  const c = useContext(EditorContext);
  const id = node.getAttribute("ref")?.replace("p", "");
  const [editModalOpen, setEditModalOpen] = useState(false);

  const {
    loading,
    data: selectedPerson,
    refetch,
  } = useServerFetch(
    personById,
    { id },
    {
      skip: !id,
    }
  );

  const aliases = selectedPerson?.aliases || [];
  const mainAlias = aliases.find((a) => a.type === "main");

  if (loading) {
    return <Loading />;
  }

  if (selectedPerson) {
    return (
      <div>
        <RemoveReferenceButton node={node} />
        <div>
          <span className="font-bold">
            {mainAlias?.forename} {mainAlias?.surname}
          </span>{" "}
          ({id})
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
          <button
            onClick={() => {
              setEditModalOpen(true);
            }}
          >
            <FaEdit />
          </button>
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
        </div>
        <EntityLinksList links={selectedPerson.links} />
        <CertToggle node={node} />
      </div>
    );
  }

  return (
    <EntitySelector
      onSelect={(id) => {
        c?.addAction({
          type: "change-attributes",
          attributes: { ref: `p${id}` },
          nodePath: getPathFromNode(node),
        });
      }}
      key={node.textContent}
      initialSearch={node.textContent}
      searchFn={searchPerson}
      displayComponent={PersonItem}
      editModal={EditPersonModal}
    />
  );
};

const EntityLinksList = ({
  links,
}: {
  links?: { id: number }[] | undefined | null;
}) => {
  if (!links || links.length === 0) {
    return null;
  }

  return (
    <div className="text-sm">
      Verwendet in <LinksPopup links={links.map((l) => l.id)} />
    </div>
  );
};

export const LinksPopup = ({ links }: { links: number[] }) => {
  return (
    <Popover
      content={
        <div className="max-h-32 px-3 overflow-y-auto text-left">
          <ul>
            {links.map((link) => (
              <li key={link}>
                <Link
                  className="underline text-emerald-400"
                  href={`/letter/${link}`}
                  target="_blank"
                >
                  Brief {link}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <strong>{links.length} Briefen</strong>
    </Popover>
  );
};

const PlaceName = ({ node }: { node: Node }) => {
  const c = useContext(EditorContext);
  const id = node.getAttribute("ref")?.replace("l", "");
  const [editModalOpen, setEditModalOpen] = useState(false);

  const {
    loading,
    data: selectedPlace,
    refetch,
  } = useServerFetch(
    placeById,
    { id },
    {
      skip: !id,
    }
  );

  if (loading || (!!id && !selectedPlace)) {
    return <Loading />;
  }

  if (selectedPlace) {
    return (
      <div>
        <RemoveReferenceButton node={node} />
        <div>
          <span className="font-bold">
            {[
              selectedPlace.settlement,
              selectedPlace.district,
              selectedPlace.country,
            ]
              .filter((s) => !!s)
              .join(", ")}
          </span>{" "}
          <button
            onClick={() => {
              setEditModalOpen(true);
            }}
          >
            <FaEdit />
          </button>
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
        </div>
        <EntityLinksList links={selectedPlace.links} />
        <CertToggle node={node} />
      </div>
    );
  }

  return (
    <EntitySelector
      onSelect={(id) => {
        c?.addAction({
          type: "change-attributes",
          attributes: { ref: `l${id}` },
          nodePath: getPathFromNode(node),
        });
      }}
      key={node.textContent}
      initialSearch={node.textContent}
      searchFn={searchPlace}
      displayComponent={PlaceItem}
      editModal={EditPlaceModal}
    />
  );
};

const PersonItem = ({
  entity,
}: {
  entity: Awaited<ReturnType<typeof searchPerson>>[0];
}) => {
  return (
    <span title={"ID: " + entity.id}>
      {entity.aliases.find((a) => a.type === "main")?.forename}{" "}
      {entity.aliases.find((a) => a.type === "main")?.surname}
    </span>
  );
};

const PlaceItem = ({
  entity,
}: {
  entity: Awaited<ReturnType<typeof searchPlace>>[0];
}) => {
  return (
    <span title={"ID: " + entity.id}>
      {[entity.settlement, entity.district, entity.country]
        .filter((s) => !!s)
        .join(", ")}
    </span>
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
      } p-2 inline-block w-full rounded-md my-2`}
    >
      <input
        type="checkbox"
        checked={verified}
        onChange={() => {
          c?.addAction({
            type: "change-attributes",
            attributes: { cert: cert === "high" ? "low" : "high" },
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

const EntitySelector = <T extends SearchFunction>({
  initialSearch,
  onSelect,
  searchFn,
  displayComponent,
  editModal,
}: {
  initialSearch: string | undefined | null;
  onSelect: (id: number) => void;
  searchFn: T;
  displayComponent: (props: {
    entity: Awaited<ReturnType<T>>[0];
  }) => JSX.Element;
  editModal: typeof EditPersonModal | typeof EditPlaceModal;
}) => {
  const [query, setQuery] = useState(
    (initialSearch || "")
      .replace(/[\[\]]/gi, "")
      .replace(/[ ]+/gi, " ")
      .replace(/[\t\n]+/gi, " ")
      .trim()
  );

  const { loading, data: entities } = useServerFetch<
    Parameters<T>[0],
    Awaited<ReturnType<T>>
  >(
    // Todo: fix typing
    searchFn as any,
    { query }
  );

  const [newModalOpen, setNewModalOpen] = useState(false);
  const Component = displayComponent;
  const EditModal = editModal;

  return (
    <div>
      <div className="mb-2 italic">Nicht zugewiesen</div>
      <SearchField query={query} setQuery={setQuery} />

      {loading || !entities ? (
        <Loading />
      ) : (
        <div className="mt-2 overflow-y-auto max-h-[500px]">
          {entities.map((p) => (
            <AddReferenceButton onClick={() => onSelect(p.id)} key={p.id}>
              <div>
                <Component entity={p} />
              </div>
              <span className="text-sm text-gray-400">
                {p.computed_link_counts} Referenzen
              </span>
            </AddReferenceButton>
          ))}
          {entities.length === 0 && query && (
            <div className="italic pt-1 pb-4">Keine Ergebnisse gefunden</div>
          )}
        </div>
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
          close={(savedEntity) => {
            if (savedEntity) {
              onSelect(savedEntity.id);
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
          attributes: { ref: null },
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
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) => {
  return (
    <button
      className="flex items-center p-1 cursor-pointer text-emerald-400 hover:text-emerald-600"
      title="Zuweisen"
      onClick={onClick}
    >
      <div className="mr-2">
        <FaLink />
      </div>
      <div className="text-left">{children}</div>
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
