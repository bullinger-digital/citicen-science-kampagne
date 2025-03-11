"use server";
import "server-only";

import { EXTERNAL_API_USER_AGENT } from "@/components/editor/modals/common";
import { kdb } from "../db";
import { isValidGndIdentifier } from "@/components/editor/modals/gnd";
import { requireRoleOrThrow } from "../security/withRequireRole";

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

// This is the type of the result of the GND API - all fields are optional
export type GndResult = DeepPartial<{
  exactMatch: Array<{
    id: string;
    label: string;
  }>;
  hasSpouse: Array<{
    id: string;
    label: string;
  }>;
  gender: Array<{
    id: string;
    label: string;
  }>;
  relatedWork: Array<{
    id: string;
    label: string;
  }>;
  dateOfDeath: Array<string>;
  placeOfDeath: Array<{
    id: string;
    label: string;
  }>;
  familialRelationship: Array<{
    id: string;
    label: string;
  }>;
  type: Array<string>;
  gndSubjectCategory: Array<{
    id: string;
    label: string;
  }>;
  oldAuthorityNumber: Array<string>;
  geographicAreaCode: Array<{
    id: string;
    label: string;
  }>;
  usingInstructions: Array<string>;
  biographicalOrHistoricalInformation: Array<string>;
  hasAuntUncle: Array<{
    id: string;
    label: string;
  }>;
  describedBy: {
    id: string;
    license: {
      id: string;
      label: string;
    };
    dateModified: string;
    descriptionLevel: {
      id: string;
      label: string;
    };
  };
  gndIdentifier: string;
  id: string;
  placeOfActivity: Array<{
    id: string;
    label: string;
  }>;
  preferredName: string;
  wikipedia: Array<{
    id: string;
    label: string;
  }>;
  hasSibling: Array<{
    id: string;
    label: string;
  }>;
  preferredNameEntityForThePerson: {
    forename: Array<string>;
    prefix: Array<string>;
    surname: Array<string>;
  };
  depiction: Array<{
    id: string;
    url: string;
    thumbnail: string;
  }>;
  professionOrOccupation: Array<{
    id: string;
    label: string;
  }>;
  placeOfBirth: Array<{
    id: string;
    label: string;
  }>;
  dateOfBirth: Array<string>;
  variantNameEntityForThePerson: Array<{
    personalName?: Array<string>;
    forename?: Array<string>;
    surname?: Array<string>;
    prefix?: Array<string>;
  }>;
  languageCode: Array<{
    id: string;
    label: string;
  }>;
  "@context": string;
  hasFriend: Array<{
    id: string;
    label: string;
  }>;
  professionalRelationship: Array<{
    id: string;
    label: string;
  }>;
  deprecatedUri: Array<string>;
  hasChild: Array<{
    id: string;
    label: string;
  }>;
  variantName: Array<string>;
  acquaintanceshipOrFriendship: Array<{
    id: string;
    label: string;
  }>;
  hasParent: Array<{
    id: string;
    label: string;
  }>;
  sameAs: Array<{
    id: string;
    collection: {
      id: string;
      abbr?: string;
      publisher?: string;
      icon?: string;
      name?: string;
    };
  }>;
}>;

export const getSingleGndResult = async ({
  id,
}: {
  id: string | null | undefined;
}): Promise<GndResult | null> => {
  await requireRoleOrThrow("admin");

  try {
    if (!id || typeof id !== "string") {
      return null;
    }

    // Remove gnd url prefix
    id = id.replace("https://d-nb.info/gnd/", "");

    if (!isValidGndIdentifier(id)) {
      return null;
    }

    const url = `https://lobid.org/gnd/${encodeURIComponent(id)}.json`;

    // Query cache first
    const cachedResult = await kdb
      .selectFrom("person_cache_gnd")
      .where("url", "=", url)
      .selectAll()
      .executeTakeFirst();

    if (cachedResult) {
      return cachedResult.ok ? (cachedResult.result as GndResult) : null;
    }

    // Fetch from API
    const result = await fetch(url, {
      headers: {
        "User-Agent": EXTERNAL_API_USER_AGENT,
      },
    });

    const json = await result.json();

    // Cache result
    await kdb
      .insertInto("person_cache_gnd")
      .values({
        url: url,
        ok: result.ok,
        status: result.status,
        statusText: result.statusText,
        result: json,
      })
      .execute();

    if (!result?.ok) {
      return null;
    }

    return json as GndResult;
  } catch (e) {
    console.error(e);
    return null;
  }
};
