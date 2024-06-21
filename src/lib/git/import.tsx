import "server-only";
import { simpleGit } from "simple-git";
import fs, { opendirSync } from "fs";
import path from "path";
import { kdb } from "@/lib/db";

import { ImportSpecs, Versioning, versionedTables } from "../versioning";
import { sql } from "kysely";
import { xmlParseFromString } from "../xmlSerialize";
import {
  repoPath,
  personsFilePath,
  placesFilePath,
  letterPath,
  orgNamesFilePath,
} from "./common";

const fileOrDirectoryExists = async (path: string) => {
  return fs.promises
    .access(path, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
};

export const initRepository = async () => {
  const exists = await fileOrDirectoryExists(repoPath);
  const gitExists = await fileOrDirectoryExists(path.join(repoPath, ".git"));
  if (!exists) {
    console.log("Creating directory ", repoPath);
    await fs.promises.mkdir(repoPath);
  }
  if (!gitExists) {
    console.log("Cloning to ", repoPath);
    const git = simpleGit();
    await git.clone(
      "https://github.com/bullinger-digital/bullinger-korpus-tei",
      repoPath
    );
  }
};

export const pullRepository = async () => {
  const git = simpleGit(repoPath);

  const s = await git.status();
  if (!s.isClean || s.files.length > 0)
    throw new Error(
      "Pull failed - there are uncommited changes in the repository"
    );

  await git.checkout("main");
  await git.pull();
};

export const getCommitHash = async () => {
  const git = simpleGit(repoPath);
  const log = await git.log();
  if (!log.latest) throw new Error("Could not get latest commit");
  return log.latest.hash;
};

export const importFromCurrentCommit = async () => {
  const performanceStart = performance.now();
  const commitHash = await getCommitHash();

  await kdb.transaction().execute(async (db) => {
    await sql`SET LOCAL lock_timeout = '1s';`.execute(db);
    for (const t of versionedTables) {
      await sql`LOCK TABLE ${sql.ref(t)} IN EXCLUSIVE MODE;`.execute(db);
      await sql`LOCK TABLE ${sql.ref(
        t + "_version"
      )} IN EXCLUSIVE MODE;`.execute(db);
    }

    await initRepository();
    await pullRepository();

    const v = new Versioning(db);
    const hasUncommitedTouches = await v.countUncommitedChanges();
    if (hasUncommitedTouches > 0) {
      throw new Error("Import failed - there are uncommited changes");
    }

    const logId = await v.createLogId("import");

    // Check if commit is already imported
    let existing_git_import = await db
      .selectFrom("git_import")
      .where("hash", "=", commitHash)
      .selectAll()
      .executeTakeFirst();

    if (existing_git_import) {
      //console.log("Commit already imported, will re-import", commitHash);
      throw new Error("Commit already imported");
    }

    // Set all existing git_imports to not current
    await db
      .updateTable("git_import")
      .set({ is_current: false })
      .where("is_current", "=", true)
      .execute();

    // Create commit entry
    const git_import = await db
      .insertInto("git_import")
      .values({
        hash: commitHash,
        created_log_id: logId,
        is_current: true,
      })
      .returningAll()
      .executeTakeFirst();

    // Disabled for now because we could loose data
    // as this is a space optimization we can do it later if required
    // await v.removeNontouchedLatest();

    const gitImportSpecs: ImportSpecs = {
      gitImportId: git_import!.id,
      logId: logId,
    };

    // Import persons
    const xmlPersonsString = await fs.promises.readFile(
      personsFilePath,
      "utf-8"
    );
    const xml = xmlParseFromString(xmlPersonsString);
    const persons = Array.from(xml.querySelectorAll("person"));

    for (const person of persons) {
      const id = parseInt(
        person.getAttribute("xml:id")?.replace("P", "") || ""
      );
      console.log("Importing person", id);

      const mainAliasNode = person.querySelector("persName[type='main']");
      const otherAliasNodes = Array.from(
        person.querySelectorAll("persName:not([type='main'])")
      );
      await v.importVersioned(
        "person",
        id,
        {
          forename: mainAliasNode?.querySelector("forename")?.textContent || "",
          surname: mainAliasNode?.querySelector("surname")?.textContent || "",
          aliases: JSON.stringify(
            otherAliasNodes.map((alias) => {
              const id = alias.getAttribute("xml:id");
              return {
                id: id ? parseInt(id.replace("p", "")) : null,
                forename: alias.querySelector("forename")?.textContent || "",
                surname: alias.querySelector("surname")?.textContent || "",
                type: alias.getAttribute("type") || "",
              };
            })
            // // Todo: Fix typing
          ) as any,
          gnd: person.querySelector("idno[subtype='gnd']")?.textContent || "",
          hist_hub:
            person.querySelector("idno[subtype='histHub']")?.textContent || "",
          portrait:
            person.querySelector("idno[subtype='portrait']")?.textContent || "",
          wiki: person.querySelector("idno[subtype='wiki']")?.textContent || "",
          review_state: person.getAttribute("change") || "accepted",
        },
        gitImportSpecs
      );
    }

    // Import places
    const xmlPlacesString = await fs.promises.readFile(placesFilePath, "utf-8");
    const xmlPlaces = xmlParseFromString(xmlPlacesString);
    const places = Array.from(xmlPlaces.querySelectorAll("place"));
    for (const place of places) {
      const id = parseInt(place.getAttribute("xml:id")?.replace("l", "") || "");
      const coordinates = place.querySelector("geo")?.textContent?.split(" ");
      const latitudeString = coordinates?.[0] || "";
      const longitudeString = coordinates?.[1] || "";
      console.log("Importing place", id);
      await v.importVersioned(
        "place",
        id,
        {
          settlement: place.querySelector("settlement")?.textContent || "",
          district: place.querySelector("district")?.textContent || "",
          country: place.querySelector("country")?.textContent || "",
          latitude: latitudeString ? parseFloat(latitudeString) : null,
          longitude: longitudeString ? parseFloat(longitudeString) : null,
          geonames:
            place.querySelector("idno[subtype='geonames']")?.textContent || "",
          review_state: place.getAttribute("change") || "accepted",
        },
        gitImportSpecs
      );
    }

    // Import orgNames
    const xmlOrgsString = await fs.promises.readFile(orgNamesFilePath, "utf-8");
    const xmlOrgs = xmlParseFromString(xmlOrgsString);
    const orgs = Array.from(xmlOrgs.querySelectorAll("orgName"));
    for (const org of orgs) {
      const id = org.getAttribute("xml:id");
      if (!id) {
        console.error("Error: No id for orgName", org.outerHTML);
        continue;
      }
      console.log("Importing orgName", id);
      await v.db
        .insertInto("org_names")
        .values({
          id: id,
          git_import_id: git_import!.id,
          created_log_id: logId,
          xml: org.outerHTML,
        })
        .execute();
    }

    await iterateFiles(async (name, fileContents) => {
      console.log(name);
      const letterId = parseInt(name.replace(".xml", ""));

      await v.importVersioned(
        "letter",
        letterId,
        {
          xml: fileContents,
          review_state: "accepted",
        },
        gitImportSpecs
      );
    });

    await v.updateComputedLinkCounts({});
    await v.resetPostgresIdSequences();
    return true;
  });

  const performanceEnd = performance.now();
  console.log(
    `Imported ${commitHash} in ${(performanceEnd - performanceStart) / 1000}s`
  );
};

export const iterateFiles = async (
  fileCallback: (name: string, fileContents: string) => Promise<void>
) => {
  const dir = opendirSync(letterPath);
  for await (const dirent of dir) {
    if (dirent.isFile() && dirent.name.endsWith(".xml")) {
      const fileContents = await fs.promises.readFile(
        path.join(letterPath, dirent.name),
        "utf-8"
      );
      await fileCallback(dirent.name, fileContents);
    }
  }
};
