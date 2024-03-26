import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { DB } from "./generated/kysely-codegen";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

if (
  !process.env.DATABASE_URL &&
  process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD
) {
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
