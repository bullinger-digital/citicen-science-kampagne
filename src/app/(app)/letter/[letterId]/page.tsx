"use client";

import { Editor } from "@/components/editor/editor";
import { redirect, useParams } from "next/navigation";
import { useUser, withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { isInRole } from "@/lib/security/isInRole";

export default withPageAuthRequired(function LetterPage() {
  const user = useUser();
  const params = useParams<{ letterId: string }>();

  if (!isInRole(user, "admin")) {
    return redirect("/");
  }

  if (!params?.letterId || isNaN(parseInt(params.letterId))) {
    return (
      <div className="text-center p-5">
        <h2 className="font-bold">Fehler</h2>
        Es ist ein Fehler aufgetreten: &quot;{params?.letterId}&quot; ist keine
        gültige Brief-ID.
      </div>
    );
  }

  return (
    <main className="px-5 pb-5">
      <Editor letterId={parseInt(params.letterId)} />
    </main>
  );
});
