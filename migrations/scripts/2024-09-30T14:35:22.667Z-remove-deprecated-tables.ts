import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
  DROP TABLE removed_person_alias_version;
  DROP TABLE removed_person_alias;
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
