"use server";
import { kdb } from "@/lib/db";
import { Versioned, Versioning, whereCurrent } from "../versioning";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { EditorAction, applyNewActions } from "../xml";
import { JSDOM } from "jsdom";
import { ExpressionBuilder } from "kysely";
import { xmlParseFromString, xmlSerializeToString } from "../xmlSerialize";
import { requireRoleOrThrow } from "../security/withRequireRole";
import { DB } from "../generated/kysely-codegen";

if (!globalThis.window) {
  // Hack to make JSDOM window available globally
  // used in xmlSerialize.ts
  (globalThis as any).jsDomWindow = new JSDOM().window;
}

export const fileOnCurrentCommit = async ({ id }: { id: string }) => {
  await requireRoleOrThrow("user");
  if (!id) throw new Error("ID is required");

  const v = new Versioning();
  return await v.getCurrentVersion("letter", parseInt(id));
};

export const personById = async ({ id }: { id: string }) => {
  await requireRoleOrThrow("user");
  if (!id) throw new Error("ID is required");
  const p = await kdb
    .selectFrom("person_version")
    .where(whereCurrent)
    .where("id", "=", parseInt(id))
    .selectAll()
    .select((e) => [
      jsonArrayFrom(
        e
          .selectFrom("person_alias_version")
          .where(whereCurrent)
          .where("person_id", "=", e.ref("person_version.id"))
          .selectAll()
      ).as("aliases"),
    ])
    .select((e) => [
      jsonArrayFrom(
        e
          .selectFrom("letter_version_extract_person as l")
          .innerJoin("letter_version as v2", "v2.version_id", "l.version_id")
          // Todo: fix typing
          .where(whereCurrent as any)
          .where("l.person_id", "=", e.ref("person_version.id"))
          .select(["v2.id"])
          .distinct()
          .orderBy("v2.id", "asc")
          .limit(10)
      ).as("links"),
    ])
    .executeTakeFirstOrThrow();
  return p;
};

export const searchPerson = async ({ query }: { query: string }) => {
  await requireRoleOrThrow("user");
  const people = await kdb
    .selectFrom("person_version")
    .where(whereCurrent)
    .where((e) =>
      e.or([
        e.exists(
          e
            .selectFrom("person_alias_version")
            .where(whereCurrent)
            .where("person_id", "=", e.ref("person_version.id"))
            .where((ea) =>
              ea(
                ea(
                  ea(ea.ref("person_alias_version.forename"), "||", " "),
                  "||",
                  ea.ref("person_alias_version.surname")
                ),
                "ilike",
                `%${query}%` as any
              )
            )
            .selectAll()
        ),
        // Search in text of nodes linked to the person
        e.exists(
          e
            .selectFrom("letter_version_extract_person as l")
            .innerJoin("letter_version as v2", "v2.version_id", "l.version_id")
            // Todo: Fix typing
            .where(whereCurrent as any)
            .where("l.person_id", "=", e.ref("person_version.id"))
            .where("l.node_text", "ilike", `%${query}%` as any)
            .selectAll()
        ),
      ])
    )
    .limit(10)
    .selectAll()
    .select((e) => [
      jsonArrayFrom(
        e
          .selectFrom("person_alias_version")
          .where(whereCurrent)
          .where("person_id", "=", e.ref("person_version.id"))
          .selectAll()
      ).as("aliases"),
    ])
    .select((e) =>
      e
        .selectFrom("letter_version_extract_person as l")
        .innerJoin("letter_version as v2", "v2.version_id", "l.version_id")
        // Todo: Fix typing
        .where(whereCurrent as any)
        .where("l.person_id", "=", e.ref("person_version.id"))
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .as("linksCount")
    )
    // Order by the number of letters the person is linked to (descending)
    .orderBy("linksCount", "desc")
    .execute();
  return people;
};

