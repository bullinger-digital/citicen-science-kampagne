"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { FaDice } from "react-icons/fa6";
import { Link } from "./navigation-block/link";
import RecentWork from "../recentWork";
import { isInRole } from "@/lib/security/isInRole";

export default function LoginRegisterInfo() {
  const user = useUser();
  const isAdmin = isInRole(user, "admin");

  return !isAdmin || user.isLoading || !user.user?.email ? null : (
    <div className="text-base bg-blue-100 max-w-3xl p-5 mb-5 mx-auto">
      <div>
        Sie sind als <em>{user.user.name}</em> angemeldet. Klicken Sie auf das
        Würfel-Symbol <FaDice className="text-2xl inline-block mr-2 -mt-1" />
        in der Menuleiste, um mit einem zufälligen Brief zu beginnen.
      </div>
      <RecentWork />
    </div>
  );
}
