"use server";
import { ExpressionBuilder } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { kdb } from "../db";
import { DB } from "../generated/kysely-codegen";
import { requireRoleOrThrow } from "../security/withRequireRole";
import {
  Versioned,
  VersionedTable,
  Versioning,
  whereCurrent,
} from "../versioning";
import { jsonObjectFrom } from "kysely/helpers/postgres";

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
    .selectFrom<VersionedTable>(table)
    // Todo: Fix typing
    .innerJoin("log", "created_log_id", "log.id")
    .where(whereCurrent)
    .where("review_state", "=", "pending")
    .selectAll("log")
    .select((e) =>
      jsonObjectFrom(
        e
          .selectFrom(`${table as "letter_version"} as unmodified`)
          .where("git_import_id", "=", (e) =>
            e
              .selectFrom("git_import")
              .select("id")
              .where("is_current", "is", true)
          )
          .where("is_touched", "=", false)
          .where("unmodified.id", "=", e.ref(`${table as "letter_version"}.id`))
          .selectAll()
      ).as("unmodified")
    )
    .select((e) =>
      jsonObjectFrom(
        e
          .selectFrom(`${table as "letter_version"} as modified`)
          .where(
            "modified.version_id",
            "=",
            e.ref(`${table as "letter_version"}.version_id`)
          )
          .selectAll()
      ).as("modified")
    )
    .select((e) =>
      jsonArrayFrom(
        e
          .selectFrom("letter_version as v")
          .where(whereCurrent as any)
          .where((e) =>
            e.or([
              e.and([
                e(e.val(table), "=", "person_version" as any),
                e.exists(
                  e
                    .selectFrom("letter_version_extract_person as ex_p")
                    .where("ex_p.version_id", "=", e.ref("v.version_id"))
                    .where(
                      "ex_p.person_id",
                      "=",
                      e.ref(`${table as "person_version"}.id` as any)
                    )
                ),
              ]),
              e.and([
                e(e.val(table), "=", "place_version" as any),
                e.exists(
                  e
                    .selectFrom("letter_version_extract_place as ex_pl")
                    .where("ex_pl.version_id", "=", e.ref("v.version_id"))
                    .where(
                      "ex_pl.place_id",
                      "=",
                      e.ref(`${table as "place_version"}.id` as any)
                    )
                ),
              ]),
            ])
          )
          .orderBy("v.id")
          .select("v.id")
      ).as("usages")
    )
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
    ...letterChanges.map((l) => ({ table: "letter" as const, ...l })),
    ...personChanges.map((p) => ({ table: "person" as const, ...p })),
    ...personAliasChanges.map((pa) => ({
      table: "person_alias" as const,
      ...pa,
    })),
    ...placeChanges.map((pl) => ({ table: "place" as const, ...pl })),
  ];
};

export const acceptChange = async ({
  table,
  versionId,
}: {
  table: Versioned;
  versionId: number;
}) => {
  await requireRoleOrThrow("admin");

  const v = new Versioning();
  await v.acceptChange({
    table,
    versionId,
  });
};

export const rejectChange = async ({
  table,
  versionId,
}: {
  table: Versioned;
  versionId: number;
}) => {
  await requireRoleOrThrow("admin");

  const v = new Versioning();
  await v.rejectChange({
    table,
    versionId,
  });
};
