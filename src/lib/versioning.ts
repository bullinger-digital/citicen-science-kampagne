import "server-only";
import { kdb as kdb2 } from "@/lib/db";
import { getSession } from "@auth0/nextjs-auth0";
import { Kysely, UpdateObject, sql } from "kysely";
import { ExpressionBuilder, InsertObject, Transaction } from "kysely";
import { extractAndStoreMetadata } from "./extractMetadata";
import { xmlParseFromString } from "./xmlSerialize";
import { DB } from "./generated/kysely-codegen";

export const versionedTables = [
  "letter",
  "person",
  "person_alias",
  "place",
] as const;
export type Versioned = "letter" | "person" | "person_alias" | "place";
export type VersionedTable = `${Versioned}_version`;

export type ImportSpecs = {
  logId: number;
  gitImportId: number;
};

type InternalVersioningKeys =
  | "id"
  | "created_log_id"
  | "is_touched"
  | "version_id"
  | "review_state"
  | "is_new"
  | "is_latest"
  | "git_import_id";

export class Versioning {
  db: Kysely<DB> | Transaction<DB>;
  constructor(transaction?: Transaction<DB>) {
    this.db = transaction || kdb2;
  }

  async importVersioned<T extends Versioned, TV extends `${T}_version`>(
    table: T,
    id: number,
    data: Omit<
      InsertObject<DB, TV>,
      | "id"
      | "created_log_id"
      | "git_import_id"
      | "is_touched"
      | "version_id"
      | "review_state"
    >,
    importSpecs: ImportSpecs
  ) {
    if (!this.db.isTransaction) {
      throw new Error("Import must run in a transaction");
    }

    const versions_table = `${table}_version` as TV;

    const existingRepoEntry = await this.db
      .selectFrom(table)
      .where("id", "=", id as any)
      .selectAll()
      .executeTakeFirst();

    if (!existingRepoEntry) {
      await this.db
        .insertInto<Versioned>(table)
        .values({
          id,
          created_log_id: importSpecs.logId,
        })
        .execute();
    }

    const values: InsertObject<DB, VersionedTable> = {
      ...data,
      id: id,
      created_log_id: importSpecs.logId,
      git_import_id: importSpecs.gitImportId,
      is_touched: false,
      review_state: "accepted",
    };

    const v = await this.db
      .insertInto<VersionedTable>(versions_table)
      .values(values)
      .returning(["version_id"])
      .executeTakeFirstOrThrow();

    await versionedAfterSaveHooks[table]?.(
      this.db,
      v.version_id,
      values as InsertObject<DB, `${T}_version`>
    );

    return v;
  }

  async insertAndCreateNewVersion<
    T extends Versioned,
    TV extends `${T}_version`,
  >(
    table: T,
    data: Omit<InsertObject<DB, TV>, InternalVersioningKeys>,
    logId?: number | undefined
  ) {
    return await wrapTransaction(this.db, async (db) => {
      logId = logId || (await this.createLogId("user"));

      const id = (
        await db
          .insertInto<Versioned>(table)
          .values({
            created_log_id: logId,
          })
          .returning(["id"])
          .executeTakeFirstOrThrow()
      ).id;

      const insertedVersion = await this.createNewVersion(
        table,
        id,
        null,
        data as UpdateObject<DB, TV>,
        logId,
        false
      );
      return insertedVersion;
    });
  }

