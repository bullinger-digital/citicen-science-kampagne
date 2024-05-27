"use client";

import { Link } from "@/components/common/navigation-block/link";
import { HomeText } from "@/components/homeText";
import { useUser } from "@auth0/nextjs-auth0/client";
import { IoFilterSharp } from "react-icons/io5";

export default function InsiderPage() {
  const user = useUser();
  return (
    <main className="px-5 pb-5 text-center font-light mt-5 text-2xl">
      {!user.isLoading && (
        <div className="text-base bg-blue-100 max-w-3xl p-5 mb-5 mx-auto">
          {user.user?.email ? (
            <div>
              Sie sind als <em>{user.user.name}</em> angemeldet. Klicken Sie auf
              das Filter-Symbol{" "}
              <IoFilterSharp className="text-2xl inline-block mr-2" /> in der
              Menuleiste, um zu beginnen.
            </div>
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
      )}
      <HomeText />
    </main>
  );
}
