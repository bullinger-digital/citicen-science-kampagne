import "server-only";
import { type Kysely } from "kysely";
import { Versioned } from "./versioning";
import { DB } from "./db";
import { dateAsString } from "./metadataCommon";

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
  let state = xmlDom
    .querySelector("TEI > teiHeader > revisionDesc")
    ?.getAttribute("status");
  // Set state (extract_status) to "touched" if letter contains any citizen_name elements
  if (
    state !== "finished" &&
    Array.from(
      xmlDom.querySelectorAll(
        "persName[type=citizen_name], placeName[type=citizen_name]"
      )
    ).length > 0
  ) {
    state = "touched";
  }
  const dateNode = xmlDom.querySelector(
    "TEI > teiHeader > profileDesc > correspDesc > correspAction[type='sent'] > date"
  );
  const date =
    dateNode?.getAttribute("when") ||
    dateNode?.getAttribute("notBefore") ||
    dateNode?.getAttribute("notAfter") ||
    null;
  const namesWithoutRefCount = xmlDom.querySelectorAll(
    "persName:not([ref]), persName[ref=''], placeName:not([ref]), placeName[ref='']"
  ).length;

  const dateString = !dateNode ? null : dateAsString(dateNode);

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
      extract_date_string: dateString || null,
      extract_names_without_ref_count: namesWithoutRefCount,
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

    inserts
      .filter((insert) => isNaN(insert.link_to))
      .forEach((insert) => {
        console.error(
          `Warning: Letter id ${letterId} - wrong ${table} reference ${insert.link_to}`
        );
      });

    // Todo: insert all at once
    for (const insert of inserts) {
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
    selector: "placeName[ref], placeName[source]",
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
