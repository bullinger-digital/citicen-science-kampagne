import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    -- Get rid of the separate person_alias and person_alias_version tables
    -- by inlining aliases to the person_version table.

    ALTER TABLE person_version
        ADD COLUMN forename TEXT,
        ADD COLUMN surname TEXT,
        ADD COLUMN aliases JSONB;

    WITH person AS (
        SELECT
            version_id,
            (SELECT forename FROM person_alias_version WHERE
                person_version.git_import_id = person_alias_version.git_import_id
                AND person_alias_version.person_id = person_version.id
                AND person_alias_version.is_latest = true
                AND person_alias_version.type = 'main'
            ) as forename,
            (SELECT surname FROM person_alias_version WHERE
                person_version.git_import_id = person_alias_version.git_import_id
                AND person_alias_version.person_id = person_version.id
                AND person_alias_version.is_latest = true
                AND person_alias_version.type = 'main'
            ) as surname,
            (SELECT json_agg(
                json_build_object(
                'id', id,
                    'surname', surname,
                    'forename', forename,
                    'type', type
                )) FROM person_alias_version WHERE
                person_version.git_import_id = person_alias_version.git_import_id
                AND person_alias_version.person_id = person_version.id
                AND person_alias_version.is_latest = true
                AND person_alias_version.type <> 'main'
            ) as aliases
        FROM person_version
    )
    UPDATE person_version
        SET forename = (SELECT forename FROM person WHERE version_id = person_version.version_id),
        surname = (SELECT surname FROM person WHERE version_id = person_version.version_id),
        aliases = COALESCE((SELECT aliases FROM person WHERE version_id = person_version.version_id), '[]');

    ALTER TABLE person_alias RENAME TO removed_person_alias;
    ALTER TABLE person_alias_version RENAME TO removed_person_alias_version;

    CREATE OR REPLACE FUNCTION person_version_extract_aliases_string(aliases jsonb)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
    AS $function$
            SELECT COALESCE(
                STRING_AGG(x, E' '), '') FROM
                    (SELECT (a ->> 'surname') || ' ' || (a ->>'forename') as x FROM jsonb_array_elements(aliases) as a)
    $function$;

    ALTER TABLE person_version
        ADD COLUMN aliases_string TEXT GENERATED ALWAYS AS (person_version_extract_aliases_string(aliases)) STORED;

    CREATE INDEX idx_person_version__forename_trgm
        ON person_version USING gin (forename gin_trgm_ops);

    CREATE INDEX idx_person_version__surname_trgm
        ON person_version USING gin (surname gin_trgm_ops);

    CREATE INDEX idx_person_version__aliases_trgm
        ON person_version USING gin (aliases_string gin_trgm_ops);

    ALTER TABLE person_version ALTER COLUMN forename SET NOT NULL;
    ALTER TABLE person_version ALTER COLUMN surname SET NOT NULL;
    ALTER TABLE person_version ALTER COLUMN aliases SET NOT NULL;
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
