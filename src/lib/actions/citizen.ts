"use server";
import "server-only";
import { kdb } from "@/lib/db";
import { Versioning, whereCurrent } from "../versioning";
import { EditorAction, applyNewActions, prepareActionsForSave } from "../xml";
import { JSDOM } from "jsdom";
import { xmlParseFromString, xmlSerializeToString } from "../xmlSerialize";
import { requireRoleOrThrow } from "../security/withRequireRole";
import { InferType, array, mixed, number, object, string } from "yup";
import { sql } from "kysely";
import { getSingleGndResult } from "./gnd";
import { getSession } from "@auth0/nextjs-auth0";
import logger from "../logger/logger";

if (!globalThis.window) {
  // Hack to make JSDOM window available globally
  // used in xmlSerialize.ts
  (globalThis as any).jsDomWindow = new JSDOM().window;
}

export const getCurrentUserId = async () => {
  const session = await getSession();
  if (!session) return null;
  await requireRoleOrThrow("user");
  return await kdb
    .selectFrom("user")
    .where("user.sub", "=", session?.user.sub)
    .select("id")
    .executeTakeFirst();
};

export const fileOnCurrentCommit = async ({ id }: { id: string }) => {
  await requireRoleOrThrow("user");
  if (!id) throw new Error("ID is required");

  const v = new Versioning();
  return await v.getCurrentVersion("letter", parseInt(id));
};

export const personById = async ({
  id,
  gnd,
  includeGndData,
}: {
  id?: string;
  gnd?: string;
  includeGndData?: boolean;
}) => {
  await requireRoleOrThrow("user");
  if (!id && !gnd) throw new Error("ID or GND is required");
  const p = await kdb
    .selectFrom("person_version")
    .where(whereCurrent)
    .$if(!!id, (e) => e.where("person_version.id", "=", parseInt(id!)))
    .$if(!!gnd, (e) => e.where("gnd", "=", gnd!))
    .selectAll("person_version")
    .leftJoin("person", "person.id", "person_version.id")
    .select("person.computed_link_counts")
    .executeTakeFirst();

  if (!p) {
    return null;
  }

  return {
    ...p,
    gndData: includeGndData
      ? await getSingleGndResult({ id: p.gnd })
      : undefined,
  };
};

const latinPersonExtension = [
  "ae",
  "am",
  "arum",
  "as",
  "is",
  "i",
  "o",
  "orum",
  "um",
  "os",
] // Sort by length descending
  .sort((a, b) => b.length - a.length);

type FilterTableOrderByOption = {
  column: string;
  direction: "asc" | "desc";
};

export type FilterTableOptions = {
  query?: string;
  limit?: number;
  offset?: number;
  orderBy?: FilterTableOrderByOption;
};

export type FilterTableResult<T> = {
  result: T[];
  count: number | undefined;
};

export const searchPerson = async ({
  query = "",
  limit = 50,
  offset = 0,
  orderBy = { column: "computed_link_counts", direction: "desc" },
  includeOnlyCorrespondents = false,
}: FilterTableOptions & {
  includeOnlyCorrespondents?: boolean;
}) => {
  await requireRoleOrThrow("user");
  const keywords = query.split(" ").map((k) => {
    const ext = latinPersonExtension.find((e) => k.endsWith(e));
    // If the keyword ends with a latin extension and has at least 3 characters more than the extension, remove the extension
    if (ext && k.length > ext.length + 2) {
      return k.slice(0, -ext.length);
    }
    return k;
  });

  const baseQuery = kdb
    .selectFrom("person")
    .innerJoin("person_version", "person_version.id", "person.id")
    .where(whereCurrent)
    .$if(includeOnlyCorrespondents, (e) =>
      e.where((e) =>
        e.exists(
          e
            .selectFrom("letter_version_extract_person as corr")
            .where(whereCurrent as any)
            .where("corr.person_id", "=", e.ref("person.id"))
            .where("corr.link_type", "=", "correspondent")
            .selectAll()
        )
      )
    )
    .where((e) =>
      e.or([
        ...(query.match(/^\d+$/) ? [e("person.id", "=", parseInt(query))] : []),
        e.and(
          keywords.map((k) =>
            e.or([
              e("aliases_string", "ilike", `%${k}%`),
              e("forename", "ilike", `%${k}%`),
              e("surname", "ilike", `%${k}%`),
              // Search in text of nodes linked to the person
              e.exists(
                e
                  .selectFrom("letter_version_extract_person as l")
                  .innerJoin(
                    "letter_version as v2",
                    "v2.version_id",
                    "l.version_id"
                  )
                  // Todo: Fix typing
                  .where(whereCurrent as any)
                  .where("l.person_id", "=", e.ref("person.id"))
                  .where((eb) => eb("l.node_text", "ilike", `%${k}%`))
                  .selectAll()
              ),
            ])
          )
        ),
      ])
    );

  const people = await baseQuery
    .limit(limit)
    .offset(offset)
    .selectAll("person_version")
    .select("person.computed_link_counts")
    .orderBy(orderBy.column as any, orderBy.direction)
    .orderBy("person.id")
    .execute();

  const count = await baseQuery
    .select((e) => e.fn.countAll<number>().as("count"))
    .executeTakeFirst();

  return { result: people, count: count?.count } satisfies FilterTableResult<
    (typeof people)[0]
  >;
};

