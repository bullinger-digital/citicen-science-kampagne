"use client";

import {
  tempAddTypeCitizenNameAttribute,
  updateComputedLinkCounts,
} from "@/lib/actions/admin";
import { useServerAction } from "../common/serverActions";
import { Loading } from "../common/loadingIndicator";

export const DataAdminActions = () => {
  const { loading, execute } = useServerAction(updateComputedLinkCounts);
  const citizenNameAttibuteAction = useServerAction(
    tempAddTypeCitizenNameAttribute
  );

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
          citizenNameAttibuteAction.execute({});
        }}
        disabled={citizenNameAttibuteAction.loading}
        className="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-200 text-white font-bold py-2 px-4 rounded"
      >
        {citizenNameAttibuteAction.loading && <Loading />} Add citizen_name
        attribute
      </button>
    </div>
  );
};
