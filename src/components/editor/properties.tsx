import {
  personById,
  placeById,
  searchPerson,
  searchPlace,
} from "@/lib/actions/citizen";
import { ReactNode, use, useContext, useEffect, useState } from "react";
import { InfoIcon, Popover } from "../common/info";
import { EditorContext } from "./editorContext";
import { ContextBox } from "./editor";
import { FaSearch, FaUnlink } from "react-icons/fa";
import { FaLink } from "react-icons/fa6";
import { getPathFromNode } from "@/lib/xml";
import Link from "next/link";
import { Loading } from "../common/loadingIndicator";

const PersName = ({ node }: { node: Node }) => {
  const c = useContext(EditorContext);
  const id = node.getAttribute("ref")?.replace("p", "");
  const [selectedPerson, setSelectedPerson] =
    useState<Awaited<ReturnType<typeof personById>>>();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!id) {
      setSelectedPerson(undefined);
      return;
    }
    const fetch = async () => {
      setSelectedPerson(await personById({ id }));
      setLoading(false);
    };
    setLoading(true);
    fetch();
  }, [id]);

  const aliases = selectedPerson?.aliases || [];
  const mainAlias = aliases.find((a) => a.type === "main");

  if (loading) {
    return <Loading />;
  }

  if (selectedPerson) {
    return (
      <div>
        <div>
          <span className="font-bold">
            {mainAlias?.forename} {mainAlias?.surname}
          </span>{" "}
          ({id})
          {aliases.length > 1 && (
            <div>
              <Popover
                content={
                  <div className="max-h-36 overflow-auto">
                    {aliases.map((a) => (
                      <div key={a.id}>
                        {a.forename} {a.surname}
                      </div>
                    ))}
                  </div>
                }
              >
                <div className="text-sm">{aliases.length} weitere Namen</div>
              </Popover>
            </div>
          )}
        </div>
        <EntityLinksList links={selectedPerson.links} />
        <CertToggle node={node} />
        <RemoveReferenceButton node={node} />
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
      Verwendet in weiteren Briefen:{" "}
      {links.map((l) => (
        <Link
          className="inline-block mr-2 text-emerald-400 "
          href={`/letter/${l.id}`}
          target="_blank"
          key={l.id}
        >
          {l.id}
        </Link>
      ))}{" "}
      ...
    </div>
  );
};

const PlaceName = ({ node }: { node: Node }) => {
  const c = useContext(EditorContext);
  const id = node.getAttribute("ref")?.replace("l", "");
  const [selectedPlace, setSelectedPlace] =
    useState<Awaited<ReturnType<typeof placeById>>>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setSelectedPlace(undefined);
      return;
    }
    const fetch = async () => {
      setSelectedPlace(await placeById({ id }));
      setLoading(false);
    };
    setLoading(true);
    fetch();
  }, [id]);

  if (loading) {
    return <Loading />;
  }

  if (selectedPlace) {
    return (
      <div>
        <div>
          <span className="font-bold">
            {selectedPlace.settlement}, {selectedPlace.district},{" "}
            {selectedPlace.country}
          </span>{" "}
          ({id})
        </div>
        <EntityLinksList links={selectedPlace.links} />
        <CertToggle node={node} />
        <RemoveReferenceButton node={node} />
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
    />
  );
};

const PersonItem = ({
  entity,
}: {
  entity: Awaited<ReturnType<typeof searchPerson>>[0];
}) => {
  return (
    <>
      {entity.aliases.find((a) => a.type === "main")?.forename}{" "}
      {entity.aliases.find((a) => a.type === "main")?.surname} ({entity.id})
    </>
  );
};

const PlaceItem = ({
  entity,
}: {
  entity: Awaited<ReturnType<typeof searchPlace>>[0];
}) => {
  return (
    <>
      {[entity.settlement, entity.district, entity.country].join(", ")} (
      {entity.id})
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

const EntitySelector = <T extends typeof searchPerson | typeof searchPlace>({
  initialSearch,
  onSelect,
  searchFn,
  displayComponent,
}: {
  initialSearch: string | undefined | null;
  onSelect: (id: number) => void;
  searchFn: T;
  displayComponent: (props: {
    entity: Awaited<ReturnType<T>>[0];
  }) => JSX.Element;
}) => {
  const [query, setQuery] = useState(
    (initialSearch || "")
      .replace(/[\[\]]/gi, "")
      .replace(/[ ]+/gi, " ")
      .replace(/[\t\n]+/gi, " ")
      .trim()
  );
  const [entities, setEntities] = useState<Array<Awaited<ReturnType<T>>[0]>>(
    []
  );
  const [loading, setLoading] = useState(false);
  const Component = displayComponent;

  // Todo: Fix duplicate requests
  useEffect(() => {
    if (!query) {
      setLoading(false);
      setEntities([]);
      return;
    }
    setLoading(true);
    const search = async () => {
      setEntities(await searchFn({ query }));
      setLoading(false);
    };
    search();
  }, [query, searchFn]);

  return (
    <div>
      <div className="mb-2 italic">Nicht zugewiesen</div>
      <SearchField query={query} setQuery={setQuery} />

      {loading ? (
        <Loading />
      ) : (
        <div className="mt-2">
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
            <div className="italic">Keine Ergebnisse gefunden</div>
          )}
        </div>
      )}
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
      className="flex space-x-2 mt-2 items-center text-red-400 hover:text-red-600 cursor-pointer"
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
      className="cursor-pointer p-1 flex items-center text-emerald-400 hover:text-emerald-600"
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
        className="border w-full p-2"
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
