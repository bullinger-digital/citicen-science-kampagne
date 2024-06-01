"use server";
import "server-only";

const GEONAMES_USERNAME = "bullinger_digital";

export type GeonamesResult = {
  totalResultsCount: number;
  geonames: Geoname[];
};

// We route the geonames requests through the server to avoid leaking the username
export const searchGeonames = async (inputValue: string) => {
  const res = await fetch(
    `http://api.geonames.org/searchJSON?q=${encodeURIComponent(inputValue)}&maxRows=100&lang=de&continentCode=EU&countryBias=CH,DE,AT&username=${GEONAMES_USERNAME}`
  );
  const data = (await res.json()) as GeonamesResult;
  return data.geonames;
};

export type Geoname = {
  timezone: {
    gmtOffset: number;
    timeZoneId: string;
    dstOffset: number;
  };
  bbox: {
    east: number;
    south: number;
    north: number;
    west: number;
    accuracyLevel: number;
  };
  asciiName: string;
  astergdem: number;
  countryId: string;
  fcl: string;
  srtm3: number;
  adminId2: string;
  countryCode: string;
  adminCodes1: {
    ISO3166_2: string;
  };
  adminId1: string;
  lat: string;
  fcode: string;
  continentCode: string;
  adminCode2: string;
  adminCode1: string;
  lng: string;
  geonameId: number;
  toponymName: string;
  population: number;
  wikipediaURL: string;
  adminName5: string;
  adminName4: string;
  adminName3: string;
  alternateNames: {
    name: string;
    lang: string;
    isPreferredName?: boolean;
  }[];
  adminName2: string;
  name: string;
  fclName: string;
  countryName: string;
  fcodeName: string;
  adminName1: string;
};

export const getGeoname = async (geonameId: string) => {
  const res = await fetch(
    `http://api.geonames.org/getJSON?geonameId=${geonameId}&username=${GEONAMES_USERNAME}&lang=de`
  );
  const data = (await res.json()) as Geoname;
  return data;
};
