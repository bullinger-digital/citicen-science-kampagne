import { EXTERNAL_API_USER_AGENT, getYear } from "./common";

export const searchHistHub = async (inputValue: string) => {
  const res = await fetch(`https://data.histhub.ch/api/search/person/`, {
    headers: {
      "User-Agent": EXTERNAL_API_USER_AGENT,
    },
    method: "POST",
    body: JSON.stringify({
      version: 1,
      "names.fullname": inputValue,
    }),
  });
  const data = await res.json();
  console.log(data);
  return data.map((m: any) => {
    const infoArray = [
      m.label_name,
      m.titles?.map((t: any) => t?.term?.labels?.deu).join(", "),
      m.occupations?.map((a: any) => a?.term?.labels?.deu).join(", "),
      getYear(m.existences?.[0]?.start?.date) +
        "-" +
        getYear(m.existences?.[0]?.end?.date),
    ].filter((i) => !!i);

    return {
      value: "https://data.histhub.ch/person/" + m.hhb_id,
      label: infoArray.join(" | "),
    };
  }) as { value: string; label: string }[];
};

export const singleHistHubResult = (histHubId: string) =>
  fetch(`https://data.histhub.ch/api/person/${encodeURIComponent(histHubId)}`, {
    headers: {
      "User-Agent": EXTERNAL_API_USER_AGENT,
    },
  }).then((res) => res.json());
