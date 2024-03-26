import {
  importFromCurrentCommit,
  initRepository,
  pullRepository,
} from "@/lib/git";
import { withRequireRoleAppApi } from "@/lib/security/withRequireRole";

import { NextRequest } from "next/server";

export const GET = withRequireRoleAppApi("admin", async (req: NextRequest) => {
  await initRepository();
  //await pullRepository();
  await importFromCurrentCommit();
  return new Response("Import done!");
});
