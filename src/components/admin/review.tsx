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
import { BsFiletypeXml, BsPersonFill } from "react-icons/bs";
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

export const Review = () => {
  const { loading, error, data, refetch } = useServerFetch(
    getUncommitedChanges,
    {}
  );

  const [limit, setLimit] = useState(10);

  return !data && loading ? (
    <Loading />
  ) : error ? (
    <div>{error}</div>
  ) : (
    <div className="pb-20">
      <h2 className="text-xl mb-3 mt-5">{data?.length} Änderungsvorschläge</h2>
      <div className={`${loading ? "opacity-20" : ""}`}>
        {data
          ?.slice(0, limit)
          .map((log) => (
            <ReviewItem log={log} key={log.id} refetch={refetch} />
          ))}
      </div>
      <button
        className="bg-gray-200 hover:bg-gray-300 p-2 rounded-xl"
        onClick={() => setLimit(data?.length || 0)}
      >
        Alle anzeigen
      </button>
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
  person_alias: {
    itemLabel: "Person-Alias",
    iconComponent: BsPersonFill,
  },
};

const ReviewItem = ({
  log,
  refetch,
}: {
  log: Awaited<ReturnType<typeof getUncommitedChanges>>[0];
  refetch: () => void;
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const specs = REVIEW_ITEM_SPECS[log.table];
  const EditModalComponent = specs.editModalComponent;
  const IconComponent = specs.iconComponent;

  const rejectAction = useServerAction(rejectChanges);
  const acceptAction = useServerAction(acceptChanges);

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
          Benutzer {log.created_by_id} am{" "}
          {log.timestamp?.toLocaleDateString("de")}{" "}
          {log.timestamp?.toLocaleTimeString("de")} ({log.log_type})
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

const UsageMoverModal = ({
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
        disabled={toId === null}
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
  logEntry: Awaited<ReturnType<typeof getUncommitedChanges>>[0];
}) => {
  const [compareWithOriginal, setCompareWithOriginal] = useState(false);

  return (
    <>
      <Diff
        oldObject={
          compareWithOriginal ? logEntry.unmodified : logEntry.last_accepted
        }
        newObject={logEntry.modified}
      />
      {/* {logEntry.table === "person" && (
        <Diff
          oldObject={
            compareWithOriginal
              ? logEntry.unmodified?.aliases
              : logEntry.last_accepted?.aliases
          }
          newObject={logEntry.modified?.aliases}
        />
      )} */}
      {logEntry.unmodified?.is_touched && (
        <div
          className={`text-xs mt-4 cursor-pointer ${compareWithOriginal ? "text-green-500" : "text-gray-500"}`}
          title="Mit Original (letzter Korpus-Import) vergleichen"
          onClick={() => setCompareWithOriginal(!compareWithOriginal)}
        >
          <BsFiletypeXml />
        </div>
      )}
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
  "id",
  // Temporarily hide aliases_string and aliases
  "aliases_string",
  "aliases",
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
        return (
          <div className="flex space-x-2" key={key}>
            <div className={`w-32 ${oldV === newV ? "text-gray-300" : ""}`}>
              <span>{key}</span>
            </div>
            <div>
              {oldV === newV ? (
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

const ValueOrLink = ({ value }: { value: any }) => {
  return typeof value === "string" && value?.match(/^https?:\/\//) ? (
    <Link target="_blank" href={value}>
      {value}
    </Link>
  ) : (
    <span>{value}</span>
  );
};
