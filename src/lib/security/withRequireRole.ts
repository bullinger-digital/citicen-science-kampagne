import "server-only";
import {
  AppRouteHandlerFn,
  getSession,
  withApiAuthRequired,
} from "@auth0/nextjs-auth0";
import { isInRole } from "./isInRole";

export const withRequireRoleAppApi = (
  roleName: string,
  handler: AppRouteHandlerFn
) => {
  return withApiAuthRequired(
    async (
      req: Parameters<AppRouteHandlerFn>[0],
      ctx: Parameters<AppRouteHandlerFn>[1]
    ) => {
      const session = await getSession();
      if (!session || !isInRole(session, roleName)) {
        return new Response("Unauthorized (role " + roleName + " required)", {
          status: 401,
        });
      }
      return handler(req, ctx);
    }
  );
};

export const requireRoleOrThrow = async (roleName: string) => {
  const session = await getSession();
  if (!session || !isInRole(session, roleName)) {
    throw new Error("Unauthorized (role " + roleName + " required)");
  }
};
