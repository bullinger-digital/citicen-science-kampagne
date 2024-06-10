import "server-only";
import { type Kysely } from "kysely";
import { Versioned } from "./versioning";
import { DB } from "./generated/kysely-codegen";

export const extractAndStoreMetadata = async ({
  db,
  xmlDom,
  versionId,
  letterId,
}: {
  db: Kysely<DB>;
  xmlDom: Document;
  versionId: number;
  letterId: number;
}) => {
  // Extract metadata for letter version
  const source = xmlDom.querySelector("TEI")?.getAttribute("source");
  const type = xmlDom.querySelector("TEI")?.getAttribute("type");
  const language = xmlDom.querySelector("TEI > text")?.getAttribute("xml:lang");
  const state = xmlDom
    .querySelector("TEI > teiHeader > revisionDesc")
    ?.getAttribute("status");
  const dateNode = xmlDom.querySelector(
    "TEI > teiHeader > profileDesc > correspDesc > correspAction[type='sent'] > date"
  );
  const date =
    dateNode?.getAttribute("when") ||
    dateNode?.getAttribute("notBefore") ||
    dateNode?.getAttribute("notAfter") ||
    null;
  await db
    .updateTable("letter_version")
    .where("version_id", "=", versionId)
    .where("id", "=", letterId)
    .set({
      extract_source: source || null,
      extract_type: type || null,
      extract_language: language || null,
      extract_status: state || null,
      extract_date: date || null,
    })
    .execute();

  // Extract related persons and places
  for (const { table, selector, linkType, refPrefix } of extractLinksSpecs) {
    const entities = Array.from(xmlDom.querySelectorAll(selector));

    // Remove existing extracts for this version (only required when gegenerating metadata for existing letter versions)
    await db
      .deleteFrom(`letter_version_extract_${table}`)
      .where("version_id", "=", versionId)
      .execute();

    const inserts = entities.map((entity) => {
      const ref = entity.getAttribute("ref");
      const cert = entity.getAttribute("cert") || "low";
      const textContent = entity.textContent || "";
      const entityId = parseInt(ref!.toLowerCase().replace(refPrefix, ""));
      return {
        version_id: versionId,
        link_to: entityId,
        link_type: linkType(xmlDom, entity as Node),
        cert,
        node_text: textContent,
      };
    });

    for (const insert of inserts) {
      if (isNaN(insert.link_to)) {
        console.error(
          `Warning: Letter id ${letterId} - wrong ${table} reference ${insert.link_to}`
        );
        continue;
      }

      const p = await db
        .selectFrom(table)
        .where("id", "=", insert.link_to)
        .selectAll()
        .executeTakeFirst();

      if (p) {
        await db
          .insertInto(`letter_version_extract_${table}`)
          .values({
            version_id: insert.version_id,
            [`${table}_id`]: insert.link_to,
            link_type: insert.link_type,
            cert: insert.cert,
            node_text: insert.node_text,
          })
          .execute();
      } else {
        console.error(
          `Warning: Letter id ${letterId} - wrong ${table} reference ${insert.link_to}`
        );
      }
    }
  }
};

const extractLinksSpecs: {
  table: Extract<Versioned, "person" | "place">;
  selector: string;
  linkType: (
    root: Document,
    node: Node
  ) => "correspondent" | "mentioned" | "origin" | "other";
  refPrefix: string;
}[] = [
  // ToDo: Import ALL instances of perName and placeName
  // and determine the type of link based on the context
  {
    table: "person",
    selector: "persName[ref]",
    linkType: (root, node) => {
      if (root.querySelector("TEI > teiHeader correspDesc")?.contains(node))
        return "correspondent";
      if (root.querySelector("TEI > text")?.contains(node)) return "mentioned";
      if (root.querySelector("TEI > teiHeader summary")?.contains(node))
        return "mentioned";
      return "other";
    },
    refPrefix: "p",
  },
  {
    table: "place",
    selector: "placeName[ref]",
    linkType: (root, node) => {
      if (
        root
          .querySelector("TEI > teiHeader correspAction[type='sent']")
          ?.contains(node)
      )
        return "origin";
      if (root.querySelector("TEI > text")?.contains(node)) return "mentioned";
      if (root.querySelector("TEI > teiHeader summary")?.contains(node))
        return "mentioned";
      return "other";
    },
    refPrefix: "l",
  },
];
