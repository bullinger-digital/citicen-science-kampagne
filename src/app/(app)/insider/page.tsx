"use client";

import { Editor } from "@/components/editor/editor";
import { useParams } from "next/navigation";
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { Metadata } from "next";

export default withPageAuthRequired(function InsiderPage() {
  return (
    <main className="px-5 pb-5 text-center font-light mt-5 text-2xl">
      <div>Willkommen</div>
    </main>
  );
});
