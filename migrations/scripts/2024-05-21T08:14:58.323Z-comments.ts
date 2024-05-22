import { CreateTableBuilder, Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("comment")
    .addColumn("id", "serial", (c) => c.primaryKey().notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("target", "text", (c) => c.notNull())
    .addColumn("created_log_id", "integer", (c) =>
      c.notNull().references("log.id")
    )
    .addColumn("updated_log_id", "integer", (c) => c.references("log.id"))
    .addColumn("resolved_log_id", "integer", (c) => c.references("log.id"))
    .addColumn("deleted_log_id", "integer", (c) => c.references("log.id"))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
