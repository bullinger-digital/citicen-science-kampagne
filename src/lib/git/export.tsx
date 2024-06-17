import "server-only";
import { simpleGit } from "simple-git";
import * as prettier from "prettier";
import { ExpressionBuilder, Kysely, Transaction } from "kysely";
import path from "path";
import { DB, kdb } from "../db";
import { VersionedTable, Versioning, whereCurrent } from "../versioning";
import { xmlParseFromString, xmlSerializeToString } from "../xmlSerialize";
import {
  personsFilePath,
  placesFilePath,
  repoPath,
  letterPath,
} from "./common";
import { getCommitHash } from "./import";
import fs from "fs";

export const BRANCH_NAME = "citizen-science-" + process.env.NODE_ENV;

const domExportHelpers = (personsDom: Document) => {
  const findOrCreateNode = (
    parent: Element,
    elementName: string,
    selector: string,
    callback: (node: Element) => void
  ) => {
    let node = parent.querySelector(selector);
    if (!node) {
      node = personsDom.createElementNS(
        "http://www.tei-c.org/ns/1.0",
        elementName
      );
      parent.appendChild(node as Node);
    }
    callback(node);
    return node;
  };

  const removeNode = (parent: Element, selector: string) => {
    let node = parent.querySelector(selector);
    if (node) {
      node.remove();
    }
  };

  const textContentNode = (
    parent: Element,
    selector: string,
    element: string,
    textContent: string | undefined | null,
    callback?: (node: Element) => void
  ) => {
    if (textContent) {
      findOrCreateNode(parent, element, selector, (node) => {
        node.textContent = textContent;
        if (callback) {
          callback(node);
        }
      });
    } else {
      removeNode(parent, selector);
    }
  };

  return { findOrCreateNode, removeNode, textContentNode };
};

export const whereExportFilter = <TA extends keyof DB>(
  eb: ExpressionBuilder<DB, TA & VersionedTable>
) =>
  eb.and([
    eb("is_latest", "is", true as any),
    eb("git_import_id", "=", (e: any) =>
      e.selectFrom("git_import").select("id").where("is_current", "is", true)
    ),
    // Todo: fix typing
    eb("is_touched", "is", true as any),
    eb("review_state", "=", "accepted" as any),
  ]);

const isNumber = (value: any) => {
  return typeof value === "number";
};

