"use client";

import { useServerAction } from "../common/serverActions";
import { Loading } from "../common/loadingIndicator";
import {
  runExport,
  runImport,
  updateComputedLinkCounts,
} from "@/lib/actions/admin-data";

export const DataAdminActions = () => {
  const { loading, execute } = useServerAction(updateComputedLinkCounts);
  const importAction = useServerAction(runImport);
  const exportAction = useServerAction(runExport);

  return (
    <div>
      <button
        onClick={() => {
          execute({});
        }}
        disabled={loading}
        className="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-200 text-white font-bold py-2 px-4 rounded"
      >
        {loading && <Loading />} Update Computed Link Counts
      </button>

      <button
        onClick={() => {
          importAction.execute({});
        }}
        disabled={importAction.loading}
        className="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-200 text-white font-bold py-2 px-4 rounded"
      >
        {importAction.loading && <Loading />} Import
      </button>
      <button
        onClick={() => {
          exportAction.execute({});
        }}
        disabled={exportAction.loading}
        className="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-200 text-white font-bold py-2 px-4 rounded"
      >
        {exportAction.loading && <Loading />} Export
      </button>
    </div>
  );
};
