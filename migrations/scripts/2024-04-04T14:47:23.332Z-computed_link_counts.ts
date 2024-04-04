import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("person")
    .addColumn("computed_link_counts", "integer", (c) =>
      c.notNull().defaultTo(0)
    )
    .execute();

  await db.schema
    .alterTable("place")
    .addColumn("computed_link_counts", "integer", (c) =>
      c.notNull().defaultTo(0)
    )
    .execute();

  // Enable extension pg_trgm for trigram indexes
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`.execute(db);

  await sql`
    -- person indexes
    CREATE INDEX idx_person_alias_version__forename_trgm
    ON person_alias_version USING gin (forename gin_trgm_ops);

    CREATE INDEX idx_person_alias_version__surname_trgm
    ON person_alias_version USING gin (surname gin_trgm_ops);

    CREATE INDEX idx_letter_version_extract_person__node_text_trgm
    ON letter_version_extract_person USING gin (node_text gin_trgm_ops);

    CREATE INDEX idx_person__computed_links_count
    ON person (computed_link_counts);

    -- place indexes
    CREATE INDEX idx_place_version__settlement_trgm
    ON place_version USING gin (settlement gin_trgm_ops);

    CREATE INDEX idx_place_version__district_trgm
    ON place_version USING gin (district gin_trgm_ops);

    CREATE INDEX idx_place_version__country_trgm
    ON place_version USING gin (country gin_trgm_ops);

    CREATE INDEX idx_letter_version_extract_place__node_text_trgm
    ON letter_version_extract_place USING gin (node_text gin_trgm_ops);
    
    CREATE INDEX idx_place__computed_links_count
    ON place (computed_link_counts);

    -- general indexes
    CREATE INDEX idx_git_import__is_current
    ON git_import (is_current);
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
