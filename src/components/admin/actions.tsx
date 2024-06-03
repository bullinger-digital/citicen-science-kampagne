"use client";

import { updateComputedLinkCounts } from "@/lib/actions/admin";
import { useServerAction, useServerFetch } from "../common/serverActions";
import { Loading } from "../common/loadingIndicator";
import { rebuildIndex, searchTest } from "../search";
import { useState } from "react";

export const DataAdminActions = () => {
  const { loading, execute } = useServerAction(updateComputedLinkCounts);
  const rebuildIndexAction = useServerAction(rebuildIndex);
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
      <hr />
      <button
        onClick={() => {
          rebuildIndexAction.execute({});
        }}
        disabled={rebuildIndexAction.loading}
        className="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-200 text-white font-bold py-2 px-4 rounded"
      >
        {rebuildIndexAction.loading && <Loading />} Rebuild Search Index
      </button>
      <SearchExample />
    </div>
  );
};

const SearchExample = () => {
  const [query, setQuery] = useState("");
  const searchAction = useServerFetch(searchTest, { query: query });

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {searchAction.data && (
        <div>
          <h3>Results</h3>
          <pre>{JSON.stringify(searchAction.data, null, 2)}</pre>
          <hr />
        </div>
      )}
    </div>
  );
};
