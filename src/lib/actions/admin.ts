"use server";
import "server-only";

import { ExpressionBuilder } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { DB, kdb } from "../db";
import { requireRoleOrThrow } from "../security/withRequireRole";
import {
  Versioned,
  VersionedTable,
  Versioning,
  whereCurrent,
} from "../versioning";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { sql } from "kysely";
import { LOCK_DURATION } from "./locking_common";
import { xmlParseFromString, xmlSerializeToString } from "../xmlSerialize";
import { applyNewActions, prepareActionsForSave } from "../xml";
import { Kysely } from "kysely";

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
    .select(selectRelatedCounts("place"))
    .limit(100);

  return await query.execute();
};

const countUncommitedChangesByTable = async <T extends VersionedTable>({
  table,
}: {
  table: T;
}) => {
  return await kdb
    .selectFrom<VersionedTable>(table)
    .where(whereCurrent)
    .where("review_state", "=", "pending")
    .select((e) => e.fn.countAll<number>().as("count"))
    .executeTakeFirst();
};

const uncommitedChangesByTable = async <T extends VersionedTable>({
  table,
  limit,
  offset,
}: {
  table: T;
  limit: number;
  offset: number;
}) => {
  return await kdb
    .selectFrom<VersionedTable>(table)
    .leftJoin("log", "created_log_id", "log.id")
    .where(whereCurrent)
    .where("review_state", "=", "pending")
    .selectAll("log")
    .orderBy(`${table as "letter_version"}.id`, "asc")
    // Select user ID and time of recent user change
    .select((e) =>
      jsonObjectFrom(
        e
          .selectFrom<`${VersionedTable} as recent`>(`${table} as recent`)
          .where("recent.id", "=", e.ref(`${table as "letter_version"}.id`))
          .orderBy("recent.version_id desc")
          .leftJoin(
            "log as log_recent",
            "recent.created_log_id",
            "log_recent.id"
          )
          .where("log_recent.log_type", "=", "user")
          .select("log_recent.created_by_id")
          .select("log_recent.timestamp")
          .limit(1)
      ).as("recently_changed_log")
    )
    // Select the last accepted version
    .select((e) =>
      jsonObjectFrom(
        e
          .selectFrom(`${table as "letter_version"} as last_accepted`)
          .where("review_state", "=", "accepted")
          .where(
            "last_accepted.id",
            "=",
            e.ref(`${table as "letter_version"}.id`)
          )
          .where(
            "last_accepted.version_id",
            "<",
            e.ref(`${table as "letter_version"}.version_id`)
          )
          .orderBy("last_accepted.version_id", "desc")
          .limit(1)
          .selectAll()
      ).as("last_accepted")
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
          .where("comment.resolved_log_id", "is", null)
          .select((e) => e.fn.countAll<number>().as("count"))
      ).as("comment_count")
    )
    .$if(table === "person_version" || table === "place_version", (e) =>
      e.select((e) =>
        e
          .selectFrom(table.replace("_version", "") as "person" | "place")
          .where("id", "=", e.ref(`${table as "person_version"}.id`))
          .select("computed_link_counts")
          .as("computed_link_counts")
      )
    )
    .limit(limit)
    .offset(offset)
    .execute();
};

export const getUncommitedChanges = async ({
  table,
  limit,
  offset = 0,
}: {
  table: VersionedTable;
  limit: number;
  offset?: number;
}) => {
  await requireRoleOrThrow("admin");

  const changes = await uncommitedChangesByTable({ table, limit, offset });
  return {
    changes: changes.map((c) => {
      return { table: table.replace("_version", "") as Versioned, ...c };
    }),
    person_counts: await countUncommitedChangesByTable({
      table: "person_version",
    }),
    place_counts: await countUncommitedChangesByTable({
      table: "place_version",
    }),
  };
};

const getUsages = async ({
  db,
  table,
  id,
}: {
  db: Kysely<DB>;
  table: "person" | "place";
  id: number;
}) => {
  return await kdb
    .selectFrom(`letter_version_extract_${table as "place"}`)
    .leftJoin(
      "letter_version",
      `letter_version_extract_${table as "place"}.version_id`,
      "letter_version.version_id"
    )
    .where(`${table as "place"}_id`, "=", id)
    .where(whereCurrent as any)
    .selectAll(`letter_version_extract_${table as "place"}`)
    .select("letter_version.id as letter_id")
    .execute();
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
    const logId = await v.createLogId("move-usages");

    // Get all usages of the person or place
    const usages = await getUsages({ db, table, id: fromId });

    if (usages.length === 0) {
      throw new Error("Cannot move usages: No usages found");
    }

    if (usages.some((u) => u.link_type !== "mentioned")) {
      throw new Error("Cannot move usages: Only mentioned usages can be moved");
    }

    // Person or places referenced in register files cannot be moved
    const referencedInRegister = await v.isUsedInRegisterFile({
      db,
      table,
      id: fromId,
    });

    if (referencedInRegister) {
      throw new Error(
        `Cannot move usages: ${table} with ID ${fromId} is referenced in register files`
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
        usages.map((u) => u.letter_id)
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
      if (!usage.letter_id) throw new Error("Letter id not found to move");

      const currentVersion = await v.getCurrentVersion(
        "letter",
        usage.letter_id
      );
      if (!currentVersion) {
        throw new Error(
          `Cannot move usages: Letter ${usage.letter_id} not found`
        );
      }
      // Replace the old instance id with the new one
      const dom = xmlParseFromString(currentVersion.xml);
      // Find all instances of tagName[ref=fromId] INSIDE  and replace them with tagName[ref=toId]
      const selector = `${tagName}[ref="${refPrefix}${fromId}"],${tagName}[ref="${fromId}"]`;
      const actions = [
        {
          type: "selector-set-attributes" as const,
          selector: selector,
          attributes: {
            ref: refPrefix + toId.toString(),
          },
        },
      ];

      applyNewActions(dom, actions);

      // Update the letter
      await v.createNewVersion(
        "letter",
        currentVersion.id,
        currentVersion.version_id,
        {
          xml: xmlSerializeToString(dom),
          actions: prepareActionsForSave(actions),
        },
        false,
        logId,
        true
      );
    }

    await v.updateComputedLinkCounts({
      letterIds: usages.map((u) => u.letter_id!),
    });
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
  items: { table: Versioned; versionId: number; restoreToVersionId?: number }[];
}) => {
  await requireRoleOrThrow("admin");

  const v = new Versioning();
  await v.rejectChanges({ items });
};

export const deleteRegisterEntry = async ({
  table,
  id,
}: {
  table: "person" | "place";
  id: number;
}) => {
  await requireRoleOrThrow("admin");

  const v = new Versioning();
  await v.deleteVersioned(table, id);
};
