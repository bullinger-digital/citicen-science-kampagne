import "server-only";

import { MeiliSearch } from "meilisearch";

if (!process.env.MEILI_BASE_URL) {
  throw new Error("MEILI_BASE_URL is not set");
}

if (!process.env.MEILI_MASTER_KEY) {
  throw new Error("MEILI_MASTER_KEY is not set");
}

export const client = new MeiliSearch({
  host: process.env.MEILI_BASE_URL,
  apiKey: process.env.MEILI_MASTER_KEY,
});