  async createNewVersion<T extends Versioned, TV extends `${T}_version`>(
    table: T,
    id: number,
    parent_version_id: number | null,
    data: Omit<UpdateObject<DB, TV>, InternalVersioningKeys>,
    logId?: number | undefined,
    autoAccept: boolean = true
  ) {
    const versions_table = `${table}_version` as TV;

    return await wrapTransaction(this.db, async (db) => {
      const existingVersion = parent_version_id
        ? await this.getCurrentVersion(table, id, parent_version_id)
        : null;

      if (parent_version_id && !existingVersion) {
        throw new Error(
          "Previous version not found, version id: " + parent_version_id
        );
      }

      logId = logId || (await this.createLogId("user"));

      // Mark all other versions as not current
      await db
        .updateTable<VersionedTable>(versions_table)
        .set({
          is_latest: false,
        })
        .where(whereCurrent)
        .where("id", "=", id)
        .execute();

      const gitImportId =
        existingVersion?.git_import_id ||
        (
          await db
            .selectFrom("git_import")
            .where("is_current", "is", true)
            .selectAll()
            .executeTakeFirstOrThrow()
        )?.id;

      const values: InsertObject<DB, VersionedTable> = {
        ...existingVersion,
        ...data,
        id: id,
        created_log_id: logId,
        is_touched: true,
        is_latest: true,
        is_new: parent_version_id ? false : true,
        version_id: undefined,
        review_state: autoAccept ? "accepted" : "pending",
        git_import_id: gitImportId,
      };

      const v = await db
        .insertInto<VersionedTable>(versions_table)
        .values(serializeArrayAndObjectTypes(values))
        .returningAll()
        .executeTakeFirstOrThrow();

      await versionedAfterSaveHooks[table]?.(
        db,
        v.version_id,
        values as InsertObject<DB, `${T}_version`>
      );

      return v;
    });
  }

  async getCurrentVersion<T extends Versioned, TV extends `${T}_version`>(
    table: T,
    id: number,
    /** If version_id is passed, this method will also check if the latest version equals this id */
    version_id?: number
  ) {
    const versions_table = `${table}_version` as TV;

    return await this.db
      .selectFrom<VersionedTable>(versions_table)
      .where(whereCurrent)
      .where("id", "=", id as any)
      .$if(!!version_id, (e) => e.where("version_id", "=", version_id as any))
      .selectAll()
      .executeTakeFirst();
  }

  async tempApproveAllChanges() {
    const logId = await this.createLogId("review");
    await this.db
      .updateTable("person_version")
      .where("review_state", "=", "pending")
      .set({ review_state: "accepted", reviewed_log_id: logId })
      .execute();

    await this.db
      .updateTable("person_alias_version")
      .where("review_state", "=", "pending")
      .set({ review_state: "accepted", reviewed_log_id: logId })
      .execute();

    await this.db
      .updateTable("place_version")
      .where("review_state", "=", "pending")
      .set({ review_state: "accepted", reviewed_log_id: logId })
      .execute();
  }

  async countUncommitedChanges() {
    const uncommitedChanges = await versionedTables.reduce(
      async (acc, table) => {
        const count = (
          await this.db
            .selectFrom<VersionedTable>(`${table}_version`)
            .where((e) =>
              e.and([
                e("is_touched", "is", true),
                e("git_export_id", "is", null),
                e("is_latest", "is", true),
              ])
            )
            .select((e) => {
              return e.fn.countAll<number>().as("count");
            })
            .executeTakeFirstOrThrow()
        ).count;

        return (await acc) + count;
      },
      Promise.resolve(0)
    );

    return uncommitedChanges;
  }

  /** Remove all latest, non-touched entries */
  removeNontouchedLatest = async () => {
    await Promise.all(
      versionedTables.map(async (table) => {
        await this.db
          .deleteFrom<VersionedTable>(`${table}_version`)
          .where((e) =>
            e.and([e("is_latest", "is", true), e("is_touched", "is", false)])
          )
          .execute();
      })
    );
  };

  createLogId = async (type: "import" | "user" | "export" | "review") => {
    return (
      await this.db
        .insertInto("log")
        .values({
          created_by_id: (await this.requireUser())?.id,
          log_type: type,
        })
        .returningAll()
        .executeTakeFirstOrThrow()
    ).id;
  };

  async getUserSub() {
    const session = await getSession();
    return session?.user.sub as string;
  }

  async requireUser() {
    const user = await this.getUser();
    if (!user) {
      throw new Error("User not found");
    }
    return user!;
  }

