import { Kysely, sql } from "kysely";

const versioned_tables = ["letter", "person", "place"];

export async function up(db: Kysely<any>): Promise<void> {
  for (const table of versioned_tables) {
    await db.schema
      .alterTable(`${table}_version`)
      .addColumn("deleted_log_id", "integer", (c) => c.references("log.id"))
      .execute();

    // Change rejected entries: set deleted_log_id where entries have been created by citizens but rejected by an admin
    // because that's what the "reject" action will do in the future for entries which do not have a previous version
    await sql`UPDATE ${sql.raw(table)}_version v
      SET deleted_log_id = reviewed_log_id
      WHERE
        review_state = 'rejected' AND is_latest = true
        AND NOT EXISTS (
          SELECT * FROM ${sql.raw(table)}_version i WHERE i.id = v.id AND i.version_id < v.version_id AND i.review_state = 'accepted'
        );`.execute(db);

    // Add validation: rejected entries where deleted_log_id is null should NOT be latest
    await db.schema
      .alterTable(`${table}_version`)
      .addCheckConstraint(
        `${table}_rejected_nondeleted_not_latest`,
        sql`review_state <> 'rejected' OR deleted_log_id IS NOT NULL OR NOT is_latest`
      )
      .execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
