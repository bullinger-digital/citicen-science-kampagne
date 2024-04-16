import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  db.schema
    .alterTable(`git_import`)
    .addColumn("hash_not_unique", "text")
    .execute();

  db.updateTable(`git_import`)
    .set({
      hash_not_unique: sql.id("hash"),
    })
    .execute();

  db.schema.alterTable(`git_import`).dropColumn(`hash`).execute();
  db.schema
    .alterTable(`git_import`)
    .renameColumn(`hash_not_unique`, `hash`)
    .execute();
  db.schema
    .alterTable(`git_import`)
    .alterColumn(`hash`, (c) => c.setNotNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
