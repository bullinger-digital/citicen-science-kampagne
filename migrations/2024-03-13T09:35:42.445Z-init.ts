import { CreateTableBuilder, Kysely, sql } from "kysely";

const withVersioning = (tb: CreateTableBuilder<string, any>) => {
  return tb
    .addColumn("version_id", "serial", (c) => c.primaryKey().notNull())
    .addColumn("is_latest", "boolean", (c) => c.defaultTo(true).notNull())
    .addColumn("git_import_id", "integer", (c) => c.references("git_import.id"))
    .addColumn("is_touched", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("is_new", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("review_state", "text", (c) => c.notNull())
    .addCheckConstraint(
      "review_state_is_one_of",
      sql`review_state IN ('pending', 'accepted', 'rejected')`
    )
    .addColumn("git_export_id", "integer", (c) => c.references("git_export.id"))
    .addColumn("created_log_id", "integer", (c) =>
      c.notNull().references("log.id")
    )
    .addColumn("reviewed_log_id", "integer", (c) => c.references("log.id"));
};

const versioned_tables = ["letter", "person", "person_alias", "place"];

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("user")
    .addColumn("id", "serial", (c) => c.primaryKey().notNull())
    .addColumn("sub", "text", (c) => c.unique().notNull())
    .addColumn("email", "text", (c) => c.unique().notNull())
    .addColumn("user_name", "text", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) =>
      c.defaultTo(sql`now()`).notNull()
    )
    .addColumn("updated_at", "timestamptz", (c) =>
      c.defaultTo(sql`now()`).notNull()
    )
    .addColumn("last_login_at", "timestamptz", (c) => c.notNull())
    .addColumn("roles", "jsonb", (c) => c.notNull().defaultTo("[]"))
    .addCheckConstraint("roles_is_array", sql`jsonb_typeof(roles) = 'array'`)
    .execute();

  await db.schema
    .createTable("log")
    .addColumn("id", "serial", (c) => c.primaryKey().notNull())
    .addColumn("timestamp", "timestamptz", (c) =>
      c.defaultTo(sql`now()`).notNull()
    )
    .addColumn("log_type", "text", (c) => c.notNull())
    .addColumn("created_by_id", "integer", (c) =>
      c.notNull().references("user.id")
    )
    .execute();

  await db.schema
    .createTable("git_import")
    .addColumn("id", "serial", (c) => c.primaryKey().notNull())
    .addColumn("hash", "text", (c) => c.unique().notNull())
    .addColumn("is_current", "boolean", (c) => c.defaultTo(true).notNull())
    .addColumn("created_log_id", "integer", (c) =>
      c.notNull().references("log.id")
    )
    .execute();

  // Make sure there's only one latest git import
  await db.schema
    .createIndex("git_import_is_latest")
    .unique()
    .on("git_import")
    .columns(["is_current"])
    .where("is_current", "is", true)
    .execute();

  await db.schema
    .createTable("git_export")
    .addColumn("id", "serial", (c) => c.primaryKey().notNull())
    .addColumn("base_commit_hash", "text", (c) => c.notNull())
    .addColumn("written_at", "timestamptz", (c) => c.notNull())
    .addColumn("created_log_id", "integer", (c) =>
      c.notNull().references("log.id")
    )
    .addColumn("updated_log_id", "integer", (c) => c.references("log.id"))
    .execute();

  // Letter ---------------------------------
  await db.schema
    .createTable("letter")
    .addColumn("id", "serial", (c) => c.primaryKey().notNull())
    .addColumn("created_log_id", "integer", (c) =>
      c.notNull().references("log.id")
    )
    .execute();

  await withVersioning(db.schema.createTable("letter_version"))
    .addColumn("id", "integer", (c) => c.notNull().references("letter.id"))
    .addColumn("xml", "text", (c) => c.notNull())
    .addColumn("actions", "jsonb", (c) => c.notNull().defaultTo("[]"))
    .addCheckConstraint(
      "actions_is_array",
      sql`jsonb_typeof(actions) = 'array'`
    )
    .execute();

  await db.schema
    .createTable("letter_version_action")
    .addColumn("action_id", "serial", (c) => c.primaryKey().notNull())
    .execute();

  // Person ---------------------------------
  await db.schema
    .createTable("person")
    .addColumn("id", "serial", (c) => c.primaryKey().notNull())
    .addColumn("created_log_id", "integer", (c) =>
      c.notNull().references("log.id")
    )
    .execute();

  await withVersioning(db.schema.createTable("person_version"))
    .addColumn("id", "integer", (c) => c.notNull().references("person.id"))
    .addColumn("gnd", "text", (c) => c)
    .addColumn("wiki", "text", (c) => c)
    .addColumn("portrait", "text", (c) => c)
    .addColumn("hist_hub", "text", (c) => c)
    .execute();

  await db.schema
    .createTable("person_alias")
    .addColumn("id", "serial", (c) => c.primaryKey().notNull())
    .addColumn("created_log_id", "integer", (c) =>
      c.notNull().references("log.id")
    )
    .execute();

  await withVersioning(db.schema.createTable("person_alias_version"))
    .addColumn("id", "integer", (c) =>
      c.notNull().references("person_alias.id")
    )
    .addColumn("person_id", "integer", (c) =>
      c.notNull().references("person.id")
    )
    .addColumn("forename", "text", (c) => c.notNull())
    .addColumn("surname", "text", (c) => c.notNull())
    .addColumn("type", "text", (c) => c.notNull())
    .execute();

  // Ensure there's only one person alias with type 'main'
  await db.schema
    .createIndex("person_alias_version_main")
    .unique()
    .on("person_alias_version")
    .columns(["id", "is_latest", "git_import_id", "type"])
    .where("type", "=", "main")
    .execute();

  // Place ---------------------------------
  await db.schema
    .createTable("place")
    .addColumn("id", "serial", (c) => c.primaryKey().notNull())
    .addColumn("created_log_id", "integer", (c) =>
      c.notNull().references("log.id")
    )
    .execute();

  await withVersioning(db.schema.createTable("place_version"))
    .addColumn("id", "integer", (c) => c.notNull().references("place.id"))
    .addColumn("settlement", "text", (c) => c.notNull())
    .addColumn("district", "text", (c) => c.notNull())
    .addColumn("country", "text", (c) => c.notNull())
    .addColumn("latitude", "double precision", (c) => c.notNull())
    .addColumn("longitude", "double precision", (c) => c.notNull())
    .execute();

  await Promise.all(
    versioned_tables.map((table) =>
      // Ensure there's only one latest version of each entity
      db.schema
        .createIndex(`${table}_version_is_latest`)
        .unique()
        .on(`${table}_version`)
        .columns(["id", "is_latest", "git_import_id"])
        .where("is_latest", "is", true)
        .execute()
    )
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  throw new Error("Down migration not implemented");
}
