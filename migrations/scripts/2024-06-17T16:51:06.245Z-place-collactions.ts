import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE place_version ALTER COLUMN settlement SET DATA TYPE TEXT COLLATE "de-CH-x-icu";
    ALTER TABLE place_version ALTER COLUMN district SET DATA TYPE TEXT COLLATE "de-CH-x-icu";
    ALTER TABLE place_version ALTER COLUMN country SET DATA TYPE TEXT COLLATE "de-CH-x-icu";
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
