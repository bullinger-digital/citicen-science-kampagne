import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("place_version")
    .addColumn("geonames", "text", (c) => c.notNull().defaultTo(""))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
