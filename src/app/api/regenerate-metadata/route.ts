import { kdb } from "@/lib/db";
import { extractAndStoreMetadata } from "@/lib/extractMetadata";
import { withRequireRoleAppApi } from "@/lib/security/withRequireRole";
import { Versioning, whereCurrent } from "@/lib/versioning";
import { xmlParseFromString } from "@/lib/xmlSerialize";
import { NextRequest } from "next/server";
import { JSDOM } from "jsdom";
if (!globalThis.window) {
  // Hack to make JSDOM window available globally
  // used in xmlSerialize.ts
  (globalThis as any).jsDomWindow = new JSDOM().window;
}

const BADGE_SIZE = 100;

export const GET = withRequireRoleAppApi(
  "data-admin",
  async (req: NextRequest) => {
    await kdb.transaction().execute(async (db) => {
      const currentLettersCount = await kdb
        .selectFrom("letter_version")
        .where(whereCurrent)
        .select((e) => e.fn.countAll<number>().as("count"))
        .executeTakeFirstOrThrow();

      console.log(
        "Processing metadata for",
        currentLettersCount?.count,
        "letters"
      );

      // Process in badges
      for (let i = 0; i < currentLettersCount?.count; i += BADGE_SIZE) {
        const letters = await kdb
          .selectFrom("letter_version")
          .where(whereCurrent)
          .orderBy("id")
          .limit(BADGE_SIZE)
          .offset(i)
          .select(["xml", "id", "version_id"])
          .execute();

        for (const letter of letters) {
          await extractAndStoreMetadata({
            db,
            xmlDom: xmlParseFromString(letter.xml),
            versionId: letter.version_id,
            letterId: letter.id,
          });
        }

        console.log("Processed metadata for letters", i, "to", i + BADGE_SIZE);
      }

      console.log("Done processing, updating link counts...");
      const v = new Versioning(db);
      await v.updateComputedLinkCounts({});

      console.log("Done updating metadata!");
    });

    return new Response("Done!");
  }
);
