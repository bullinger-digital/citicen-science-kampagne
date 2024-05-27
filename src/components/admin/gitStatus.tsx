"use client";
import { getGitStatus, gitCheckoutMainAndPull } from "@/lib/actions/admin";
import { useState } from "react";
import { useServerAction, useServerFetch } from "../common/serverActions";
import { Loading } from "../common/loadingIndicator";

export const GitStatus = () => {
  const result = useServerFetch(getGitStatus, {});
  const pull = useServerAction(gitCheckoutMainAndPull);
  return (
    <div>
      {result.loading ? (
        <Loading />
      ) : (
        <pre>
          {JSON.stringify(JSON.parse(result.data || "{}"), null, 2)}{" "}
          {result.error}
        </pre>
      )}
      <button
        onClick={async (e) => {
          await pull.execute({});
          result.refetch();
        }}
        className="bg-emerald-300 py-2 px-3 rounded-md"
      >
        Checkout main and pull {pull.loading && <Loading />}
      </button>
    </div>
  );
};