export const searchPlace = async ({ query }: { query: string }) => {
  await requireRoleOrThrow("user");
  const places = await kdb
    .selectFrom("place_version")
    .where(whereCurrent)
    .where((e) =>
      e.or([
        e("settlement", "ilike", `%${query}%` as any),
        e("district", "ilike", `%${query}%` as any),
        e("country", "ilike", `%${query}%` as any),
        // Search in text of nodes linked to the place
        e.exists(
          e
            .selectFrom("letter_version_extract_place as l")
            .innerJoin("letter_version as v2", "v2.version_id", "l.version_id")
            // Todo: Fix typing
            .where(whereCurrent as any)
            .where("l.place_id", "=", e.ref("place_version.id"))
            .where("l.node_text", "ilike", `%${query}%` as any)
            .selectAll()
        ),
      ])
    )
    .selectAll()
    .select((e) =>
      e
        .selectFrom("letter_version_extract_place as l")
        .innerJoin("letter_version as v2", "v2.version_id", "l.version_id")
        // Todo: Fix typing
        .where(whereCurrent as any)
        .where("l.place_id", "=", e.ref("place_version.id"))
        .select((eb) => eb.fn.countAll<number>().as("linksCount"))
        .as("linksCount")
    )
    // Order by the number of letters the place is linked to (descending)
    .orderBy("linksCount", "desc")
    .limit(10)
    .execute();
  return places;
};

export const placeById = async ({ id }: { id: string }) => {
  await requireRoleOrThrow("user");
  if (!id) throw new Error("ID is required");
  const p = await kdb
    .selectFrom("place_version")
    .where(whereCurrent)
    .where("id", "=", parseInt(id))
    .selectAll()
    .select((e) => [
      jsonArrayFrom(
        e
          .selectFrom("letter_version_extract_place as l")
          .innerJoin("letter_version as v2", "v2.version_id", "l.version_id")
          // Todo: fix typing
          .where(whereCurrent as any)
          .where("l.place_id", "=", e.ref("place_version.id"))
          .select(["v2.id"])
          .distinct()
          .orderBy("v2.id", "asc")
          .limit(10)
      ).as("links"),
    ])
    .executeTakeFirstOrThrow();
  return p;
};

export const getLogs = async () => {
  await requireRoleOrThrow("user");
  const selectRelatedCounts =
    (table: Versioned) => (eb: ExpressionBuilder<DB, "log">) =>
      eb
        .selectFrom(`${table}_version as v`)
        .where("v.created_log_id", "=", eb.ref("log.id"))
        .select((e) => e.fn.countAll<number>().as("count"))
        .limit(1)
        .as(`${table}_modified_count`);

  // Todo: Should we store the commit hash in the logs table? Probably yes, so we know which commit the log is related to
  // (for debugging)
  let query = kdb
    .selectFrom("log")
    .orderBy("timestamp", "desc")
    .selectAll()
    .select([
      (e) =>
        jsonArrayFrom(
          e
            .selectFrom("user")
            .where("id", "=", e.ref("log.created_by_id"))
            .select(["user_name"])
            .limit(1)
        ).as("user"),
    ])
    .select(selectRelatedCounts("letter"))
    .select(selectRelatedCounts("person"))
    .select(selectRelatedCounts("person_alias"))
    .select(selectRelatedCounts("place"))
    .limit(100);

  return await query.execute();
};

export const saveVersion = async ({
  id,
  version_id,
  xml,
  actions,
}: {
  id: number;
  version_id: number;
  xml: string;
  actions: EditorAction[];
}) => {
  await requireRoleOrThrow("user");
  const v = new Versioning();

  const currentVersion = await v.getCurrentVersion("letter", id, version_id);
  if (!currentVersion) throw new Error("Version not found or not current");

  // Check if actions applied to the existing xml is equal to the new xml
  const existingXml = xmlParseFromString(currentVersion.xml);
  try {
    applyNewActions(existingXml, actions);
  } catch (e) {
    console.error("Error applying actions", e);
    throw new Error("Error applying actions");
  }
  let newXml = xmlSerializeToString(existingXml);

  // Debug: Write both XMLs to disk
  // fs.writeFileSync(path.join(process.cwd(), "./debug", "new.xml"), newXml);
  // fs.writeFileSync(path.join(process.cwd(), "./debug", "existing.xml"), xml);

  if (newXml !== xml) throw new Error("XML does not match applied actions");

  await v.createNewVersion("letter", id, version_id, {
    xml: newXml,
    actions: actions.map((a) => {
      return { ...a, dom: undefined };
    }),
  });
};
