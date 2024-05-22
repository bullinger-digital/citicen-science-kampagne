"use client";

import {
  addComment,
  deleteComment,
  getComments,
  resolveComment,
} from "@/lib/actions/comments";
import { useServerAction, useServerFetch } from "./serverActions";
import { Loading } from "./loadingIndicator";
import { useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { isInRole } from "@/lib/security/isInRole";
import { FaRegTrashAlt } from "react-icons/fa";

export const Comments = ({ target }: { target: string }) => {
  const [showResolved, setShowResolved] = useState(false);
  const [newComment, setNewComment] = useState("");
  const session = useUser();
  const { data, loading, error, refetch } = useServerFetch(getComments, {
    target,
  });
  const addCommentAction = useServerAction(addComment);
  const resolveCommentAction = useServerAction(resolveComment);
  const deleteCommentAction = useServerAction(deleteComment);
  const isAdmin = isInRole(session, "admin");

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <div>Error loading comments</div>;
  }

  return (
    <div>
      <div>
        {data
          ?.filter((c) => showResolved || c.resolved_log_id === null)
          .map((comment) => {
            const canEdit =
              session.user?.sub === comment.created_by_sub || isAdmin;
            return (
              <div
                key={comment.id}
                className="pb-2 border-l border-gray-200 relative"
              >
                <div className="rounded-full basis-3 shrink-0 grow-0 bg-gray-300 w-2 h-2 absolute top-1.5 -left-1"></div>
                <div className="pl-4" style={{ wordBreak: "break-word" }}>
                  <div className="flex justify-between">
                    <div className="text-sm text-gray-400">
                      Benutzer {comment.created_by_id} am{" "}
                      {comment.created_log_timestamp?.toLocaleDateString("de")}
                    </div>
                    {canEdit && (
                      <div>
                        <button
                          onClick={async () => {
                            if (
                              !confirm(
                                "Kommentar wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
                              )
                            ) {
                              return;
                            }
                            await deleteCommentAction.execute({
                              id: comment.id,
                            });
                            refetch();
                          }}
                          title="Kommentar löschen"
                          className="mr-2"
                        >
                          <FaRegTrashAlt />
                        </button>
                        {isAdmin && (
                          <input
                            type="checkbox"
                            checked={comment.resolved_log_id !== null}
                            onChange={async () => {
                              await resolveCommentAction.execute({
                                id: comment.id,
                                resolved: !comment.resolved_log_id,
                              });
                              refetch();
                            }}
                            title="Kommentar als erledigt markieren"
                          />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-sm">
                    <Multiline text={comment.content} />
                  </div>
                </div>
              </div>
            );
          })}
      </div>
      <div className=" text-right">
        <textarea
          className="border border-gray-300 rounded-md p-2 w-full block text-sm"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          maxLength={2000}
        />
        <button
          onClick={async () => {
            await addCommentAction.execute({ target, content: newComment });
            setNewComment("");
            refetch();
          }}
          className="text-sm bg-emerald-300 text-white px-4 py-2 rounded-b-md disabled:bg-gray-200"
          disabled={newComment.length === 0}
        >
          Kommentar hinzufügen
        </button>
        {isAdmin && (
          <>
            {" "}
            <br />
            <button
              className="underline text-sm"
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved
                ? "Erledigte Kommentare ausblenden"
                : "Erledigte Kommentare anzeigen"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export const Multiline = ({ text }: { text: string }) => (
  <>
    {text.split(/\n|\r\n/).map((segment, index) => (
      <>
        {index > 0 && <br />}
        {segment}
      </>
    ))}
  </>
);
