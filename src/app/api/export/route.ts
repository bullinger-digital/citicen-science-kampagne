import { exportToCurrentCommit } from "@/lib/git/export";
import { withRequireRoleAppApi } from "@/lib/security/withRequireRole";

import { NextRequest } from "next/server";

export const GET = withRequireRoleAppApi("admin", async (req: NextRequest) => {
  await exportToCurrentCommit();
  return Response.redirect(
    "https://github.com/bullinger-digital/bullinger-korpus-tei/compare/citizen-science-experiments?expand=1"
  );
});
