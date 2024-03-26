import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    // Tables with _extract_ denote data extracted from the XML
    .createTable("letter_version_extract_person")
    .addColumn("version_id", "integer", (c) =>
      c.notNull().references("letter_version.version_id").onDelete("cascade")
    )
    .addColumn("person_id", "integer", (c) =>
      c.notNull().references("person.id")
    )
    .addColumn("cert", "text", (c) => c.notNull())
    .addColumn("node_text", "text", (c) => c.notNull())
    .addColumn("link_type", "text", (c) => c.notNull())
    .addCheckConstraint(
      "link_type_is_valid",
      sql`link_type = 'correspondent' OR link_type = 'mentioned'`
    )
    .execute();

  await db.schema
    .createTable("letter_version_extract_place")
    .addColumn("version_id", "integer", (c) =>
      c.notNull().references("letter_version.version_id").onDelete("cascade")
    )
    .addColumn("place_id", "integer", (c) => c.notNull().references("place.id"))
    .addColumn("cert", "text", (c) => c.notNull())
    .addColumn("node_text", "text", (c) => c.notNull())
    .addColumn("link_type", "text", (c) => c.notNull())
    .addCheckConstraint(
      "link_type_is_valid",
      sql`link_type = 'origin' OR link_type = 'mentioned'`
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
