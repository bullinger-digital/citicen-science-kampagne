import { EXTERNAL_API_USER_AGENT, getYear } from "./common";

export const searchGnd = async (inputValue: string) => {
  const filter = "type:Person AND dateOfBirth:[-2000 TO 1700]";
  const res = await fetch(
    `https://lobid.org/gnd/search?q=${encodeURIComponent(
      inputValue
    )}&filter=${encodeURIComponent(filter)}&format=json`,
    {
      headers: {
        "User-Agent": EXTERNAL_API_USER_AGENT,
      },
    }
  );
  const data = await res.json();

  return data.member.map((m: any) => {
    const infoArray = [
      m.preferredName,
      m.biographicalOrHistoricalInformation,
      m.professionOrOccupation?.map((o: any) => o.label).join(", "),
      getYear(m.dateOfBirth?.[0]) + " - " + getYear(m.dateOfDeath?.[0]),
      m.placeOfActivity?.map((p: any) => p.label).join(", "),
    ].filter((i) => !!i);

    return {
      value: m.id,
      label: infoArray.join(" | "),
    };
  }) as { value: string; label: string }[];
};

// Source: https://de.wikipedia.org/wiki/Hilfe:GND#Format_der_Personen-GND-Nummern_oder:_%E2%80%9EWas_bedeutet_das_X?%E2%80%9C
// A GND is valid if it is a number with 9 or 10 digits, whereby the last digit is the modulo checksum of the other digits.
// If the modulo is 10, the last digit is X.
export const isValidGndIdentifier = (value: string) => {
  if (!/\d{8,9}[0-9X]$/.test(value)) {
    return false;
  }
  // The checksum is calculated by multiplying each digit with its index and summing up the results modulo 11.
  // I have not found a source for this, but it seems that the index is 1-based for 10-digit GNDs and 2-based for 9-digit GNDs.
  const indexShift = value.length === 10 ? 1 : 2;
  const digits = value.slice(0, -1).split("").map(Number);
  const checksum =
    digits.reduce(
      (sum, digit, index) => sum + digit * (index + indexShift),
      0
    ) % 11;
  return checksum === (value.slice(-1) === "X" ? 10 : Number(value.slice(-1)));
};

export const getSingleGndResult = (id: string) =>
  fetch(`https://lobid.org/gnd/${encodeURIComponent(id)}.json`, {
    headers: {
      "User-Agent": EXTERNAL_API_USER_AGENT,
    },
  }).then((res) => res.json());
