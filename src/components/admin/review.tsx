"use client";
import {
  acceptChanges,
  getUncommitedChanges,
  moveUsages,
  rejectChanges,
} from "@/lib/actions/admin";
import { useServerAction, useServerFetch } from "../common/serverActions";
import { Loading } from "../common/loadingIndicator";
import {
  CommentsWrapper,
  EditPersonModal,
  EditPlaceModal,
} from "../editor/modals/modals";
import { useState } from "react";
import { BsPersonFill } from "react-icons/bs";
import { TbLocation } from "react-icons/tb";
import { IconType } from "react-icons";
import {
  EntityLinksList,
  PersonItemDetails,
  PlaceItemDetails,
} from "../editor/properties";
import Modal from "../common/modal";
import { FaEdit, FaExternalLinkAlt } from "react-icons/fa";
import { FaCheck } from "react-icons/fa6";
import { GrClose } from "react-icons/gr";
import { Link } from "../common/navigation-block/link";
import { VersionedTable } from "@/lib/versioning";

export const Review = () => {
  const [table, setTable] = useState<VersionedTable>("person_version");
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(0);
  const pageSize = limit;

  const { loading, error, data, refetch } = useServerFetch(
    getUncommitedChanges,
    { limit: limit, offset: pageSize * page, table: table }
  );

  const itemCount =
    (table === "person_version"
      ? data?.person_counts?.count
      : data?.place_counts?.count) || 0;

  const pageCount = Math.ceil(itemCount / pageSize);

  const reset = () => {
    setPage(0);
    setLimit(10);
  };

  return !data && loading ? (
    <Loading />
  ) : error ? (
    <div>{error}</div>
  ) : (
    <div className="pb-20">
      <h2 className="text-xl mb-3 mt-5">Änderungsvorschläge</h2>
      <div className="flex space-x-2 mb-5">
        <button
          onClick={() => {
            reset();
            setTable("person_version");
          }}
          className={`${
            table === "person_version" ? "bg-emerald-200" : "bg-gray-100"
          } hover:bg-emerald-300 p-2 rounded-xl`}
        >
          Personen ({data?.person_counts?.count})
        </button>
        <button
          onClick={() => {
            reset();
            setTable("place_version");
          }}
          className={`${
            table === "place_version" ? "bg-emerald-200" : "bg-gray-100"
          } hover:bg-emerald-300 p-2 rounded-xl`}
        >
          Orte ({data?.place_counts?.count})
        </button>
      </div>
      <div className={`${loading ? "opacity-20" : ""}`}>
        {data?.changes.map((log) => (
          <ReviewItem
            log={log}
            key={`${table}-${log.modified?.id}`}
            refetch={refetch}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="border rounded p-1"
          onClick={() => setPage(0)}
          disabled={page === 0}
        >
          {"<<"}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => setPage(page - 1)}
          disabled={page === 0}
        >
          {"<"}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => setPage(page + 1)}
          disabled={page + 1 === pageCount}
        >
          {">"}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => setPage(pageCount - 1)}
          disabled={page + 1 === pageCount}
        >
          {">>"}
        </button>
        <span className="flex items-center gap-1">
          <div>Seite</div>
          <strong>
            {page + 1} von {pageCount.toLocaleString()}
          </strong>
        </span>
      </div>
    </div>
  );
};

const REVIEW_ITEM_SPECS: {
  [key: string]: {
    itemLabel: string;
    editModalComponent?: React.ComponentType<any> | undefined;
    iconComponent: IconType;
  };
} = {
  person: {
    itemLabel: "Person",
    editModalComponent: EditPersonModal,
    iconComponent: BsPersonFill,
  },
  place: {
    itemLabel: "Ort",
    editModalComponent: EditPlaceModal,
    iconComponent: TbLocation,
  },
};

