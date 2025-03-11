"use client";

import { useUser } from "@auth0/nextjs-auth0/client";

export const EmailVerificationInfo = () => {
  const { user, error, isLoading } = useUser();

  if (isLoading) return null;
  if (error) return <div>{error.message}</div>;

  if (!user || user.email_verified) return null;

  return (
    <div className="px-5 py-3 bg-orange-50">
      Ihre E-Mail-Adresse wurde noch nicht verifiziert. Bitte überprüfen Sie Ihr
      E-Mail-Postfach, verifizieren Sie Ihre E-Mail Adresse und{" "}
      <a
        className="text-blue-400 cursor-pointer"
        onClick={async () => {
          const response = await fetch("/api/auth/refresh-profile");
          const session: any = await response.json();

          if (session.email_verified) {
            window.location.reload();
          }
        }}
      >
        klicken Sie hier
      </a>
      .
    </div>
  );
};

export const ProfileClient = () => {
  const { user, error, isLoading } = useUser();

  if (error) return <div>{error.message}</div>;

  const userName: string =
    (user as any)?.["citizen-science/username"] || "(unknown)";
  const roles: string[] = (user as any)?.["citizen-science/roles"] || [];

  return (
    <div className="flex">
      {!isLoading && (
        <div className="self-center mr-3 text-right">
          {user ? (
            <div>
              <h2>{userName}</h2>
              {/* <div>Permissions: {roles.join(", ")}</div> */}
              <a className="text-blue-400" href="/api/auth/logout">
                Abmelden
              </a>
            </div>
          ) : (
            <div>
              <a className="text-blue-400" href="/api/auth/login">
                Anmelden
              </a>
            </div>
          )}
        </div>
      )}
      <div className="self-center">
        {user?.picture ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="rounded-full w-12 h-12"
            src={user.picture}
            alt={userName || ""}
          />
        ) : (
          <div className="rounded-full w-14 h-14 bg-[#8a9b9c]"></div>
        )}
      </div>
    </div>
  );
};
