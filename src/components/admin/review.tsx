"use client";
import { getUncommitedChanges } from "@/lib/actions/admin";
import { useServerFetch } from "../common/serverActions";

export const Review = () => {
  const { loading, error, data } = useServerFetch(getUncommitedChanges, {});

  return (
    <div>
      <table className="bg-white w-full table-auto  shadow-lg">
        <thead>
          <tr>
            <th>ID</th>
            <th>Table</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((log) => (
            <tr className="odd:bg-slate-100" key={log.item.id}>
              <td>{log.item.id}</td>
              <td>{log.table}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
