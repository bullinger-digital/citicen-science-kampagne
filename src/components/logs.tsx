"use client";
import { getLogs } from "@/lib/actions/citizen";
import { useEffect, useState } from "react";

export const Logs = () => {
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof getLogs>>>([]);
  useEffect(() => {
    const fetchLogs = async () => {
      const logs = await getLogs();
      setLogs(logs);
    };
    fetchLogs();
  }, []);

  const changesLabel = (log: (typeof logs)[0]) => {
    const c = [
      {
        type: "Briefe",
        count: log.letter_modified_count,
      },
      {
        type: "Personen",
        count: log.person_modified_count,
      },
      {
        type: "Personen-Aliase",
        count: log.person_alias_modified_count,
      },
      {
        type: "Ortschaften",
        count: log.place_modified_count,
      },
    ].filter((change) => (change.count || 0) > 0);

    if (c.length === 0) return "";
    return (
      c.map((change) => `${change.count} ${change.type}`).join(", ") +
      " verändert"
    );
  };

  return (
    <div>
      <table className="bg-white w-full table-auto  shadow-lg">
        <thead>
          <tr>
            <th>Log Type</th>
            <th>Created By</th>
            <th>Timestamp</th>
            <th>Changes</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr className="odd:bg-slate-100" key={log.id}>
              <td>{log.log_type}</td>
              <td>{log.user[0].user_name}</td>
              <td>{log.timestamp.toLocaleString("de-DE")}</td>
              <td>{changesLabel(log)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* <ul>
        {logs.map((log) => (
          <li key={log.id}>
            {log.log_type}
            {log.created_by_id} {log.user[0].user_name}{" "}
            {log.timestamp.toLocaleString("de-DE")} |{" "}
            {log.letter_modified_count} {log.person_modified_count}{" "}
            {log.person_alias_modified_count} {log.place_modified_count}
          </li>
        ))}
      </ul> */}
    </div>
  );
};
