import { kdb } from "@/lib/db";
import {
  AfterCallbackAppRoute,
  handleAuth,
  handleCallback,
  handleLogin,
  handleProfile,
} from "@auth0/nextjs-auth0";

const afterCallback: AfterCallbackAppRoute = async (req, session, state) => {
  if (session.user) {
    const existingUser = await kdb
      .selectFrom("user")
      .where("email", "=", session.user.email)
      .selectAll()
      .executeTakeFirst();

    const updatedUser = {
      user_name: (session.user as any)?.["citizen-science/username"],
      email: session.user.email,
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      roles: JSON.stringify((session.user as any)?.["citizen-science/roles"]),
      sub: session.user.sub,
    };

    if (existingUser) {
      await kdb
        .updateTable("user")
        .set(updatedUser)
        .where("email", "=", session.user.email)
        .execute();
    } else {
      await kdb
        .insertInto("user")
        .values({
          ...updatedUser,
        })
        .execute();
    }
  }

  return session;
};

export const GET = handleAuth({
  "refresh-profile": handleProfile({
    refetch: true,
  }),
  callback: handleCallback({ afterCallback: afterCallback }),
  signup: handleLogin({
    authorizationParams: { screen_hint: "signup" },
    returnTo: "/",
  }),
  login: handleLogin({
    returnTo: "/",
  }),
});
