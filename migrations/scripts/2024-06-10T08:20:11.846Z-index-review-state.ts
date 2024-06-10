import { Kysely } from "kysely";

const versioned_tables = ["letter", "person", "person_alias", "place"];

export async function up(db: Kysely<any>): Promise<void> {
  // Add index on review_state column to all versioned tables
  for (const table of versioned_tables) {
    await db.schema
      .createIndex(`${table}_review_state`)
      .on(`${table}_version`)
      .columns(["review_state"])
      .execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
