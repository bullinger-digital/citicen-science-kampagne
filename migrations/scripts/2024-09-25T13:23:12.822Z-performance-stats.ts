import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
  -- Add computed columns to speed up stats page
  ALTER TABLE letter_version
    ADD COLUMN IF NOT EXISTS stats_actions_count integer GENERATED ALWAYS AS (
      jsonb_array_length(actions)
    ) STORED;
  ALTER TABLE letter_version
    ADD COLUMN IF NOT EXISTS stats_finished_letter boolean GENERATED ALWAYS AS (
      actions @> '[{ "nodePath": [{ "nodeName": "revisionDesc" }], "attributes": { "status": "finished" } }]'
    ) STORED;
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
