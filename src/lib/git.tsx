import "server-only";
import { simpleGit } from "simple-git";
import fs, { opendirSync } from "fs";
import path from "path";
import { kdb } from "@/lib/db";
import { JSDOM } from "jsdom";

import {
  ImportSpecs,
  Versioning,
  versionedTables,
  whereCurrent,
} from "./versioning";
import { sql } from "kysely";

if (!globalThis.window) {
  // Hack to make JSDOM window available globally
  // used in xmlSerialize.ts
  (globalThis as any).jsDomWindow = new JSDOM().window;
}

export const repoPath = path.join(process.cwd(), "tei-corpus");
export const letterPath = path.join(repoPath, "./data/letters");
export const personsFilePath = path.join(repoPath, "./data/index/persons.xml");
export const placesFilePath = path.join(
  repoPath,
  "./data/index/localities.xml"
);

const fileOrDirectoryExists = async (path: string) => {
  return fs.promises
    .access(repoPath, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
};

export const initRepository = async () => {
  const exists = await fileOrDirectoryExists(repoPath);
  const gitExists = await fileOrDirectoryExists(path.join(repoPath, ".git"));
  if (!exists) {
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
    for (const t of versionedTables) {
      await sql`LOCK TABLE ${sql.ref(t)} IN EXCLUSIVE MODE;`.execute(db);
      await sql`LOCK TABLE ${sql.ref(
        t + "_version"
      )} IN EXCLUSIVE MODE;`.execute(db);
    }

    const v = new Versioning(db);
    const hasUncommitedTouches = await v.countUncommitedChanges();
    if (hasUncommitedTouches > 0) {
      throw new Error("Import failed - there are uncommited changes");
    }

    const logId = await v.createLogId("import");

    // Check if commit is already imported
    let git_import = await db
      .selectFrom("git_import")
      .where("hash", "=", commitHash)
      .selectAll()
      .executeTakeFirst();

    if (git_import) {
      console.log("Commit already imported, will update", commitHash);
    } else {
      // Create commit entry
      git_import = await db
        .insertInto("git_import")
        .values({
          hash: commitHash,
          created_log_id: logId,
        })
        .returningAll()
        .executeTakeFirst();
    }

    await v.removeNontouchedLatest();

    const gitImportSpecs: ImportSpecs = {
      gitImportId: git_import!.id,
      logId: logId,
    };

    // Import persons
    const xmlPersonsString = await fs.promises.readFile(
      personsFilePath,
      "utf-8"
    );
    const domParser = new new JSDOM().window.DOMParser();
    const xml = domParser.parseFromString(xmlPersonsString, "text/xml");
    const persons = Array.from(xml.querySelectorAll("person"));

    for (const person of persons) {
      const id = parseInt(
        person.getAttribute("xml:id")?.replace("P", "") || ""
      );
      console.log("Importing person", id);
      await v.importVersioned(
        "person",
        id,
        {
          gnd: person.querySelector("idno[subtype='gnd']")?.textContent || "",
          hist_hub:
            person.querySelector("idno[subtype='histHub']")?.textContent || "",
          portrait:
            person.querySelector("idno[subtype='portrait']")?.textContent || "",
          wiki: person.querySelector("idno[subtype='wiki']")?.textContent || "",
        },
        gitImportSpecs
      );

      // Import aliases for person
      const aliases = Array.from(person.querySelectorAll("persName"));
      for (const alias of aliases) {
        const aliasId = parseInt(
          alias.getAttribute("xml:id")?.replace("p", "") || ""
        );
        console.log("Importing alias", aliasId);
        await v.importVersioned(
          "person_alias",
          aliasId,
          {
            forename: alias.querySelector("forename")?.textContent || "",
            surname: alias.querySelector("surname")?.textContent || "",
            type: alias.getAttribute("type") || "",
            person_id: id,
          },
          gitImportSpecs
        );
      }
    }

    // Import places
    const xmlPlacesString = await fs.promises.readFile(placesFilePath, "utf-8");
    const xmlPlaces = domParser.parseFromString(xmlPlacesString, "text/xml");
    const places = Array.from(xmlPlaces.querySelectorAll("place"));
    for (const place of places) {
      const id = parseInt(place.getAttribute("xml:id")?.replace("l", "") || "");
      console.log("Importing place", id);
      await v.importVersioned(
        "place",
        id,
        {
          settlement: place.querySelector("settlement")?.textContent || "",
          district: place.querySelector("district")?.textContent || "",
          country: place.querySelector("country")?.textContent || "",
          latitude: parseFloat(
            place.querySelector("geo")?.textContent?.split(" ")[0] || ""
          ),
          longitude: parseFloat(
            place.querySelector("geo")?.textContent?.split(" ")[1] || ""
          ),
        },
        gitImportSpecs
      );
    }

    await iterateFiles(async (name, fileContents) => {
      console.log(name);
      const letterId = parseInt(name.replace(".xml", ""));

      await v.importVersioned(
        "letter",
        letterId,
        {
          xml: fileContents,
        },
        gitImportSpecs
      );
    });

    return true;
  });

  const performanceEnd = performance.now();
  console.log(
    `Imported ${commitHash} in ${(performanceEnd - performanceStart) / 1000}s`
  );
};

export const exportToCurrentCommit = async () => {
  const git = simpleGit(repoPath);

  await kdb.transaction().execute(async (db) => {
    const currentImportHash = (
      await db
        .selectFrom("git_import")
        .where("is_current", "is", true)
        .selectAll()
        .executeTakeFirst()
    )?.hash;

    if (!currentImportHash) {
      throw new Error("Export failed - no current import available");
    }

    await git.checkout(currentImportHash);
    const commitHash = await getCommitHash();

    if (commitHash !== currentImportHash) {
      // Todo: we could manually checkout the commit and then export
      throw new Error(
        "Export failed - current checked out commit does not match the latest import"
      );
    }
    // Todo: Check for uncommited changes in git repo
    const s = await git.status();
    if (!s.isClean)
      throw new Error(
        "Export failed - there are uncommited changes in the repository"
      );

    // Todo: export persons, person_aliases, places

    // Select all latest letters and export them
    const letters = await db
      .selectFrom("letter_version")
      .where(whereCurrent)
      .where("is_touched", "is", true)
      .where("review_state", "=", "accepted")
      .select(["id", "xml"])
      .execute();

    for (const letter of letters) {
      const xml = letter.xml;
      const id = letter.id;
      await fs.promises.writeFile(path.join(letterPath, `${id}.xml`), xml);
    }

    // Todo: Update git_export table and set entries to be exported

    // Commit and push
    // Todo: add git_export id to branch name / suffix?
    await git.deleteLocalBranch("citizen-science-experiments", true);
    await git.checkoutBranch("citizen-science-experiments", commitHash);
    await git.add(".");
    await git.commit(
      `Citizen Science export ${new Date().toISOString()} (based on ${commitHash.substring(
        0,
        7
      )})`
    );
    await git.push("origin", "citizen-science-experiments", ["-f"]);
    await git.checkout(commitHash);
  });
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