export const searchPlace = async ({
  query = "",
  limit = 50,
  offset = 0,
  orderBy = { column: "computed_link_counts", direction: "desc" },
}: FilterTableOptions) => {
  await requireRoleOrThrow("user");
  const keywords = query.split(" ");
  const baseQuery = kdb
    .selectFrom("place")
    .innerJoin("place_version", "place_version.id", "place.id")
    .where(whereCurrent)
    .where((e) =>
      e.or([
        ...(query.match(/^\d+$/) ? [e("place.id", "=", parseInt(query))] : []),
        e.and(
          keywords.map((k) =>
            e.or([
              e("settlement", "ilike", `%${k}%` as any),
              e("district", "ilike", `%${k}%` as any),
              e("country", "ilike", `%${k}%` as any),
              // Search in text of nodes linked to the place
              e.exists(
                e
                  .selectFrom("letter_version_extract_place as l")
                  .innerJoin(
                    "letter_version as v2",
                    "v2.version_id",
                    "l.version_id"
                  )
                  // Todo: Fix typing
                  .where(whereCurrent as any)
                  .where("l.place_id", "=", e.ref("place.id"))
                  .where("l.node_text", "ilike", `%${k}%` as any)
                  .selectAll()
              ),
            ])
          )
        ),
      ])
    );

  const places = await baseQuery
    .selectAll("place_version")
    .select("place.computed_link_counts")
    .orderBy(orderBy.column as any, orderBy.direction)
    .orderBy("place.id")
    .limit(limit)
    .offset(offset)
    .execute();

  const count = await baseQuery
    .select((e) => e.fn.countAll<number>().as("count"))
    .executeTakeFirst();

  return { result: places, count: count?.count } satisfies FilterTableResult<
    (typeof places)[0]
  >;
};

export const placeById = async ({ id }: { id: string }) => {
  await requireRoleOrThrow("user");
  if (!id) throw new Error("ID is required");
  const p = await kdb
    .selectFrom("place_version")
    .where(whereCurrent)
    .where("place_version.id", "=", parseInt(id))
    .selectAll("place_version")
    .leftJoin("place", "place.id", "place_version.id")
    .select("place.computed_link_counts")
    .executeTakeFirst();
  return p;
};

const anyString = string().ensure();

const updateOrInsertPersonSchema = object({
  id: number().nullable(),
  gnd: string().matches(/\/?[0-9X]{8,11}$/, {
    message: "Ungültige GND ID",
    excludeEmptyString: true,
  }),
  hist_hub: string().matches(/\/?[0-9]{6,12}$/, {
    message: "Ungültige HistHub ID",
    excludeEmptyString: true,
  }),
  wiki: string().matches(/wikipedia\.org\/wiki\/.+/, {
    message: "Ungültiger Wikipedia-Link",
    excludeEmptyString: true,
  }),
  forename: anyString,
  surname: anyString,
  portrait: string(),
  aliases: array()
    .required()
    .of(
      object({
        forename: anyString,
        surname: anyString,
        type: string()
          .matches(/^alias$/)
          .required(),
        id: number().nullable(),
      })
    ),
});

