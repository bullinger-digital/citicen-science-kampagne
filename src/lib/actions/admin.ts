"use server";
import { ExpressionBuilder } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { kdb } from "../db";
import { DB } from "../generated/kysely-codegen";
import { requireRoleOrThrow } from "../security/withRequireRole";
import { Versioned } from "../versioning";

export const getLogs = async () => {
  await requireRoleOrThrow("user");
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