const exportPersons = async (db: Kysely<DB>, gitExportId: number) => {
  // Export persons
  const persons = await db
    .selectFrom("person_version")
    .where(whereExportFilter)
    .select([
      "id",
      "gnd",
      "hist_hub",
      "portrait",
      "wiki",
      "aliases",
      "forename",
      "surname",
    ])
    .execute();

  const personsString = await fs.promises.readFile(personsFilePath, "utf-8");
  const personsDom = xmlParseFromString(personsString);
  const personsRoot = personsDom.querySelector("TEI > standOff > listPerson");

  if (!personsRoot) {
    throw new Error("Could not find root element in persons.xml");
  }

  const h = domExportHelpers(personsDom);

  for (const person of persons) {
    h.findOrCreateNode(
      personsRoot,
      "person",
      `person[xml:id=P${person.id}]`,
      (personNode) => {
        personNode.setAttribute("xml:id", `P${person.id}`);

        // We replace all aliases, so remove existing ones
        personNode
          .querySelectorAll("persName:not([type='main'])")
          .forEach((node) => {
            node.remove();
          });

        // Add main alias
        const mainAliasNode = h.findOrCreateNode(
          personNode,
          "persName",
          "persName[type='main']",
          (mainAliasNode) => {
            h.findOrCreateNode(mainAliasNode, "surname", "surname", (n) => {
              n.textContent = person.surname;
            });
            h.findOrCreateNode(mainAliasNode, "forename", "forename", (n) => {
              n.textContent = person.forename;
            });
            mainAliasNode.setAttribute("ref", `p${person.id}`);
            mainAliasNode.setAttribute("type", "main");
          }
        );

        // Aliases
        const aliasNodes = person.aliases
          .sort((a, b) => {
            if (isNumber(a.id) && !isNumber(b.id)) return -1;
            if (!isNumber(a.id) && isNumber(b.id)) return 1;

            // If both have id, or neither have id, sort by id if present
            if (isNumber(a.id) && isNumber(b.id)) {
              if (a.id !== b.id) return (a.id as number) - (b.id as number);
            }

            if (a.surname !== b.surname)
              return a.surname.localeCompare(b.surname);

            return a.forename.localeCompare(b.forename);
          })
          .map((alias) => {
            const aliasNode = personsDom.createElementNS(
              "http://www.tei-c.org/ns/1.0",
              "persName"
            );
            if (alias.id) {
              // only existing aliases have an id
              aliasNode.setAttribute("xml:id", `p${alias.id}`);
            }
            aliasNode.setAttribute("ref", `p${person.id}`);
            aliasNode.setAttribute("type", alias.type);
            h.findOrCreateNode(aliasNode, "surname", "surname", (node) => {
              node.textContent = alias.surname;
            });
            h.findOrCreateNode(aliasNode, "forename", "forename", (node) => {
              node.textContent = alias.forename;
            });
            return aliasNode;
          });

        mainAliasNode.after(...(aliasNodes as Node[]));

        h.textContentNode(
          personNode,
          `idno[subtype='gnd']`,
          "idno",
          person.gnd,
          (node) => {
            node.setAttribute("subtype", "gnd");
          }
        );
        h.textContentNode(
          personNode,
          `idno[subtype='histHub']`,
          "idno",
          person.hist_hub,
          (node) => {
            node.setAttribute("subtype", "histHub");
          }
        );
        h.textContentNode(
          personNode,
          `idno[subtype='portrait']`,
          "idno",
          person.portrait,
          (node) => {
            node.setAttribute("subtype", "portrait");
          }
        );
        h.textContentNode(
          personNode,
          `idno[subtype='wiki']`,
          "idno",
          person.wiki,
          (node) => {
            node.setAttribute("subtype", "wiki");
          }
        );
      }
    );
  }

  await fs.promises.writeFile(
    personsFilePath,
    await formatXml(xmlSerializeToString(personsDom))
  );

  // Set entries to commited
  await setToCommited(
    db,
    "person_version",
    persons.map((p) => p.id),
    gitExportId
  );
};

const exportPlaces = async (db: Kysely<DB>, gitExportId: number) => {
  // Export places
  const places = await db
    .selectFrom("place_version")
    .where(whereExportFilter)
    .select([
      "id",
      "settlement",
      "district",
      "country",
      "latitude",
      "longitude",
      "geonames",
    ])
    .execute();

  const placesString = await fs.promises.readFile(placesFilePath, "utf-8");
  const placesDom = xmlParseFromString(placesString);
  const placesRoot = placesDom.querySelector("TEI > standOff > listPlace");

  if (!placesRoot) {
    throw new Error("Could not find root element in localities.xml");
  }

  const h = domExportHelpers(placesDom);

  for (const place of places) {
    h.findOrCreateNode(
      placesRoot,
      "place",
      `place[xml:id=l${place.id}]`,
      (placeNode) => {
        placeNode.setAttribute("xml:id", `l${place.id}`);
        h.textContentNode(
          placeNode,
          "settlement",
          "settlement",
          place.settlement
        );
        h.textContentNode(placeNode, "district", "district", place.district);
        h.textContentNode(placeNode, "country", "country", place.country);
        const geo =
          place.latitude && place.longitude
            ? `${place.latitude} ${place.longitude}`
            : null;
        if (geo) {
          h.findOrCreateNode(placeNode, "location", "location", (node) => {
            h.textContentNode(node, "geo", "geo", geo);
          });
        }
        h.textContentNode(
          placeNode,
          "idno[subtype='geonames']",
          "idno",
          place.geonames,
          (node) => {
            node.setAttribute("subtype", "geonames");
          }
        );
      }
    );
  }

  await fs.promises.writeFile(
    placesFilePath,
    await formatXml(xmlSerializeToString(placesDom))
  );

  // Set entries to commited
  await setToCommited(
    db,
    "place_version",
    places.map((p) => p.id),
    gitExportId
  );
};