export const insertOrUpdatePerson = async (
  newPerson: InferType<typeof updateOrInsertPersonSchema>
) => {
  await updateOrInsertPersonSchema.validate(newPerson);
  await requireRoleOrThrow("user");

  const result = await kdb.transaction().execute(async (t) => {
    const v = new Versioning(t);
    const logId = await v.createLogId("user");

    if (newPerson.id) {
      await v.createNewVersion(
        "person",
        newPerson.id,
        null,
        {
          gnd: newPerson.gnd,
          hist_hub: newPerson.hist_hub,
          wiki: newPerson.wiki,
          portrait: newPerson.portrait,
          forename: newPerson.forename,
          surname: newPerson.surname,
          aliases: newPerson.aliases,
        },
        false,
        logId,
        false
      );

      return await v.getCurrentVersion("person", newPerson.id);
    } else {
      const personVersion = await v.insertAndCreateNewVersion(
        "person",
        {
          gnd: newPerson.gnd,
          hist_hub: newPerson.hist_hub,
          wiki: newPerson.wiki,
          forename: newPerson.forename,
          surname: newPerson.surname,
          aliases: [],
        },
        logId
      );

      return await v.getCurrentVersion("person", personVersion.id);
    }
  });
  return result;
};

const updateOrInsertPlaceSchema = object({
  id: number().nullable(),
  settlement: string(),
  district: string(),
  country: string(),
  longitude: number().nullable(),
  latitude: number().nullable(),
  geonames: string(),
});

export const insertOrUpdatePlace = async (
  newPlace: InferType<typeof updateOrInsertPlaceSchema>
) => {
  await updateOrInsertPlaceSchema.validate(newPlace);
  await requireRoleOrThrow("user");

  const result = await kdb.transaction().execute(async (t) => {
    const v = new Versioning(t);
    const logId = await v.createLogId("user");

    if (newPlace.id) {
      await v.createNewVersion(
        "place",
        newPlace.id,
        null,
        {
          settlement: newPlace.settlement,
          district: newPlace.district,
          country: newPlace.country,
          longitude: newPlace.longitude,
          latitude: newPlace.latitude,
          geonames: newPlace.geonames,
        },
        false,
        logId,
        false
      );

      return await v.getCurrentVersion("place", newPlace.id);
    } else {
      const placeVersion = await v.insertAndCreateNewVersion(
        "place",
        {
          settlement: newPlace.settlement || "",
          district: newPlace.district || "",
          country: newPlace.country || "",
          longitude: newPlace.longitude || null,
          latitude: newPlace.latitude || null,
          geonames: newPlace.geonames || "",
        },
        logId
      );

      return await v.getCurrentVersion("place", placeVersion.id);
    }
  });
  return result;
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

  if (newXml !== xml) {
    logger.fatal(
      {
        letterId: id,
        versionId: version_id,
        xmlAfterApplyingActions: newXml,
        xmlBeforeApplyingActions: currentVersion.xml,
        xmlFromClient: xml,
        actions: actions,
      },
      "Error while saving version: XMLs do not match; writing to disk for debugging"
    );
    throw new Error("XML does not match applied actions");
  }

  await v.createNewVersion(
    "letter",
    id,
    version_id,
    {
      xml: newXml,
      actions: prepareActionsForSave(actions),
    },
    false,
    undefined,
    true
  );

  await v.updateComputedLinkCounts({
    letterId: id,
  });
};

export type LetterNavigationFilter = {
  language?: string;
  person_id?: number | null;
  status?: string;
};

