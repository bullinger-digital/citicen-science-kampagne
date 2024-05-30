import { CreateTableBuilder, Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("person_cache_gnd")
    .addColumn("url", "text", (c) => c.primaryKey().notNull())
    .addColumn("ok", "boolean", (c) => c.notNull())
    .addColumn("status", "integer", (c) => c.notNull())
    .addColumn("statusText", "text", (c) => c.notNull())
    .addColumn("result", "json", (c) => c.notNull())
    .addColumn("timestamp", "timestamptz", (c) =>
      c.defaultTo(sql`now()`).notNull()
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
