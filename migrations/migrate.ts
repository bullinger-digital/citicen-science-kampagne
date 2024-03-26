// Call with `node .next/server/migrate.js` (or `npm run migrate-dev`)

import * as path from "path";
import { promises as fs } from "fs";
import {
  Migrator,
  FileMigrationProvider,
  Kysely,
  PostgresDialect,
} from "kysely";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config({
  path: path.join("../.env"),
});

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
});

const db = new Kysely<any>({
  dialect: dialect,
});

export async function migrateToLatest() {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(process.cwd(), "scripts"),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (results?.length === 0) {
    console.log("no migrations to run");
  }

  if (error) {
    console.error("failed to migrate");
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
}

migrateToLatest();
