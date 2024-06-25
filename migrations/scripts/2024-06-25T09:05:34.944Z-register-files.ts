import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("register_file")
    .addColumn("name", "text", (e) => e.notNull())
    .addColumn("xml", sql`xml`, (e) => e.notNull())
    .addColumn("git_import_id", "integer", (e) => e.references("git_import.id"))
    .addColumn("created_log_id", "integer", (e) => e.references("log.id"))
    .addPrimaryKeyConstraint("pk_register_file", ["name", "git_import_id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