const formatXml = (xml: string) => {
  return prettier.format(xml, {
    parser: "xml",
    plugins: ["@prettier/plugin-xml"],
    xmlWhitespaceSensitivity: "preserve",
    useTabs: true,
    printWidth: 200,
  });
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

    const s = await git.status();
    if (!s.isClean || s.files.length > 0)
      throw new Error(
        "Export failed - there are uncommited changes in the repository"
      );

    const gitExportId = await createGitExportId(db, currentImportHash);

    await exportPersons(db, gitExportId);
    await exportPlaces(db, gitExportId);

    // Select all latest letters and export them
    const letters = await db
      .selectFrom("letter_version")
      .where(whereExportFilter)
      .where((e) =>
        e.and([
          e.not(
            e.exists(
              e
                .selectFrom("person_version")
                .where(whereCurrent)
                .where("person_version.review_state", "<>", "accepted")
                .leftJoin(
                  "letter_version_extract_person",
                  "letter_version_extract_person.person_id",
                  "person_version.id"
                )
                .where(
                  "letter_version_extract_person.version_id",
                  "=",
                  e.ref("letter_version.version_id")
                )
            )
          ),
          e.not(
            e.exists(
              e
                .selectFrom("place_version")
                .where(whereCurrent)
                .where("place_version.review_state", "<>", "accepted")
                .leftJoin(
                  "letter_version_extract_place",
                  "letter_version_extract_place.place_id",
                  "place_version.id"
                )
                .where(
                  "letter_version_extract_place.version_id",
                  "=",
                  e.ref("letter_version.version_id")
                )
            )
          ),
        ])
      )
      .select(["id", "xml"])
      .execute();

    for (const letter of letters) {
      const xml = letter.xml;
      const id = letter.id;
      await fs.promises.writeFile(path.join(letterPath, `${id}.xml`), xml);
    }

    // Set entries to commited
    await setToCommited(
      db,
      "letter_version",
      letters.map((l) => l.id),
      gitExportId
    );

    // Commit and push
    // Todo: add git_export id to branch name / suffix?
    const branches = await git.branchLocal();
    if (branches.all.includes(BRANCH_NAME)) {
      await git.deleteLocalBranch(BRANCH_NAME, true);
    }
    await git.checkoutBranch(BRANCH_NAME, commitHash);
    await git.add(".");
    await git.commit(
      `Citizen Science export ${new Date().toISOString()} (based on ${commitHash.substring(
        0,
        7
      )})`
    );
    await git.push("origin", BRANCH_NAME, ["-f"]);
    await git.checkout(commitHash);
  });
};

const setToCommited = async (
  db: Kysely<DB>,
  table: VersionedTable,
  ids: number[],
  gitExportId: number
) => {
  if (ids.length === 0) return;

  await db
    .updateTable(`${table}`)
    .set({
      git_export_id: gitExportId,
    })
    .where("id", "in", ids)
    .execute();
};

const createGitExportId = async (
  db: Transaction<DB>,
  currentImportHash: string
) => {
  const v = new Versioning(db);
  const logId = await v.createLogId("export");

  return (
    await db
      .insertInto("git_export")
      .values({
        base_commit_hash: currentImportHash,
        created_log_id: logId,
        written_at: new Date(),
      })
      .returning(["id"])
      .executeTakeFirstOrThrow()
  ).id;
};