const ReviewItem = ({
  log,
  refetch,
}: {
  log: Awaited<ReturnType<typeof getUncommitedChanges>>["changes"][0];
  refetch: () => void;
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const specs = REVIEW_ITEM_SPECS[log.table];
  const EditModalComponent = specs.editModalComponent;
  const IconComponent = specs.iconComponent;

  const rejectAction = useServerAction(rejectChanges);
  const acceptAction = useServerAction(acceptChanges);

  const timestamp = log.recently_changed_log?.timestamp
    ? new Date(log.recently_changed_log?.timestamp)
    : null;

  return (
    <div className="p-3 relative rounded-xl bg-white border-gray-300 border mb-2">
      {showEditModal && EditModalComponent && (
        <EditModalComponent
          id={log.modified!.id}
          open={true}
          close={() => {
            setShowEditModal(false);
            refetch();
          }}
        />
      )}
      <div className="flex justify-between mb-2">
        <div>
          <IconComponent className="inline-block mr-2" />
          <span className="font-bold">
            {specs.itemLabel} {log.modified?.id}
          </span>{" "}
          {log.last_accepted === null ? "erstellt" : "verändert"}
        </div>
        <div>
          Benutzer {log.recently_changed_log?.created_by_id} am{" "}
          {timestamp?.toLocaleDateString("de")}{" "}
          {timestamp?.toLocaleTimeString("de")}
        </div>
      </div>
      <div className="flex justify-between">
        <div>
          {log.modified && log.modified.forename && (
            <div className="mb-2">
              {log.modified.forename} {log.modified.surname}
            </div>
          )}
          <div className="border-gray-200 border-l-4 pl-3">
            <DiffItem logEntry={log} />
          </div>
          <div className="max-w-screen-md">
            <CommentsWrapper
              target={`${log.table}/${log.modified!.id}`}
              commentCount={log.comment_count?.count}
            />
          </div>
        </div>
        <div>
          <div>
            {(log.table === "place" || log.table === "person") && (
              <EntityLinksList
                id={log.modified!.id!}
                table={log.table.replace("_version", "") as "place" | "person"}
                usageCount={log.computed_link_counts}
              />
            )}
          </div>
        </div>
      </div>
      <div className="flex absolute bottom-0 right-0">
        {acceptAction.error && (
          <div className="text-xs bg-red-100 p-2">{acceptAction.error}</div>
        )}
        {rejectAction.error && (
          <div className="text-xs bg-red-100 p-2">{rejectAction.error}</div>
        )}
        {(log.table === "person" || log.table === "place") &&
          // At the moment, we only allow moving usages for new items
          log.last_accepted === null && (
            <UsageMoverButton
              table={log.table}
              fromId={log.modified!.id!}
              refetch={refetch}
            />
          )}
        <ActionButton
          iconComponent={FaEdit}
          className="bg-gray-100 hover:bg-gray-200"
          onClick={() => {
            setShowEditModal(true);
          }}
        >
          Bearbeiten
        </ActionButton>
        <ActionButton
          iconComponent={FaCheck}
          className="bg-emerald-300 hover:bg-emerald-400"
          onClick={async () => {
            await acceptAction.execute({
              items: [
                {
                  table: log.table,
                  versionId: log.modified!.version_id,
                },
              ],
            });

            refetch();
          }}
        >
          Akzeptieren
        </ActionButton>
        <ActionButton
          iconComponent={GrClose}
          className="bg-red-100 hover:bg-red-200"
          onClick={async () => {
            await rejectAction.execute({
              items: [
                {
                  table: log.table,
                  versionId: log.modified!.version_id,
                  restoreToVersionId: log.last_accepted?.version_id,
                },
              ],
            });

            refetch();
          }}
        >
          Verwerfen
        </ActionButton>
      </div>
    </div>
  );
};

const ActionButton = ({
  onClick,
  children,
  disabled,
  className,
  iconComponent,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  iconComponent?: IconType;
}) => {
  const IconComponent = iconComponent;
  return (
    <button
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`flex py-2 px-4 first:rounded-l-xl last:rounded-r-xl ${className} ${disabled ? "text-gray-100" : ""}`}
    >
      {IconComponent && (
        <IconComponent className="inline-block mr-2 relative top-1" />
      )}
      {children}
    </button>
  );
};

