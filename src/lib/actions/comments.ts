"use server";
import "server-only";

import { Kysely, Transaction } from "kysely";
import { DB } from "../generated/kysely-codegen";
import { kdb } from "@/lib/db";
import { Versioning } from "../versioning";
import { requireRoleOrThrow } from "../security/withRequireRole";

export const getComments = async ({ target }: { target: string }) => {
  return await kdb
    .selectFrom("comment")
    .where("target", "=", target)
    .where("deleted_log_id", "is", null)
    .leftJoin("log as created_log", "comment.created_log_id", "created_log.id")
    .leftJoin("log as updated_log", "comment.updated_log_id", "updated_log.id")
    .leftJoin(
      "user as created_by",
      "created_log.created_by_id",
      "created_by.id"
    )
    .leftJoin(
      "user as updated_by",
      "updated_log.created_by_id",
      "updated_by.id"
    )
    .orderBy("created_log.timestamp asc")
    .select([
      "comment.content",
      "comment.id",
      "comment.target",
      "comment.resolved_log_id",
      "created_by.id as created_by_id",
      "created_by.sub as created_by_sub",
      "created_log.timestamp as created_log_timestamp",
      "updated_by.id as updated_by_id",
      "updated_log.timestamp as updated_log_timestamp",
      "resolved_log_id",
    ])
    .execute();
};

export const addComment = async ({
  target,
  content,
}: {
  target: string;
  content: string;
}) => {
  if (content.length > 3000) {
    throw new Error("Comment too long");
  }
  await requireRoleOrThrow("user");
  return await transactionWithLogId(kdb, async (logId, db) => {
    await db
      .insertInto("comment")
      .values({
        content: content,
        target: target,
        created_log_id: logId,
      })
      .execute();
  });
};

export const updateComment = async ({
  id,
  content,
}: {
  id: number;
  content: string;
}) => {
  await requireRoleOrThrow("user");
  return await transactionWithLogId(kdb, async (logId, db) => {
    await verifyAdminOrOwner(id, db);

    await db
      .updateTable("comment")
      .set({ content: content, updated_log_id: logId })
      .where("id", "=", id)
      .execute();
  });
};

export const deleteComment = async ({ id }: { id: number }) => {
  await requireRoleOrThrow("user");
  return await transactionWithLogId(kdb, async (logId, db) => {
    await verifyAdminOrOwner(id, db);

    await db
      .updateTable("comment")
      .set({ deleted_log_id: logId })
      .where("id", "=", id)
      .execute();
  });
};

export const resolveComment = async ({
  id,
  resolved,
}: {
  id: number;
  resolved: boolean;
}) => {
  await requireRoleOrThrow("admin");
  if (resolved) {
    return await transactionWithLogId(kdb, async (logId, db) => {
      await db
        .updateTable("comment")
        .set({ resolved_log_id: logId })
        .where("id", "=", id)
        .execute();
    });
  } else {
    return await transactionWithLogId(kdb, async (logId, db) => {
      await db
        .updateTable("comment")
        .set({ resolved_log_id: null })
        .where("id", "=", id)
        .execute();
    });
  }
};

const verifyAdminOrOwner = async (commentId: number, db: Kysely<DB>) => {
  const v = new Versioning(db);
  const user = await v.getUser();
  const comment = await db
    .selectFrom("comment")
    .where("id", "=", commentId)
    .select((e) =>
      e
        .selectFrom("log")
        .where("id", "=", e.ref("comment.created_log_id"))
        .select("created_by_id")
        .as("created_by_id")
    )
    .executeTakeFirstOrThrow();

  if (user?.id && user?.id === comment.created_by_id) {
    return true;
  }

  await requireRoleOrThrow("admin");
  return true;
};

const transactionWithLogId = async <T>(
  db: Kysely<DB>,
  callback: (logId: number, db: Kysely<DB>) => T
) => {
  if (db.isTransaction) {
    throw new Error("Already in a transaction");
  } else {
    return await db.transaction().execute(async (db) => {
      const v = new Versioning(db);
      const logId = await v.createLogId("user");
      return await callback(logId, db);
    });
  }
};
