import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("letter_lock")
    .addColumn("id", "serial", (c) =>
      c.primaryKey().notNull().references("letter.id")
    )
    .addColumn("locked_by_id", "integer", (c) =>
      c.notNull().references("user.id")
    )
    .addColumn("locked_at", "timestamptz", (c) =>
      c.notNull().defaultTo(sql`now()`)
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
