import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("letter_version")
    .addColumn("extract_date_string", "text")
    .execute();

  await sql`
  -- Convert xml column to actual xml type
  ALTER TABLE letter_version
  ALTER COLUMN xml TYPE xml USING xml::xml;

  -- Add some missing indexes
  CREATE INDEX letter_version_version_id ON letter_version (version_id);
  CREATE INDEX letter_version_is_latest_git_import_id ON letter_version (is_latest, git_import_id);
  CREATE INDEX letter_version_extract_person_letter_id ON letter_version_extract_person (version_id);
  CREATE INDEX letter_version_extract_place_letter_id ON letter_version_extract_place (version_id);
  CREATE INDEX letter_version_extract_person_person_id ON letter_version_extract_person (person_id);
  CREATE INDEX letter_version_extract_place_place_id ON letter_version_extract_place (place_id);

  -- Replace c_xpath_tei function: should be immutable
  CREATE OR REPLACE FUNCTION c_xpath_tei(xp text, x xml) RETURNS xml[]
        LANGUAGE SQL
        IMMUTABLE PARALLEL SAFE
      RETURN xpath(xp, x, ARRAY[ARRAY['TEI', 'http://www.tei-c.org/ns/1.0']]);
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
