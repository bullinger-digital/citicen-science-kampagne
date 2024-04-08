import { Kysely, sql } from "kysely";

const versioned_tables = ["letter", "person", "person_alias", "place"];

export async function up(db: Kysely<any>): Promise<void> {
  await Promise.all(
    versioned_tables.map((table) =>
      db.schema
        .alterTable(`${table}_version`)
        .alterColumn("git_import_id", (a) => a.setNotNull())
        .execute()
    )
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
