"use server";
import "server-only";
import { client } from "./meili";
import { kdb } from "@/lib/db";
import { whereCurrent } from "@/lib/versioning";
import { jsonArrayFrom } from "kysely/helpers/postgres";

// This is a test for Meilisearch. It is not used yet in the application.
// One of the problems I could not solve yet is that we need to update the index
// when a reference to a person is added, because the new "implicit alias"
// should also be searchable. If we update a letter with many references to
// persons, we would have to update the index for each of them.

// One approach would be to create a separate index for the implicit aliases
// and search in both indexes. This would require to fetch details for the list of
// ids from the database.
// Because everything requires a primary key in Meilisearch, we would have to
// make sure that the implicit aliases have unique ids.

const indexAllPlaces = async () => {
  await client.index("place").delete();
  await client.createIndex("place", { primaryKey: "id" });

  const places = (
    await kdb
      .selectFrom("place_version")
      .where(whereCurrent)
      .selectAll()
      .execute()
  ).map((p) => {
    return {
      ...p,
      name: [p.settlement, p.district, p.country].filter((x) => x).join(" "),
    };
  });

  console.log("indexing", places.length, "places");

  const taskId = await client.index("place").addDocuments(places);
  await client.index("place").waitForTask(taskId.taskUid);
};

const getAllPersons = async () => {
  return (
    await kdb
      .selectFrom("person_version")
      .where(whereCurrent)
      .select((e) =>
        jsonArrayFrom(
          e
            .selectFrom("person_alias_version")
            .where(whereCurrent)
            .where("person_id", "=", e.ref("person_version.id"))
            .selectAll()
        ).as("aliases")
      )
      .selectAll()
      .execute()
  ).map((p) => {
    const mainAlias = p.aliases.find((a) => a.type === "main");
    return {
      ...p,
      name: [mainAlias?.forename, mainAlias?.surname]
        .filter((x) => x)
        .join(" "),
    };
  });
};

const indexAllPersons = async () => {
  await client.index("person").delete();
  await client.createIndex("person", { primaryKey: "id" });

  const persons = await getAllPersons();

  console.log("indexing", persons.length, "persons");

  const taskId = await client.index("person").addDocuments(persons);
  await client.index("person").waitForTask(taskId.taskUid);
};

export const rebuildIndex = async () => {
  await indexAllPlaces();
  await indexAllPersons();
};

export const searchTest = async ({ query }: { query: string }) => {
  const response = await client
    .index("person")
    .search<
      Awaited<ReturnType<typeof getAllPersons>>[0]
    >(query, { attributesToSearchOn: ["name", "id", "gnd", "aliases.forename", "aliases.surname"] });

  const ids = response.hits.map((h) => h.id);
  const withUsage = await kdb
    .selectFrom("person_version")
    .where(whereCurrent)
    .where("id", "in", ids)
    .select("id")
    .select((e) =>
      e
        .selectFrom("letter_version_extract_person")
        .leftJoin(
          "letter_version",
          "letter_version_extract_person.version_id",
          "letter_version.id"
        )
        .where(whereCurrent)
        .where(
          "letter_version_extract_person.person_id",
          "=",
          e.ref("person_version.id")
        )
        .select((e) => e.fn.countAll<number>().as("usage"))
        .as("usage")
    )
    .execute();

  return {
    ...response,
    hits: response.hits.map((h) => {
      const person = withUsage.find((p) => p.id === h.id);
      return {
        ...h,
        usage: person?.usage,
      };
    }),
  };
};
