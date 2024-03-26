import { Session } from "@auth0/nextjs-auth0";
import { UserContext } from "@auth0/nextjs-auth0/client";

export const isInRole = (session: Session | UserContext, roleName: string) => {
  return (
    session &&
    session.user &&
    session.user["citizen-science/roles"].indexOf(roleName) !== -1
  );
};
