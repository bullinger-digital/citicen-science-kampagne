"use server";
import { ExpressionBuilder } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { kdb } from "../db";
import { DB } from "../generated/kysely-codegen";
import { requireRoleOrThrow } from "../security/withRequireRole";
import { Versioned, VersionedTable, whereCurrent } from "../versioning";

export const getLogs = async () => {
  await requireRoleOrThrow("admin");
  const selectRelatedCounts =
    (table: Versioned) => (eb: ExpressionBuilder<DB, "log">) =>
      eb
        .selectFrom(`${table}_version as v`)
        .where("v.created_log_id", "=", eb.ref("log.id"))
        .select((e) => e.fn.countAll<number>().as("count"))
        .limit(1)
        .as(`${table}_modified_count`);

  // Todo: Should we store the commit hash in the logs table? Probably yes, so we know which commit the log is related to
  // (for debugging)
  let query = kdb
    .selectFrom("log")
    .orderBy("timestamp", "desc")
    .selectAll()
    .select([
      (e) =>
        jsonArrayFrom(
          e
            .selectFrom("user")
            .where("id", "=", e.ref("log.created_by_id"))
            .select(["user_name"])
            .limit(1)
        ).as("user"),
    ])
    .select(selectRelatedCounts("letter"))
    .select(selectRelatedCounts("person"))
    .select(selectRelatedCounts("person_alias"))
    .select(selectRelatedCounts("place"))
    .limit(100);

  return await query.execute();
};

const uncommitedChangesByTable = async <T extends VersionedTable>(table: T) => {
  return await kdb
    .selectFrom(table)
    // Todo: Fix typing
    .innerJoin("log", "created_log_id" as any, "log.id" as any)
    .where(whereCurrent as any)
    .where("review_state" as any, "=", "pending")
    .selectAll()
    .execute();
};

export const getUncommitedChanges = async () => {
  await requireRoleOrThrow("admin");

  const letterChanges = await uncommitedChangesByTable("letter_version");
  const personChanges = await uncommitedChangesByTable("person_version");
  const personAliasChanges = await uncommitedChangesByTable(
    "person_alias_version"
  );
  const placeChanges = await uncommitedChangesByTable("place_version");

  return [
    ...letterChanges.map((l) => ({ table: "letter", item: l })),
    ...personChanges.map((p) => ({ table: "person", item: p })),
    ...personAliasChanges.map((pa) => ({ table: "person_alias", item: pa })),
    ...placeChanges.map((pl) => ({ table: "place", item: pl })),
  ];
};
