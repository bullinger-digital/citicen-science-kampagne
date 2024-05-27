import {
  importFromCurrentCommit,
  initRepository,
  pullRepository,
} from "@/lib/git/import";
import { withRequireRoleAppApi } from "@/lib/security/withRequireRole";

import { NextRequest } from "next/server";

export const GET = withRequireRoleAppApi(
  "data-admin",
  async (req: NextRequest) => {
    console.log("Route called: importing from repository");
    await initRepository();
    //await pullRepository();
    await importFromCurrentCommit();
    return new Response("Import done!");
  }
);
