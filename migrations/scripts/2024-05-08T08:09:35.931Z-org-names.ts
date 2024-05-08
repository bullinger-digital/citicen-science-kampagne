import { CreateTableBuilder, Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("org_names")
    .addColumn("id_int", "serial", (c) => c.primaryKey().notNull())
    .addColumn("id", "text", (c) => c.notNull())
    .addColumn("git_import_id", "integer", (c) => c.references("git_import.id"))
    .addColumn("created_log_id", "integer", (c) =>
      c.notNull().references("log.id")
    )
    .addColumn("xml", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createIndex("org_names_id_git_import_unique")
    .on("org_names")
    .columns(["id", "git_import_id"])
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
