import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  db.schema
    .alterTable(`place_version`)
    .alterColumn("latitude", (a) => a.dropNotNull())
    .alterColumn("longitude", (a) => a.dropNotNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