export const letterNavigation = async ({
  filter,
  current_letter_id,
}: {
  filter: LetterNavigationFilter;
  current_letter_id: number;
}) => {
  await requireRoleOrThrow("user");

  const result = await kdb
    .with("selection", (e) =>
      e
        .selectFrom("letter_version")
        .where(whereCurrent)
        // Filter out automatic transcriptions
        .where("extract_source", "<>", "keine")
        .$if(!!filter.language, (e) =>
          e.where("extract_language", "=", filter.language!)
        )
        .$if(!!filter.status, (e) =>
          e.where(
            "extract_status",
            filter.status === "finished" ? "=" : "!=",
            "finished"
          )
        )
        .$if(!!filter.person_id, (e) =>
          e.where((eb) =>
            eb.exists(
              eb
                .selectFrom("letter_version_extract_person as p")
                .where("p.version_id", "=", eb.ref("letter_version.version_id"))
                .where("p.person_id", "=", filter.person_id!)
                .where("p.link_type", "=", "correspondent")
            )
          )
        )
        .select(["id", "extract_date"])
    )
    .with("current_letter", (e) =>
      e
        .selectFrom("letter_version")
        .where(whereCurrent)
        .where("id", "=", current_letter_id)
        .select("extract_date as d")
    )
    .selectNoFrom((e) => [
      e
        .selectFrom("selection")
        .select((e) => e.fn.countAll<number>().as("c"))
        .as("count"),
      e
        .selectFrom("selection")
        .where((eb) =>
          eb.or([
            eb(
              "extract_date",
              "<",
              eb.selectFrom("current_letter").select("d")
            ),
            eb.and([
              eb(
                "extract_date",
                "=",
                eb.selectFrom("current_letter").select("d")
              ),
              eb("id", "<", current_letter_id),
            ]),
          ])
        )
        .where("selection.id", "!=", current_letter_id)
        .orderBy(["selection.extract_date desc", "selection.id desc"])
        .limit(1)
        .select("id")
        .as("previous"),
      e
        .selectFrom("selection")
        .where((eb) =>
          eb.or([
            eb(
              "extract_date",
              ">",
              eb.selectFrom("current_letter").select("d")
            ),
            eb.and([
              eb(
                "extract_date",
                "=",
                eb.selectFrom("current_letter").select("d")
              ),
              eb("id", ">", current_letter_id),
            ]),
          ])
        )
        .where("selection.id", "!=", current_letter_id)
        .orderBy(["selection.extract_date asc", "selection.id asc"])
        .limit(1)
        .select("id")
        .as("next"),
      e
        .selectFrom("selection")
        .orderBy(["selection.extract_date asc", "selection.id asc"])
        .limit(1)
        .select("id")
        .as("first"),
      e
        .selectFrom("selection")
        .orderBy(["selection.extract_date desc", "selection.id desc"])
        .limit(1)
        .select("id")
        .as("last"),
      e
        .selectFrom("selection")
        .orderBy((e) => sql`random()`)
        .$if(!!current_letter_id, (e) =>
          e.where("selection.id", "!=", current_letter_id)
        )
        .limit(1)
        .select("id")
        .as("random"),
    ])
    .executeTakeFirstOrThrow();

  return {
    random: result.random,
    first: result.first,
    previous: result.previous,
    next: result.next,
    last: result.last,
    count: result.count,
  };
};

export const orgNameByRef = async ({ ref }: { ref: string }) => {
  await requireRoleOrThrow("user");
  const orgName = await kdb
    .selectFrom("org_names")
    .where("id", "=", ref)
    .where((eb) =>
      eb("git_import_id", "=", (e: any) =>
        e.selectFrom("git_import").select("id").where("is_current", "is", true)
      )
    )
    .select(["id", "xml"])
    .executeTakeFirst();
  return orgName;
};

export const getPersonUsages = async ({ id }: { id: number }) => {
  await requireRoleOrThrow("user");
  const usages = await kdb
    .selectFrom("letter_version_extract_person")
    .leftJoin(
      "letter_version",
      "letter_version.version_id",
      "letter_version_extract_person.version_id"
    )
    .where(whereCurrent)
    .where("letter_version_extract_person.person_id", "=", id)
    .orderBy("id")
    .select(["id", "cert", "link_type", "node_text", "extract_date_string"])
    .execute();
  return usages;
};

export const getPlaceUsages = async ({ id }: { id: number }) => {
  await requireRoleOrThrow("user");
  const usages = await kdb
    .selectFrom("letter_version_extract_place")
    .leftJoin(
      "letter_version",
      "letter_version.version_id",
      "letter_version_extract_place.version_id"
    )
    .where(whereCurrent)
    .where("letter_version_extract_place.place_id", "=", id)
    .orderBy("id")
    .select([
      "id",
      "cert",
      "link_type",
      "node_text",
      "extract_date",
      "extract_date_string",
    ])
    .execute();
  return usages;
};
