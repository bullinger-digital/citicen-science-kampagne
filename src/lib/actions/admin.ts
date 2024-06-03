"use server";
import "server-only";

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
import simpleGit from "simple-git";
import { repoPath } from "../git/common";
import { sql } from "kysely";
import { LOCK_DURATION } from "./locking_common";
import { xmlParseFromString, xmlSerializeToString } from "../xmlSerialize";

export const getPeopleOnline = async () => {
  return (
    await kdb
      .selectFrom("letter_lock")
      .where("locked_at", ">", new Date(Date.now() - 1000 * 60 * 5))
      .select(sql<number>`COUNT(DISTINCT locked_by_id)`.as("count"))
      .executeTakeFirst()
  )?.count;
};

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
  const rawTable = table.replace("_version", "");

  return await kdb
    .selectFrom<VersionedTable>(table)
    .leftJoin("log", "created_log_id", "log.id")
    .where(whereCurrent)
    .where("review_state", "=", "pending")
    .selectAll("log")
    .orderBy(`${table as "letter_version"}.id`, "asc")
    // Select the last accepted version
    .select((e) =>
      jsonObjectFrom(
        e
          .selectFrom(`${table as "letter_version"} as last_accepted`)
          .where("git_import_id", "=", (e) =>
            e.ref(`${table as "letter_version"}.git_import_id`)
          )
          .where("review_state", "=", "accepted")
          .where(
            "last_accepted.id",
            "=",
            e.ref(`${table as "letter_version"}.id`)
          )
          .orderBy("last_accepted.version_id", "desc")
          .limit(1)
          .selectAll()
      ).as("last_accepted")
    )
    // Select the imported version (unmodified)
    .select((e) =>
      jsonObjectFrom(
        e
          .selectFrom(`${table as "letter_version"} as unmodified`)
          .where("git_import_id", "=", (e) =>
            e.ref(`${table as "letter_version"}.git_import_id`)
          )
          .where("is_touched", "=", false)
          .where("unmodified.id", "=", e.ref(`${table as "letter_version"}.id`))
          .limit(1)
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
    // Select count of linked comments
    .select((e) =>
      jsonObjectFrom(
        e
          .selectFrom("comment")
          .where(
            "target",
            "=",
            sql<string>`${e.val(table.replace("_version", "") + "/")} || ${e.ref(`${table as "letter_version"}.id`)}`
          )
          .where("comment.deleted_log_id", "is", null)
          .select((e) => e.fn.countAll<number>().as("count"))
      ).as("comment_count")
    )
    .$if(table === "person_version" || table === "place_version", (e) =>
      e.select((e) =>
        jsonArrayFrom(
          e
            .selectFrom("letter_version as v")
            .where(whereCurrent as any)
            .where((e) =>
              e.exists(
                e
                  .selectFrom(
                    `letter_version_extract_${rawTable as "person"} as ex_p`
                  )
                  .where("ex_p.version_id", "=", e.ref("v.version_id"))
                  .where(
                    `ex_p.${rawTable as "person"}_id`,
                    "=",
                    e.ref(`${table as "person_version"}.id`)
                  )
              )
            )
            .orderBy("v.id")
            .select("v.id")
        ).as("usages")
      )
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
    ...personChanges.map((p) => ({
      table: "person" as const,
      ...p,
      aliasChanges: personAliasChanges.filter(
        (pa) => pa.modified?.person_id === p.modified?.id
      ),
    })),
    ...personAliasChanges
      .filter(
        (p) =>
          !personChanges.some((pc) => pc.modified?.id === p.modified?.person_id)
      )
      .map((pa) => ({
        table: "person_alias" as const,
        ...pa,
      })),
    ...placeChanges.map((pl) => ({ table: "place" as const, ...pl })),
  ];
};

/**
 * Move all usages of a person or place to another person or place
 * @param param0
 */
export const moveUsages = async ({
  table,
  fromId,
  toId,
}: {
  table: "person" | "place";
  fromId: number;
  toId: number;
}) => {
  await requireRoleOrThrow("admin");

  await kdb.transaction().execute(async (db) => {
    // Lock letter_version table to prevent concurrent changes
    await sql`LOCK TABLE letter_version IN EXCLUSIVE MODE;`.execute(db);
    const v = new Versioning(db);
    const logId = await v.createLogId("review");

    // Get all usages of the person or place
    const usages = await db
      .selectFrom(`letter_version_extract_${table as "place"} as ex`)
      .leftJoin("letter_version", "ex.version_id", "letter_version.version_id")
      .where(`${table as "place"}_id`, "=", fromId)
      .where(whereCurrent as any)
      // .where((e) =>
      //   e.exists(
      //     e
      //       .selectFrom(`letter_version_extract_${table as "place"} as ex`)
      //       .where("ex.version_id", "=", e.ref("letter_version.version_id"))
      //       .where(`${table as "place"}_id`, "=", fromId)
      //   )
      // )
      .select("letter_version.id")
      .select("ex.link_type")
      .execute();

    if (usages.length === 0) {
      throw new Error("Cannot move usages: No usages found");
    }

    if (usages.some((e) => e.link_type !== "mentioned")) {
      console.log(usages);
      throw new Error(
        "Cannot move usages: Only mentions can be moved (but there are letters with other link types)"
      );
    }

    // Check if the target person or place exists
    const target = await db
      .selectFrom(`${table}_version`)
      .where(whereCurrent)
      .where("id", "=", toId)
      .select("id")
      .executeTakeFirst();

    if (!target) {
      throw new Error(
        `Cannot move usages: Target ${table} with ID ${toId} not found`
      );
    }

    // Check if any of the letters are currently locked and fail if this is the case
    const lockedLetters = await db
      .selectFrom("letter_lock")
      .where(
        "id",
        "in",
        usages.map((u) => u.id)
      )
      .where("letter_lock.locked_at", ">", new Date(Date.now() - LOCK_DURATION))
      .select((e) => e.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();

    if (lockedLetters.count > 0) {
      throw new Error("Cannot move usages: Some letters are currently locked");
    }

    const tagName = table === "person" ? "persName" : "placeName";
    const refPrefix = table === "person" ? "p" : "l";

    // Update all usages
    for (const usage of usages) {
      if (!usage.id) throw new Error("Letter id not found to move");

      const currentVersion = await v.getCurrentVersion("letter", usage.id);
      if (!currentVersion) {
        throw new Error(`Cannot move usages: Letter ${usage.id} not found`);
      }
      // Replace the old instance id with the new one
      const dom = xmlParseFromString(currentVersion.xml);
      // Find all instances of tagName[ref=fromId] INSIDE  and replace them with tagName[ref=toId]
      const elements = dom.querySelectorAll(
        `${tagName}[ref="${refPrefix}${fromId}"]`
      );
      for (const element of Array.from(elements)) {
        element.setAttribute("ref", refPrefix + toId.toString());
      }

      // Update the letter
      await v.createNewVersion(
        "letter",
        currentVersion.id,
        currentVersion.version_id,
        {
          xml: xmlSerializeToString(dom),
        },
        false,
        logId,
        true
      );
    }
  });
};

export const acceptChanges = async ({
  items,
}: {
  items: { table: Versioned; versionId: number }[];
}) => {
  await requireRoleOrThrow("admin");

  const v = new Versioning();
  await v.acceptChanges({
    items,
  });
};

export const rejectChanges = async ({
  items,
}: {
  items: { table: Versioned; versionId: number }[];
}) => {
  await requireRoleOrThrow("admin");

  const v = new Versioning();
  await v.rejectChanges({ items });
};

export const getGitStatus = async () => {
  await requireRoleOrThrow("data-admin");

  const git = simpleGit(repoPath);
  const s = await git.status();

  return JSON.stringify(s);
};

export const gitCheckoutMainAndPull = async () => {
  await requireRoleOrThrow("data-admin");

  const git = simpleGit(repoPath);
  await git.checkout("main");
  await git.pull();
};

export const updateComputedLinkCounts = async () => {
  await requireRoleOrThrow("data-admin");

  const v = new Versioning();
  await v.updateComputedLinkCounts({});
};
