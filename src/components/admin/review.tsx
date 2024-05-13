"use client";
import {
  acceptChange,
  getUncommitedChanges,
  rejectChange,
} from "@/lib/actions/admin";
import { useServerAction, useServerFetch } from "../common/serverActions";

export const Review = () => {
  const { loading, error, data, refetch } = useServerFetch(
    getUncommitedChanges,
    {}
  );
  const rejectAction = useServerAction(rejectChange);
  const acceptAction = useServerAction(acceptChange);

  return (
    <div>
      <table className="bg-white w-full table-auto  shadow-lg">
        <thead>
          <tr className="text-left">
            <th>Type</th>
            <th>ID</th>
            <th>Table</th>
            <th>Action</th>
            <th>Changes</th>
            <th>Usages</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((log) => (
            <tr className="odd:bg-slate-100" key={log.id}>
              <td>{log.log_type}</td>
              <td>{log.modified?.id}</td>
              <td>{log.table}</td>
              <td>{log.unmodified === null ? "Erstellt" : "Verändert"}</td>
              <th>
                <ReviewItem logEntry={log} />
              </th>
              <th>
                {log.usages?.length}
                <ul>
                  {log.usages?.map((usage) => (
                    <li key={usage.id}>{usage.id}</li>
                  ))}
                </ul>
              </th>
              <th>
                <button
                  onClick={() => {
                    acceptAction.execute({
                      table: log.table,
                      versionId: log.modified!.version_id,
                    });
                    refetch();
                  }}
                >
                  Accept
                </button>
                <button
                  onClick={() => {
                    rejectAction.execute({
                      table: log.table,
                      versionId: log.modified!.version_id,
                    });
                    refetch();
                  }}
                >
                  Reject
                </button>
              </th>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ReviewItem = ({
  logEntry,
}: {
  logEntry: Awaited<ReturnType<typeof getUncommitedChanges>>[0];
}) => {
  return <Diff oldObject={logEntry.unmodified} newObject={logEntry.modified} />;
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
        if (oldObject && oldV === newV) {
          return null;
        }
        return (
          <>
            <div className="flex" key={key}>
              <div>
                <span className="font-bold">{key}</span>
              </div>
              <div>
                <span className="text-red-500 line-through">{oldV}</span>
                <span className="text-green-500">{newV}</span>
              </div>
            </div>
          </>
        );
      })}
    </div>
  );
};
