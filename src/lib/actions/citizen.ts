"use server";
import { kdb } from "@/lib/db";
import { Versioning, whereCurrent } from "../versioning";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { EditorAction, applyNewActions } from "../xml";
import { JSDOM } from "jsdom";
import { xmlParseFromString, xmlSerializeToString } from "../xmlSerialize";
import { requireRoleOrThrow } from "../security/withRequireRole";
import { InferType, object, string } from "yup";

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
  const keywords = query.split(" ");
  const people = await kdb
    .selectFrom("person")
    .innerJoin("person_version", "person_version.id", "person.id")
    .where(whereCurrent)
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
    .limit(10)
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

const updateOrInsertPersonSchema = object({
  gnd: string().matches(/^[0-9]{8,10}$/, {
    message: "Ungültige GND ID",
    excludeEmptyString: true,
  }),
  hist_hub: string().matches(/^[0-9]{8,10}$/, {
    message: "Ungültige HistHub ID",
    excludeEmptyString: true,
  }),
  wiki: string().matches(/wikipedia\.org\/wiki\/.+/, {
    message: "Ungültiger Wikipedia-Link",
    excludeEmptyString: true,
  }),
  forename: string().required(),
  surname: string().required(),
});

export const insertPerson = async (
  newPerson: InferType<typeof updateOrInsertPersonSchema>
) => {
  await updateOrInsertPersonSchema.validate(newPerson);

  await requireRoleOrThrow("user");
  const result = await kdb.transaction().execute(async (t) => {
    const v = new Versioning(t);

    const logId = await v.createLogId("user");
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
        forename: newPerson.forename,
        surname: newPerson.surname,
        person_id: personVersion.id,
        type: "main",
      },
      logId
    );

    return personVersion;
  });
  return result;
};

const updateOrInsertPlaceSchema = object({
  settlement: string(),
  district: string(),
  country: string(),
});

export const insertPlace = async (
  newPlace: InferType<typeof updateOrInsertPlaceSchema>
) => {
  await updateOrInsertPlaceSchema.validate(newPlace);

  await requireRoleOrThrow("user");
  const result = await kdb.transaction().execute(async (t) => {
    const v = new Versioning(t);

    const logId = await v.createLogId("user");
    const placeVersion = await v.insertAndCreateNewVersion(
      "place",
      {
        settlement: newPlace.settlement || "",
        district: newPlace.district || "",
        country: newPlace.country || "",
      },
      logId
    );

    return placeVersion;
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

  // If any of the linked persName and placeName references point to person or places have review_state != accepted, the new version should have review_state = pending
  const linkedPersonIds = getReferencedIds(existingXml, "person");
  const linkedPlaceIds = getReferencedIds(existingXml, "place");

  const allLinkedPersonAccepted =
    linkedPersonIds.length === 0 ||
    (await countUnacceptedReferences(linkedPersonIds, "person")) === "0";
  const allLinkedPlaceAccepted =
    linkedPlaceIds.length === 0 ||
    (await countUnacceptedReferences(linkedPlaceIds, "place")) === "0";

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
    undefined,
    allLinkedPersonAccepted && allLinkedPlaceAccepted
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

const countUnacceptedReferences = async (
  ids: number[],
  table: "person" | "place"
) => {
  return (
    await kdb
      .selectFrom(`${table}_version`)
      .where(whereCurrent)
      .where("id", "in", ids)
      .where("review_state", "!=", "accepted")
      .select((e) => e.fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow()
  ).count;
};
