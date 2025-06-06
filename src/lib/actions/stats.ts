"use server";
import "server-only";
import { kdb } from "@/lib/db";
import { whereCurrent } from "../versioning";
import { sql } from "kysely";
import { unstable_cache } from "next/cache";

const CACHE_DURATION = 60 * 60; // 1 hour

export const getLetterStats = unstable_cache(
  async () => {
    const baseQuery = kdb
      .selectFrom("letter_version")
      .where(whereCurrent)
      // Filter out automatic transcriptions
      // Todo: reuse code from citizen.ts
      .where("extract_source", "<>", "keine")
      .where("extract_type", "not in", ["Hinweis", "Verweis"]);

    const letterStats = await baseQuery
      .groupBy("extract_status")
      .select("extract_status")
      .select((e) => e.fn.countAll<string>().as("count"))
      .execute();

    const editedLettersStats = await baseQuery
      .where("extract_source", "like", "HBBW-%")
      .groupBy("extract_status")
      .select("extract_status")
      .select((e) => e.fn.countAll<string>().as("count"))
      .execute();

    return { letterStats, editedLettersStats };
  },
  ["citizen-stats"],
  { revalidate: CACHE_DURATION }
);

export const getUserStats = unstable_cache(
  async () => {
    const before = performance.now();
    const query = kdb
      .with("users_counts", (eb) =>
        eb
          .selectFrom("user")
          .select("id")
          .select((e) =>
            e
              .selectFrom("letter_version")
              .leftJoin("log", "log.id", "letter_version.created_log_id")
              .where("log.created_by_id", "=", e.ref("user.id"))
              .where("letter_version.review_state", "<>", "rejected")
              .select((e) =>
                e.fn
                  .coalesce((e2) => e2.fn.sum<number>(sql`stats_actions_count`))
                  .as("actions_count")
              )
              .as("actions_count")
          )
          .select((e) =>
            e
              .selectFrom("letter_version")
              .leftJoin("log", "log.id", "letter_version.created_log_id")
              .where("log.created_by_id", "=", e.ref("user.id"))
              .where("letter_version.review_state", "<>", "rejected")
              .where("letter_version.stats_finished_letter", "=", true)
              .select((e) =>
                e.fn.countAll<number>().as("letters_finished_count")
              )
              .as("letters_finished_count")
          )
      )
      .selectFrom("users_counts")
      .select(
        sql<number>`coalesce(actions_count + (4 * letters_finished_count), 0)`.as(
          "points"
        )
      )
      .select("users_counts.actions_count")
      .select("users_counts.letters_finished_count")
      .select("id")
      .orderBy("points", "desc")
      .orderBy("users_counts.id", "asc")
      .limit(100);

    const userStats = await query.execute();
    console.log(
      "Get user stats called (should be cached); took",
      performance.now() - before,
      "ms"
    );
    return userStats;
  },
  ["citizen-stats"],
  { revalidate: CACHE_DURATION }
);
