import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("letter_version_extract_person")
    .dropConstraint("link_type_is_valid")
    .execute();
  await db.schema
    .alterTable("letter_version_extract_person")
    .addCheckConstraint(
      "link_type_is_valid",
      sql`link_type = 'correspondent' OR link_type = 'mentioned' OR link_type = 'other'`
    )
    .execute();

  await db.schema
    .alterTable("letter_version_extract_place")
    .dropConstraint("link_type_is_valid")
    .execute();
  await db.schema
    .alterTable("letter_version_extract_place")
    .addCheckConstraint(
      "link_type_is_valid",
      sql`link_type = 'origin' OR link_type = 'mentioned' OR link_type = 'other'`
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
