import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { DB } from "./generated/kysely-codegen";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
});

export const kdb = new Kysely<DB>({
  dialect,
  // log(event) {
  //   if (event.level === "query") {
  //     console.log(event.query.sql);
  //     console.log(event.query.parameters);
  //   }
  // },
});
