import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE FUNCTION c_xpath_tei(xp text, x xml) RETURNS xml[]
      LANGUAGE SQL
      IMMUTABLE
      RETURN xpath(xp, x, ARRAY[ARRAY['TEI', 'http://www.tei-c.org/ns/1.0']]);

    CREATE FUNCTION c_extract_references(elementName text, x xml) RETURNS integer[]
    LANGUAGE SQL
    IMMUTABLE
    RETURN array(
      SELECT REGEXP_REPLACE(
        unnest(c_xpath_tei('//TEI:'::text || elementName || '[@ref]/@ref'::text, x))::text,
        '^[p|P|l|L]'::text, ''::text
      )::integer
    );

    ALTER TABLE register_file
    ADD COLUMN extract_place_references integer[] GENERATED ALWAYS AS
    (CASE WHEN name = 'localities.xml' THEN
      array[]::integer[]
    ELSE c_extract_references('placeName', xml) END) STORED;

    ALTER TABLE register_file
    ADD COLUMN extract_person_references integer[] GENERATED ALWAYS AS
    (CASE WHEN name = 'persons.xml' THEN
      array[]::integer[]
    ELSE c_extract_references('persName', xml) END) STORED;

  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
