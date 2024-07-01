import "server-only";
import { DB, kdb as kdb2 } from "@/lib/db";
import { getSession } from "@auth0/nextjs-auth0";
import { Kysely, UpdateObject, sql } from "kysely";
import { ExpressionBuilder, InsertObject, Transaction } from "kysely";
import { extractAndStoreMetadata } from "./extractMetadata";
import { xmlParseFromString } from "./xmlSerialize";
import { whereExportFilter } from "./git/export";

export const versionedTables = ["letter", "person", "place"] as const;
export type Versioned = "letter" | "person" | "place";
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
  constructor(transaction?: Transaction<DB> | Kysely<DB>) {
    this.db = transaction || kdb2;
  }

  async importVersioned<T extends Versioned, TV extends `${T}_version`>(
    table: T,
    id: number,
    data: Omit<
      InsertObject<DB, TV>,
      "id" | "created_log_id" | "git_import_id" | "is_touched" | "version_id"
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
      // Todo: Fix typing
      review_state: (data as any).review_state,
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
        true,
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
    isNew: boolean,
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
        is_new: isNew,
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

  async throwIfVersionIsNotPending(
    db: Kysely<DB>,
    {
      table,
      versionId,
    }: {
      table: Versioned;
      versionId: number;
    }
  ) {
    const versions_table = `${table}_version` as VersionedTable;

    const currentReviewState = await this.db
      .selectFrom<VersionedTable>(versions_table)
      .where("version_id", "=", versionId)
      .select("review_state")
      .executeTakeFirstOrThrow();

    if (currentReviewState.review_state !== "pending") {
      throw new Error(
        `Cannot accept version ${versionId} as it is already ${currentReviewState.review_state}`
      );
    }
  }

  async getUsageCount({
    db,
    table,
    id,
  }: {
    db: Kysely<DB>;
    table: Versioned;
    id: number;
  }): Promise<number> {
    // Find usages
    const usages = await db
      .selectFrom(`letter_version_extract_${table as "person"}`)
      .leftJoin(
        "letter_version",
        "letter_version.version_id",
        `letter_version_extract_${table as "person"}.version_id`
      )
      .where(whereCurrent)
      .where(
        `letter_version_extract_${table as "person"}.${table as "person"}_id`,
        "=",
        id
      )
      .select((e) => e.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();

    return usages.count;
  }

  async isUsedInRegisterFile({
    db,
    table,
    id,
  }: {
    db: Kysely<DB>;
    table: Versioned;
    id: number;
  }): Promise<boolean> {
    const usages = await db
      .selectFrom("register_file")
      .where("git_import_id", "=", (e) =>
        e.selectFrom("git_import").select("id").where("is_current", "is", true)
      )
      .where(
        table === "person"
          ? "extract_person_references"
          : "extract_place_references",
        "@>",
        (e) => sql`ARRAY[${id}]::integer[]`
      )
      .select((e) => e.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();
    return usages.count > 0;
  }

  async throwIfItemInUse({
    db,
    table,
    id,
  }: {
    db: Kysely<DB>;
    table: Versioned;
    id: number;
  }) {
    const usages = await this.getUsageCount({ db, table, id });

    if (usages > 0) {
      throw new Error(
        `Cannot delete ${table} ${id} as it is used ${usages} times.`
      );
    }

    const isUsedInRegisterFile = await this.isUsedInRegisterFile({
      db,
      table,
      id,
    });

    if (isUsedInRegisterFile) {
      throw new Error(
        `Cannot delete ${table} ${id} as it is used in register_file.`
      );
    }
  }

  async deleteVersioned<T extends Versioned, TV extends `${T}_version`>(
    table: T,
    id: number
  ) {
    const versions_table = `${table}_version` as TV;

    await wrapTransaction(this.db, async (db) => {
      await this.throwIfItemInUse({ db, table, id });

      const deletedIds = await db
        .updateTable<VersionedTable>(versions_table)
        .set({
          deleted_log_id: await this.createLogId("delete"),
        })
        .where(whereCurrent)
        .where("id", "=", id)
        .returning("id")
        .execute();

      if (deletedIds.length === 0) {
        throw new Error(`No entries to remove found: ${table} ${id}`);
      }
    });
  }

  async acceptChanges({
    items,
  }: {
    items: { table: Versioned; versionId: number }[];
  }) {
    await wrapTransaction(this.db, async (db) => {
      for (const item of items) {
        await this.acceptChange(item);
      }
    });
  }

  async acceptChange({
    table,
    versionId,
  }: {
    table: Versioned;
    versionId: number;
  }) {
    await wrapTransaction(this.db, async (db) => {
      await this.throwIfVersionIsNotPending(db, { table, versionId });
      const versions_table = `${table}_version` as VersionedTable;

      await db
        .updateTable<VersionedTable>(versions_table)
        .set({
          review_state: "accepted",
          reviewed_log_id: await this.createLogId("review"),
        })
        .where("version_id", "=", versionId)
        .execute();
    });
  }

  async rejectChanges({
    items,
  }: {
    items: {
      table: Versioned;
      versionId: number;
      restoreToVersionId?: number;
    }[];
  }) {
    await wrapTransaction(this.db, async (db) => {
      for (const item of items) {
        await this.rejectChange(item);
      }
    });
  }

  async rejectChange({
    table,
    versionId,
    restoreToVersionId,
  }: {
    table: Versioned;
    versionId: number;
    restoreToVersionId?: number;
  }) {
    await wrapTransaction(this.db, async (db) => {
      await this.throwIfVersionIsNotPending(db, { table, versionId });
      const versions_table = `${table}_version` as VersionedTable;

      const logId = await this.createLogId("review");

      // Get (master) id of entry
      const { id: masterId, git_import_id: gitImportId } = await db
        .selectFrom<VersionedTable>(versions_table)
        .where("version_id", "=", versionId)
        .where(whereCurrent)
        .select(["id", "git_import_id"])
        .executeTakeFirstOrThrow();

      const latestAcceptedVersion = await db
        .selectFrom<VersionedTable>(versions_table)
        .where("id", "=", masterId)
        .where("review_state", "=", "accepted")
        .where("version_id", "<", versionId)
        .orderBy("version_id", "desc")
        .limit(1)
        .selectAll()
        .executeTakeFirst();

      if (latestAcceptedVersion) {
        // A previous version was accepted, so we need to restore to that version
        // Requirement: restoreToVersionId must match the version_id of the latest accepted version
        if (restoreToVersionId !== latestAcceptedVersion.version_id) {
          throw new Error(
            `Cannot reject new ${table} ${masterId}: entry has been accepted before, but the provided restore version id does not match the latest accepted version.`
          );
        }

        // Set version to rejected and is_latest to false
        await db
          .updateTable<VersionedTable>(versions_table)
          .set({
            review_state: "rejected",
            reviewed_log_id: logId,
            is_latest: false,
          })
          .where("version_id", "=", versionId)
          .execute();

        // Create new version with the content of the latest accepted version
        await db
          .insertInto<VersionedTable>(versions_table)
          .values({
            ...latestAcceptedVersion,
            git_import_id: gitImportId,
            created_log_id: logId,
            git_export_id: undefined,
            is_new: false,
            is_latest: true,
            is_touched: true,
            version_id: undefined,
            ...(table === "person"
              ? {
                  // alias_string is a generated field and cannot be inserted
                  aliases_string: undefined,
                  aliases: JSON.stringify(latestAcceptedVersion.aliases),
                }
              : {}),
          })
          .execute();

        // Here we could call the afterSaveHook, but it is not necessary, because letters are always accepted
      } else {
        // No previous version was accepted, so mark the entry as deleted
        // Requirement: restoreToVersionId must be null
        if (restoreToVersionId) {
          throw new Error(
            `Cannot reject new ${table} ${masterId}: entry has not been accepted before, but a restore version id was provided.`
          );
        }

        // Deletion can only happen if the entry is not in use
        // Prevent rejection if item is new and in use
        if (["person", "place"].includes(table)) {
          await this.throwIfItemInUse({ db, table, id: masterId });
        }

        // Simple case, set version to rejected and deleted
        await db
          .updateTable<VersionedTable>(versions_table)
          .set({
            review_state: "rejected",
            reviewed_log_id: logId,
            // If latest accepted version does not exist, reverting means deleting the entry - also set deleted_log_id
            deleted_log_id: logId,
          })
          .where("version_id", "=", versionId)
          .execute();
      }
    });
  }

  async countUncommitedChanges() {
    const uncommitedChanges = await versionedTables.reduce(
      async (acc, table) => {
        const count = (
          await this.db
            .selectFrom<VersionedTable>(`${table}_version`)
            .where((e) =>
              e.and([whereExportFilter(e), e("git_export_id", "is", null)])
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

  // /** Remove all latest, non-touched entries */
  // removeNontouchedLatest = async () => {
  //   await Promise.all(
  //     versionedTables.map(async (table) => {
  //       await this.db
  //         .deleteFrom<VersionedTable>(`${table}_version`)
  //         .where((e) =>
  //           e.and([e("is_latest", "is", true), e("is_touched", "is", false)])
  //         )
  //         .execute();
  //     })
  //   );
  // };

  createLogId = async (
    type: "import" | "user" | "export" | "review" | "move-usages" | "delete"
  ) => {
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
    letterIds,
  }: {
    letterId?: number | undefined;
    letterIds?: number[] | undefined;
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
      .$if(!!letterIds, (e) =>
        e.where((eb) =>
          eb.exists(
            eb
              .selectFrom("letter_version_extract_person as p")
              .innerJoin("letter_version as v", "v.version_id", "p.version_id")
              .where("p.person_id", "=", eb.ref("person.id"))
              .where("v.id", "in", letterIds!)
          )
        )
      )
      .set((eb) => {
        return {
          computed_link_counts: eb
            .selectFrom((eb) =>
              eb
                .selectFrom("letter_version_extract_person as v")
                .innerJoin(
                  "letter_version as lv",
                  "lv.version_id",
                  "v.version_id"
                )
                // Todo: Fix typing
                .where(whereCurrent as any)
                .where("v.person_id", "=", eb.ref("person.id"))
                .select(["lv.id"])
                .distinct()
                .as("link_count")
            )
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
      .$if(!!letterIds, (e) =>
        e.where((eb) =>
          eb.exists(
            eb
              .selectFrom("letter_version_extract_place as p")
              .innerJoin("letter_version as v", "v.version_id", "p.version_id")
              .where("p.place_id", "=", eb.ref("place.id"))
              .where("v.id", "in", letterIds!)
          )
        )
      )
      .set((eb) => {
        return {
          computed_link_counts: eb
            .selectFrom((eb) =>
              eb
                .selectFrom("letter_version_extract_place as v")
                .innerJoin(
                  "letter_version as lv",
                  "lv.version_id",
                  "v.version_id"
                )
                // Todo: Fix typing
                .where(whereCurrent as any)
                .where((e) => e.and([e("v.place_id", "=", eb.ref("place.id"))]))
                .select(["lv.id"])
                .distinct()
                .as("link_count")
            )
            .select(eb.fn.countAll<number>().as("count")),
        };
      })
      .execute();
  }

  async resetPostgresIdSequences() {
    const tables = ["person", "place"];
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
  eb: ExpressionBuilder<DB, TA & VersionedTable>,
  includeDeleted = false
) =>
  eb.and([
    eb("is_latest", "is", true as any),
    eb("git_import_id", "=", (e: any) =>
      e.selectFrom("git_import").select("id").where("is_current", "is", true)
    ),
    // Probably, we could remove this filter, because latest versions should not be rejected if not deleted
    ...(includeDeleted ? [] : [eb("review_state", "<>", "rejected" as any)]),
    ...(includeDeleted ? [] : [eb("deleted_log_id", "is", null)]),
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
