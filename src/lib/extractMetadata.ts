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
  for (const { table, tag, linkType, refPrefix } of extractLinksSpecs) {
    const entities = Array.from(xmlDom.querySelectorAll(`${tag}[ref]`));

    const inserts = entities.map((entity) => {
      const ref = entity.getAttribute("ref");
      const cert = entity.getAttribute("cert") || "low";
      const textContent = entity.textContent || "";
      const entityId = parseInt(ref!.toLowerCase().replace(refPrefix, ""));
      return {
        version_id: versionId,
        link_to: entityId,
        link_type: linkType,
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
  tag: string;
  linkType: "correspondent" | "mentioned" | "origin";
  refPrefix: string;
}[] = [
  {
    table: "person",
    tag: "persName",
    linkType: "mentioned",
    refPrefix: "p",
  },
  {
    table: "place",
    tag: "placeName",
    linkType: "mentioned",
    refPrefix: "l",
  },
];
