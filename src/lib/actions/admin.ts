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
import simpleGit from "simple-git";
import { repoPath } from "../git/common";
import { sql } from "kysely";
import { LOCK_DURATION } from "./locking_common";
import { xmlParseFromString, xmlSerializeToString } from "../xmlSerialize";
import { EditorAction, applyNewActions, prepareActionsForSave } from "../xml";

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
        e
          .selectFrom(table.replace("_version", "") as "person" | "place")
          .where("id", "=", e.ref(`${table as "person_version"}.id`))
          .select("computed_link_counts")
          .as("computed_link_counts")
      )
    )
    .execute();
};

export const getUncommitedChanges = async () => {
  await requireRoleOrThrow("admin");

  const letterChanges = await uncommitedChangesByTable("letter_version");
  const personChanges = await uncommitedChangesByTable("person_version");
  const placeChanges = await uncommitedChangesByTable("place_version");

  return [
    ...letterChanges.map((l) => ({ table: "letter" as const, ...l })),
    ...personChanges.map((p) => ({ table: "person" as const, ...p })),
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
    const logId = await v.createLogId("move-usages");

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
      const selector = `${tagName}[ref="${refPrefix}${fromId}"]`;
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

      if (Array.from(dom.querySelectorAll(selector)).length > 0) {
        // If there are still instances of the old person / place, we should throw an error
        throw new Error(
          `Cannot move usages: Not all instances of ${tagName} with ref ${refPrefix}${fromId} were updated, probably because those are located outside of the <text> element. This will be fixed in a later version.`
        );
      }
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

      await v.updateComputedLinkCounts({
        letterId: currentVersion.id,
      });
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

// Temporary functions to clean up data issues
import fs from "fs";

// In the first stage, we did not add type="citizen_name" to <persName> and <placeName> elements
// this function adds this attribute to all existing elements.
export const tempAddTypeCitizenNameAttribute = async () => {
  await requireRoleOrThrow("data-admin");

  await kdb.transaction().execute(async (db) => {
    // Lock letter_versions table to prevent concurrent changes
    await sql`LOCK TABLE letter_version IN EXCLUSIVE MODE;`.execute(db);

    // ______________________________
    // First, we need to fix already applied "move usages" actions
    // 1. Get all letter versions where created_log_id.log_type = 'review' (this is how we can identify the move usages actions for now)
    // 2. Replace actions with type "selector-set-attributes"
    // 3. Replace XML with previous XML and action applied
    // 4. Check if the stored XML on the version equals the XML after applying the action

    const moveUsagesVersions = await db
      .selectFrom("letter_version")
      .leftJoin("log", "created_log_id", "log.id")
      .where("log.log_type", "=", "review")
      .selectAll("letter_version")
      .execute();

    const moveUsagesMap: {
      [key: number]: {
        selector: string;
        attributes: {
          ref: string;
        };
      };
    } = {
      2300: {
        selector: "persName[ref='p20242']",
        attributes: {
          ref: "p2254",
        },
      },
      3913: {
        selector: "placeName[ref='l2696']",
        attributes: {
          ref: "l1241",
        },
      },
    };

    for (const v of moveUsagesVersions) {
      const previousVersion = await db
        .selectFrom("letter_version")
        .where("id", "=", v.id)
        .where("version_id", "<", v.version_id)
        .orderBy("version_id", "desc")
        .select("xml")
        .limit(1)
        .executeTakeFirstOrThrow();

      const dom = xmlParseFromString(previousVersion.xml);
      const moveUsage = moveUsagesMap[v.created_log_id];

      if (!moveUsage) {
        throw new Error(
          `Move usage not found for letter version ${v.created_log_id}`
        );
      }

      const actions = [
        {
          type: "selector-set-attributes" as const,
          selector: moveUsage.selector,
          attributes: moveUsage.attributes,
        },
      ];

      applyNewActions(dom, actions);

      const newXml = xmlSerializeToString(dom);

      if (newXml !== v.xml) {
        fs.writeFileSync("./temp-should.xml", v.xml);
        fs.writeFileSync("./temp-is.xml", newXml);

        throw new Error(
          "New XML does not equal old XML, this should not happen"
        );
      }

      await db
        .updateTable("letter_version")
        .set("actions", prepareActionsForSave(actions))
        .where("id", "=", v.id)
        .where("version_id", "=", v.version_id)
        .execute();

      await db
        .updateTable("log")
        .set("log_type", "move-usages")
        .where("id", "=", v.created_log_id)
        .execute();

      console.log(
        `move usages for letter ${v.id} (log id ${v.created_log_id}) updated`
      );
    }

    // ______________________________

    const modifiedLetterIds = await db
      .selectFrom("letter_version")
      .where(whereCurrent)
      .where("is_touched", "=", true)
      .select("id")
      .orderBy("id", "asc")
      .execute();

    for (const { id } of modifiedLetterIds) {
      console.log("Add citizen_name attribute, processing letter", id);
      // Todo: Fetch versions new after modifying :-asduasd098
      const versions = await db
        .selectFrom("letter_version")
        .where("id", "=", id)
        .orderBy("version_id asc")
        .selectAll()
        .execute();

      let previousVersionXml: string | undefined;

      for (const version of versions) {
        const actions = (version.actions || []) as any as EditorAction[];

        if (actions.length === 0) {
          previousVersionXml = version.xml;
          continue;
        }

        if (!previousVersionXml) {
          throw new Error("Previous version XML not found");
        }

        const newActions = actions.map((action) => {
          if (
            action.type === "wrap" ||
            (action.type === "change-attributes" &&
              action.nodePath.some(
                (p) => p.nodeName === "persName" || p.nodeName === "placeName"
              ))
          ) {
            return {
              ...action,
              attributes: {
                type: "citizen_name",
                ...(action.attributes || {}),
              },
            };
          }
          return action;
        });

        const previousDom = xmlParseFromString(previousVersionXml);
        applyNewActions(previousDom, newActions);
        const newXml = xmlSerializeToString(previousDom);

        if (
          newXml.replace(/ type="(citizen|auto)_name"/g, "") !==
          version.xml.replace(/ type="auto_name"/g, "")
        ) {
          fs.writeFileSync(
            "./temp-should.xml",
            version.xml.replace(/ type="auto_name"/g, "")
          );
          fs.writeFileSync(
            "./temp-is.xml",
            newXml.replace(/ type="(citizen|auto)_name"/g, "")
          );

          throw new Error(
            "New XML with removed citizen_name attributes does not equal previous XML"
          );
        }

        previousVersionXml = newXml;

        await db
          .updateTable("letter_version")
          .set("xml", newXml)
          .set("actions", prepareActionsForSave(actions))
          .where("id", "=", id)
          .where("version_id", "=", version.version_id)
          .execute();
      }
    }

    // Validate all versions
    console.log("Validating all versions");
    const letterIds = await db.selectFrom("letter").select("id").execute();

    for (const { id } of letterIds) {
      const versions = await db
        .selectFrom("letter_version")
        .where("id", "=", id)
        .orderBy("version_id", "asc")
        .selectAll()
        .execute();

      let previousXml: string | undefined = undefined;

      for (const version of versions) {
        const actions = (version.actions || []) as any as EditorAction[];

        if (!previousXml) {
          previousXml = version.xml;
          continue;
        }

        const dom = xmlParseFromString(previousXml);
        try {
          applyNewActions(dom, actions);
        } catch (e) {
          console.error(
            "Error applying actions for letter",
            id,
            version.version_id
          );
          console.log(actions);
          throw e;
        }
        const newXml = xmlSerializeToString(dom);

        if (newXml !== version.xml) {
          fs.writeFileSync("./temp-should.xml", version.xml);
          fs.writeFileSync("./temp-is.xml", newXml);
          throw new Error(
            `New XML does not equal old XML for letter ${id} version ${version.version_id}`
          );
        }

        previousXml = version.xml;
      }
    }
  });
};
