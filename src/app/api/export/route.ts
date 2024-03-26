import { exportToCurrentCommit } from "@/lib/git";
import { withRequireRoleAppApi } from "@/lib/security/withRequireRole";

import { NextRequest } from "next/server";

export const GET = withRequireRoleAppApi("admin", async (req: NextRequest) => {
  await exportToCurrentCommit();
  return new Response("Export done!");
});
