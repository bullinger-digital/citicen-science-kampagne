// Source: https://github.com/vercel/next.js/discussions/41934#discussioncomment-8996669

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { EmailVerificationInfo, ProfileClient } from "@/components/user/user";
import { LetterNavigation } from "@/components/letterNavigation";
import { Link } from "@/components/common/navigation-block/link";
import {
  BlockBrowserNavigation,
  NavigationBlockerProvider,
} from "@/components/common/navigation-block/navigation-block";
import { MdMenuBook, MdOutlineRule } from "react-icons/md";
import { Menu } from "@/components/menu";
import { FaChartPie } from "react-icons/fa6";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bullinger Citizen Science Kampagne",
  description: "Mithelfen bei Bullinger Digital",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <NavigationBlockerProvider>
        <BlockBrowserNavigation />
        <UserProvider>
          <body
            className={
              inter.className + " text-gray-700 bg-zinc-50 print:bg-white"
            }
          >
            <div className="flex justify-between px-5 py-3 print:hidden">
              <div className="flex space-x-5 items-center self-center text-lg font-light">
                <Menu />
                <Link href="/">
                  <h2>Bullinger Digital - Mithelfen</h2>
                </Link>
                <LetterNavigation />
                <Link
                  href="/pages/hilfe"
                  target="_blank"
                  className="flex space-x-2 items-center hover:text-emerald-400"
                >
                  <MdMenuBook className="-top-0.5 relative" />
                  <span>Hilfe</span>
                </Link>
                <Link
                  href="/pages/regeln"
                  target="_blank"
                  className="flex space-x-2 items-center hover:text-emerald-400"
                >
                  <MdOutlineRule className="-top-0.5 relative" />
                  <span>Regeln</span>
                </Link>
                <Link
                  href="/stats"
                  className="flex space-x-2 items-center hover:text-emerald-400"
                  title="Statistiken"
                >
                  <FaChartPie className="-top-0.5 relative" />
                </Link>
              </div>
              <div>
                <ProfileClient />
              </div>
            </div>
            <EmailVerificationInfo />
            {children}
          </body>
        </UserProvider>
      </NavigationBlockerProvider>
    </html>
  );
}
