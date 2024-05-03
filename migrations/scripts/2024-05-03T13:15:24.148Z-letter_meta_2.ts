import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    // Columns starting with extract_ denote computed data extracted from the XML
    .alterTable("letter_version")
    .addColumn("extract_source", "text")
    .addColumn("extract_type", "text")
    .addColumn("extract_language", "text")
    .addColumn("extract_status", "text")
    .addColumn("extract_date", "text")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
