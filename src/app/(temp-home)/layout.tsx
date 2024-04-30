import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { EmailVerificationInfo, ProfileClient } from "@/components/user/user";
import { RandomLetterButton } from "@/components/randomLetterButton";
import Link from "next/link";

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
      <UserProvider>
        <body className={inter.className + " text-gray-700 bg-zinc-50 my-10"}>
          {children}
        </body>
      </UserProvider>
    </html>
  );
}
