import "server-only";
import { Pool } from "pg";
import { JSONColumnType, Kysely, PostgresDialect } from "kysely";
import { DB as DBGenerated } from "./generated/kysely-codegen";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

export type AliasType = {
  id?: number | null;
  forename: string;
  surname: string;
  type: string;
}[];

export type DB = DBGenerated & {
  person_version: DBGenerated["person_version"] & {
    aliases: JSONColumnType<AliasType, AliasType, AliasType>;
  };
};

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
    //   if (event.level === "query" || event.level === "error") {
    //     console.log(event.query.sql);
    //     console.log(event.query.parameters);
    //     console.log(event.queryDurationMillis);
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