  async getUser() {
    const userSub = await this.getUserSub();
    return await this.db
      .selectFrom("user")
      .where("sub", "=", userSub)
      .selectAll()
      .executeTakeFirst();
  }

  async updateComputedLinkCounts({
    letterId,
  }: {
    letterId?: number | undefined;
  }) {
    await this.db
      .updateTable("person")
      .$if(!!letterId, (e) =>
        e.where((eb) =>
          eb.exists(
            eb
              .selectFrom("letter_version_extract_person as p")
              .innerJoin("letter_version as v", "v.version_id", "p.version_id")
              .where("p.person_id", "=", eb.ref("person.id"))
              .where("v.id", "=", letterId!)
          )
        )
      )
      .set((eb) => {
        return {
          computed_link_counts: eb
            .selectFrom("letter_version_extract_person as v")
            .innerJoin("letter_version as lv", "lv.version_id", "v.version_id")
            // Todo: Fix typing
            .where(whereCurrent as any)
            .where((e) => e.and([e("v.person_id", "=", eb.ref("person.id"))]))
            .select(eb.fn.countAll<number>().as("count")),
        };
      })
      .execute();

    await this.db
      .updateTable("place")
      .$if(!!letterId, (e) =>
        e.where((eb) =>
          eb.exists(
            eb
              .selectFrom("letter_version_extract_place as p")
              .innerJoin("letter_version as v", "v.version_id", "p.version_id")
              .where("p.place_id", "=", eb.ref("place.id"))
              .where("v.id", "=", letterId!)
          )
        )
      )
      .set((eb) => {
        return {
          computed_link_counts: eb
            .selectFrom("letter_version_extract_place as v")
            .innerJoin("letter_version as lv", "lv.version_id", "v.version_id")
            // Todo: Fix typing
            .where(whereCurrent as any)
            .where((e) => e.and([e("v.place_id", "=", eb.ref("place.id"))]))
            .select(eb.fn.countAll<number>().as("count")),
        };
      })
      .execute();
  }

  async resetPostgresIdSequences() {
    const tables = ["person", "place", "person_alias"];
    await wrapTransaction(this.db, async (db) => {
      for (const table of tables) {
        await sql`SELECT setval('${sql.id(
          table + "_id_seq"
        )}', (SELECT MAX(id) FROM ${sql.id(table)}), true);`.execute(db);
      }
    });
  }
}

export const whereCurrent = <TA extends keyof DB>(
  eb: ExpressionBuilder<DB, TA & VersionedTable>
) =>
  eb.and([
    eb("is_latest", "is", true as any),
    eb("git_import_id", "=", (e: any) =>
      e.selectFrom("git_import").select("id").where("is_current", "is", true)
    ),
  ]);

const wrapTransaction = async <T>(
  db: Kysely<DB>,
  callback: (db: Kysely<DB>) => T
) => {
  if (db.isTransaction) {
    return await callback(db);
  } else {
    return await db.transaction().execute(async (db) => {
      return await callback(db);
    });
  }
};

/** Workaround for https://github.com/brianc/node-postgres/issues/2680 */
const serializeArrayAndObjectTypes = <T extends Record<string, any>>(
  obj: T
): T => {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (!value) {
        return [key, value];
      } else if (Array.isArray(value)) {
        return [key, JSON.stringify(value)];
      } else if (typeof value === "object") {
        return [key, JSON.stringify(value)];
      } else {
        return [key, value];
      }
    })
  ) as T;
};

const versionedAfterSaveHooks: {
  [K in Versioned]?: (
    db: Kysely<DB>,
    versionId: number,
    insertedValues: InsertObject<DB, `${K}_version`>
  ) => Promise<void>;
} = {
  letter: async (db, versionId, insertedValues) => {
    await extractAndStoreMetadata({
      db,
      xmlDom: xmlParseFromString(insertedValues.xml as string),
      versionId: versionId,
      letterId: insertedValues.id as number,
    });
  },
};
