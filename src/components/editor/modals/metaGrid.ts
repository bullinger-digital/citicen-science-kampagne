import { EXTERNAL_API_USER_AGENT, getYear } from "./common";

// Metagrid errors fail if the query contains special characters
// (e.g. brackets, etc.)
const sanitizeQuery = (query: string) => {
  return query.replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, "");
};

export const searchMetagrid = async (inputValue: string) => {
  const res = await fetch(
    `https://api.metagrid.ch/search?group=1&query=${encodeURIComponent(sanitizeQuery(inputValue))}&skip=0&take=30`,
    {
      headers: {
        "User-Agent": EXTERNAL_API_USER_AGENT,
      },
      method: "GET",
    }
  );
  const data = await res.json();
  console.log(data);
  return data.concordances?.map((c: any) => {
    const infoArray = [
      c.name,
      ...c.resources.map((r: any) => Object.values(r.metadata).join(", ")),
    ];

    return {
      value: c.id,
      label: infoArray.join(" | "),
    };
  }) as { value: string; label: string }[];
};

export const singleMetagridResult = (metaGridId: string) =>
  fetch(
    `https://api.metagrid.ch/concordance/${encodeURIComponent(metaGridId)}`,
    {
      headers: {
        "User-Agent": EXTERNAL_API_USER_AGENT,
      },
    }
  ).then((res) => res.json());
