"use server";
import { kdb } from "@/lib/db";
import { Versioning, whereCurrent } from "../versioning";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { EditorAction, applyNewActions } from "../xml";
import { JSDOM } from "jsdom";
import { xmlParseFromString, xmlSerializeToString } from "../xmlSerialize";
import { requireRoleOrThrow } from "../security/withRequireRole";
import { InferType, number, object, string } from "yup";
import { sql } from "kysely";

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

export const searchPerson = async ({
  query,
  includeOnlyCorrespondents = false,
}: {
  query: string;
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

  const people = await kdb
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
              e.exists(
                e
                  .selectFrom("person_alias_version")
                  .where(whereCurrent)
                  .where("person_id", "=", e.ref("person.id"))
                  .where((eb) =>
                    eb.or([
                      eb("forename", "ilike", `%${k}%`),
                      eb("surname", "ilike", `%${k}%`),
                    ])
                  )
                  .selectAll()
              ),
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
    )
    .limit(50)
    .selectAll("person_version")
    .select("person.computed_link_counts")
    .select((e) => [
      jsonArrayFrom(
        e
          .selectFrom("person_alias_version")
          .where(whereCurrent)
          .where("person_alias_version.person_id", "=", e.ref("person.id"))
          .selectAll()
      ).as("aliases"),
    ])
    // Order by the number of letters the person is linked to (descending)
    .orderBy("computed_link_counts", "desc")
    .execute();
  return people;
};

export const searchPlace = async ({ query }: { query: string }) => {
  await requireRoleOrThrow("user");
  const keywords = query.split(" ");
  const places = await kdb
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
    )
    .selectAll("place_version")
    .select("place.computed_link_counts")
    // Order by the number of letters the place is linked to (descending)
    .orderBy("computed_link_counts", "desc")
    .limit(50)
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
  forename: string(),
  surname: string(),
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
        },
        false,
        logId,
        false
      );

      // Editing aliases is currently not supported

      return await v.getCurrentVersion("person", newPerson.id);
    } else {
      const personVersion = await v.insertAndCreateNewVersion(
        "person",
        {
          gnd: newPerson.gnd,
          hist_hub: newPerson.hist_hub,
          wiki: newPerson.wiki,
        },
        logId
      );

      await v.insertAndCreateNewVersion(
        "person_alias",
        {
          forename: newPerson.forename || "",
          surname: newPerson.surname || "",
          person_id: personVersion.id,
          type: "main",
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

  // Debug: Write both XMLs to disk
  // fs.writeFileSync(path.join(process.cwd(), "./debug", "new.xml"), newXml);
  // fs.writeFileSync(path.join(process.cwd(), "./debug", "existing.xml"), xml);

  if (newXml !== xml) throw new Error("XML does not match applied actions");

  await v.createNewVersion(
    "letter",
    id,
    version_id,
    {
      xml: newXml,
      actions: actions.map((a) => {
        return { ...a, dom: undefined };
      }),
    },
    false,
    undefined,
    true
  );

  await v.updateComputedLinkCounts({
    letterId: id,
  });
};

const getReferencedIds = (xmlDom: Document, type: "person" | "place") => {
  const refPrefix = type === "person" ? "p" : "l";
  const elementName = type === "person" ? "persName" : "placeName";
  return Array.from(xmlDom.querySelectorAll(`${elementName}[ref]`)).map((n) =>
    parseInt(n.getAttribute("ref")?.replace(refPrefix, "")!)
  );
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
        .where((e) =>
          e.or([
            e("extract_source", "like", "HBBW-%"),
            e("extract_source", "like", "TUSTEP-%"),
          ])
        )
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

// We decided not to import orgNames into the database, therefore we read them directly from the file system
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
