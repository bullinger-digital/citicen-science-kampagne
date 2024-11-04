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
      .where("extract_source", "<>", "keine");

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

    const timeLineStats = await sql<{
      day: Date;
      current_items_count: number;
      current_items_count_edited: number;
    }>`WITH date_series AS (
          SELECT generate_series(
              '2024-05-31',
              CURRENT_DATE,
              '3 days'::interval
          )::date AS day
      ),
      version_history AS (
          SELECT lv.id,
            CASE WHEN (lv.extract_source LIKE 'HBBW-%') THEN lv.id ELSE NULL END as id_if_edited,
                lv.version_id,
                lv.extract_status,
                l."timestamp",
                ROW_NUMBER() OVER (PARTITION BY lv.id, l."timestamp"::date ORDER BY lv.version_id DESC) AS rn
          FROM public.letter_version lv
          JOIN public.log l ON lv.created_log_id = l.id
          WHERE lv.extract_status = 'finished'
        AND lv.extract_source <> 'keine'
        -- only letters which - based on the current data - need to be worked on
        AND EXISTS(
            SELECT id FROM letter_version WHERE extract_source <> 'keine' AND id = lv.id AND is_latest AND git_import_id = (SELECT id FROM git_import WHERE is_current)
          )
      )
      SELECT ds.day,
            COUNT(DISTINCT vh.id)::int AS current_items_count,
          COUNT(DISTINCT vh.id_if_edited)::int AS current_items_count_edited
      FROM date_series ds
      LEFT JOIN version_history vh ON vh."timestamp"::date <= ds.day AND vh.rn = 1
      GROUP BY ds.day
      ORDER BY ds.day;`
      .execute(kdb)
      .then((res) => res.rows);

    return { letterStats, editedLettersStats, timeLineStats };
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