const UsageMoverButton = ({
  table,
  fromId,
  refetch,
}: {
  table: "person" | "place";
  fromId: number;
  refetch: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const specs = REVIEW_ITEM_SPECS[table];

  return (
    <>
      <ActionButton
        iconComponent={FaExternalLinkAlt}
        onClick={() => setOpen(true)}
        className="bg-gray-200"
      >
        Verwendungen von {specs.itemLabel} {fromId} verschieben
      </ActionButton>
      <UsageMoverModal
        table={table}
        fromId={fromId}
        open={open}
        close={() => {
          setOpen(false);
          refetch();
        }}
      />
    </>
  );
};

export const UsageMoverModal = ({
  table,
  fromId,
  close,
  open,
}: {
  table: "person" | "place";
  fromId: number;
  open: boolean;
  close: () => void;
}) => {
  const specs = REVIEW_ITEM_SPECS[table];

  return !open ? null : (
    <Modal
      open={open}
      closeOnOutsideClick={true}
      cancel={close}
      title={`Verwendungen von ${specs.itemLabel} ${fromId} verschieben`}
    >
      <div>
        Alle Instanzen von {specs.itemLabel} {fromId} zu einer anderen ID
        verschieben.
        <br />
        <span className="text-red-400">
          ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden.
        </span>
      </div>

      <UsageMover table={table} fromId={fromId} refetch={close} />
    </Modal>
  );
};

const UsageMover = ({
  table,
  fromId,
  refetch,
}: {
  table: "person" | "place";
  fromId: number;
  refetch: () => void;
}) => {
  const [toId, setToId] = useState<number | null>(null);
  const moveUsagesAction = useServerAction(moveUsages);

  return (
    <div className="mt-5">
      <div>
        Verschieben von
        {fromId && table === "place" && (
          <PlaceItemDetails id={fromId?.toString()} isPreview={false} />
        )}
        {fromId && table === "person" && (
          <PersonItemDetails id={fromId?.toString()} isPreview={false} />
        )}
      </div>
      <div className="flex space-x-2 items-center my-4">
        <span>Zu ID</span>
        <input
          className="border border-gray-300 p-2 rounded-md"
          type="number"
          value={toId?.toString()}
          onChange={(e) => setToId(parseInt(e.target.value))}
        />
        {toId && table === "place" && (
          <PlaceItemDetails id={toId?.toString()} isPreview={false} />
        )}
        {toId && table === "person" && (
          <PersonItemDetails id={toId?.toString()} isPreview={false} />
        )}
      </div>
      <ActionButton
        className="bg-emerald-300 hover:bg-emerald-400"
        disabled={toId === null || moveUsagesAction.loading}
        onClick={async () => {
          if (toId === null) {
            return;
          }
          try {
            await moveUsagesAction.execute({ table, fromId, toId });
            refetch();
          } catch (e) {}
        }}
      >
        {moveUsagesAction.loading && <Loading />}
        Ausführen
      </ActionButton>
      {moveUsagesAction.error && (
        <div className="text-xs bg-red-100 p-2">{moveUsagesAction.error}</div>
      )}
    </div>
  );
};

const DiffItem = ({
  logEntry,
}: {
  logEntry: Awaited<ReturnType<typeof getUncommitedChanges>>["changes"][0];
}) => {
  return (
    <>
      <Diff oldObject={logEntry.last_accepted} newObject={logEntry.modified} />
    </>
  );
};

const fieldsToHide = [
  "version_id",
  "is_latest",
  "git_import_id",
  "is_touched",
  "is_new",
  "review_state",
  "git_export_id",
  "created_log_id",
  "reviewed_log_id",
  "deleted_log_id",
  "id",
  // Temporarily hide aliases_string and aliases
  "aliases_string",
];

const Diff = ({
  oldObject,
  newObject,
}: {
  oldObject: Record<string, any> | undefined | null;
  newObject: Record<string, any> | undefined | null;
}) => {
  return (
    <div>
      {Object.keys(newObject || {}).map((key) => {
        if (fieldsToHide.includes(key)) {
          return null;
        }
        const oldV = oldObject?.[key] || null;
        const newV = newObject?.[key] || null;
        const changed = Array.isArray(newV)
          ? JSON.stringify(oldV) !== JSON.stringify(newV)
          : oldV !== newV;

        return (
          <div className="flex space-x-2" key={key}>
            <div className={`w-32 ${!changed ? "text-gray-300" : ""}`}>
              <span>{key}</span>
            </div>
            <div>
              {Array.isArray(newV) && key === "aliases" ? (
                <AliasesDiff oldV={oldV} newV={newV} changed={changed} />
              ) : !changed ? (
                <>
                  <ValueOrLink value={newV} />
                </>
              ) : (
                <>
                  {oldV && (
                    <>
                      <span className="text-red-500 line-through">
                        <ValueOrLink value={oldV} />
                      </span>
                      <br />
                    </>
                  )}
                  <span className="text-green-500">
                    <ValueOrLink value={newV} />
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const AliasesDiff = ({
  oldV,
  newV,
  changed,
}: {
  oldV: any[] | undefined | null;
  newV: any[] | undefined | null;
  changed: boolean;
}) => {
  const fullName = (v: any) => v.forename + " " + v.surname;

  const oldNames = oldV?.map(fullName) || [];
  const newNames = newV?.map(fullName) || [];
  const removed = oldNames.filter((v) => !newNames.includes(v));

  return changed ? (
    <div>
      {removed.map((v, i) => (
        <div key={i} className="text-red-500 line-through">
          {v}
        </div>
      ))}
      {(newV || []).map((v, i) => (
        <div
          key={i}
          className={!oldNames.includes(fullName(v)) ? "text-green-500" : ""}
        >
          {v.forename} {v.surname}
        </div>
      ))}
    </div>
  ) : (
    <div className="text-gray-300">(keine Änderungen)</div>
  );
};

const ValueOrLink = ({ value }: { value: any }) => {
  return typeof value === "string" && value?.match(/^https?:\/\//) ? (
    <Link target="_blank" href={value}>
      {value}
    </Link>
  ) : (
    <span>{value}</span>
  );
};
