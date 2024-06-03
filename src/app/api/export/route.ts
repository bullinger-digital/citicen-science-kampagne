import { BRANCH_NAME, exportToCurrentCommit } from "@/lib/git/export";
import { withRequireRoleAppApi } from "@/lib/security/withRequireRole";

import { NextRequest } from "next/server";

export const GET = withRequireRoleAppApi(
  "data-admin",
  async (req: NextRequest) => {
    await exportToCurrentCommit();
    return Response.redirect(
      `https://github.com/bullinger-digital/bullinger-korpus-tei/compare/${BRANCH_NAME}?expand=1`
    );
  }
);
