"use server";
import { kdb } from "../db";
import { requireRoleOrThrow } from "../security/withRequireRole";
import { Versioning } from "../versioning";
import { LOCK_DURATION } from "./locking_common";

export const aquireLetterLock = async ({ id }: { id: number }) => {
  await requireRoleOrThrow("admin");
  if (!id) throw new Error("ID is required");

  const v = new Versioning();
  const userSub = await v.getUserSub();

  const expirationThreshold = new Date(Date.now() - LOCK_DURATION);

  return await kdb
    .transaction()
    .setIsolationLevel("serializable")
    .execute(async (db) => {
      // Find existing lock
      const queryExistingLock = () =>
        db
          .selectFrom("letter_lock")
          .where("letter_lock.id", "=", id)
          .leftJoin("user", "locked_by_id", "user.id")
          .select(["locked_at", "user.id", "user.sub as user_sub"])
          .executeTakeFirst();

      const existingLock = await queryExistingLock();

      const lockedByCurrentUserOrExpired =
        existingLock &&
        (existingLock.user_sub === userSub ||
          existingLock.locked_at < expirationThreshold);

      if (lockedByCurrentUserOrExpired) {
        // Update lock if user already owns the lock or the lock is expired
        await kdb
          .updateTable("letter_lock")
          .set("locked_at", new Date())
          .set("locked_by_id", (e) =>
            e.selectFrom("user").where("sub", "=", userSub).select("user.id")
          )
          .where("letter_lock.id", "=", id)
          .execute();

        return {
          success: true,
          type: "renewed_lock",
        };
      }

      if (!existingLock) {
        // Create lock if no lock exists
        await kdb
          .insertInto("letter_lock")
          .values({
            id,
            locked_by_id: (e) =>
              e.selectFrom("user").where("sub", "=", userSub).select("user.id"),
          })
          .execute();

        return {
          success: true,
          type: "new_lock",
        };
      }

      return {
        success: false,
        type: "already_locked",
        lockedById: existingLock.id,
      };
    });
};
