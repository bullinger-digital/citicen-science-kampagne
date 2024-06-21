"use server";
import "server-only";

import { sql } from "kysely";
import simpleGit from "simple-git";
import { kdb } from "../db";
import { repoPath } from "../git/common";
import { requireRoleOrThrow } from "../security/withRequireRole";
import { Versioning, whereCurrent } from "../versioning";
import { applyNewActions, prepareActionsForSave, EditorAction } from "../xml";
import { xmlParseFromString, xmlSerializeToString } from "../xmlSerialize";

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

export const runImport = async () => {
  await requireRoleOrThrow("data-admin");
  await importFromCurrentCommit();
};

export const runExport = async () => {
  await exportToCurrentCommit();
  return Response.redirect(
    `https://github.com/bullinger-digital/bullinger-korpus-tei/compare/${BRANCH_NAME}?expand=1`
  );
};

// Temporary functions to clean up data issues
import fs from "fs";
import { importFromCurrentCommit } from "../git/import";
import { BRANCH_NAME, exportToCurrentCommit } from "../git/export";

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
          .set("actions", prepareActionsForSave(newActions))
          .where("id", "=", id)
          .where("version_id", "=", version.version_id)
          .execute();
      }
    }

    // Validate all versions
    console.log("Validating all versions");
    const letterIds = await db
      .selectFrom("letter")
      .select("id")
      .orderBy("id asc")
      .execute();

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
          //   fs.writeFileSync("./temp-should.xml", version.xml);
          //   fs.writeFileSync("./temp-is.xml", newXml);
          throw new Error(
            `New XML does not equal old XML for letter ${id} version ${version.version_id}`
          );
        }

        previousXml = version.xml;
      }
    }
  });
};
