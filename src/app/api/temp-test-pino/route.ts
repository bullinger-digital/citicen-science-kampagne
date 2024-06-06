import logger from "@/lib/logger/logger";
import { withRequireRoleAppApi } from "@/lib/security/withRequireRole";

import { NextRequest } from "next/server";

export const GET = withRequireRoleAppApi(
  "data-admin",
  async (req: NextRequest) => {
    logger.info(
      { test: "Route called: temp-test-pino" },
      "Testing Pino logging"
    );
    return new Response("Done! Check the logs.");
  }
);
