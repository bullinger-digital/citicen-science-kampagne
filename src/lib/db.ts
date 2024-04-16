import "server-only";
import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { DB } from "./generated/kysely-codegen";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// Idea taken from https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices
const clientSingleton = () => {
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

  return new Kysely<DB>({
    dialect,
    // log(event) {
    //   if (event.level === "query") {
    //     console.log(event.query.sql);
    //     console.log(event.query.parameters);
    //   }
    // },
  });
};

declare global {
  var _kdbGlobal: undefined | ReturnType<typeof clientSingleton>;
}

export const kdb = globalThis._kdbGlobal ?? clientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis._kdbGlobal = kdb;
}
