import { importFromCurrentCommit } from "@/lib/git/import";
import { withRequireRoleAppApi } from "@/lib/security/withRequireRole";

import { NextRequest } from "next/server";

export const GET = withRequireRoleAppApi(
  "data-admin",
  async (req: NextRequest) => {
    console.log("Route called: importing from repository");
    await importFromCurrentCommit();
    return new Response("Import done!");
  }
);
