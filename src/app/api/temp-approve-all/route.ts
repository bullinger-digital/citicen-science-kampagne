import { withRequireRoleAppApi } from "@/lib/security/withRequireRole";
import { kdb } from "@/lib/db";
import { NextRequest } from "next/server";
import { Versioning } from "@/lib/versioning";

export const GET = withRequireRoleAppApi("admin", async (req: NextRequest) => {
  const v = new Versioning();
  await v.tempApproveAllChanges();
  return new Response("Approved all changes!");
});
