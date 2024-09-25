"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { FaDice } from "react-icons/fa6";
import { Link } from "./navigation-block/link";
import RecentWork from "../recentWork";

export default function LoginRegisterInfo() {
  const user = useUser();
  return user.isLoading ? null : (
    <div className="text-base bg-blue-100 max-w-3xl p-5 mb-5 mx-auto">
      {user.user?.email ? (
        <>
          <div>
            Sie sind als <em>{user.user.name}</em> angemeldet. Klicken Sie auf
            das Würfel-Symbol{" "}
            <FaDice className="text-2xl inline-block mr-2 -mt-1" />
            in der Menuleiste, um mit einem zufälligen Brief zu beginnen.
          </div>
          <RecentWork />
        </>
      ) : (
        <div>
          Um an der Kampagne teilzunehmen, müssen Sie sich mit ihrem
          persönlichen Login anmelden.
          <br />
          <Link href="/api/auth/login" className="underline">
            Anmelden
          </Link>{" "}
          oder{" "}
          <Link href="/api/auth/signup" className="underline">
            Registrieren
          </Link>
        </div>
      )}
    </div>
  );
}
