export const EXTERNAL_API_USER_AGENT =
  "Bullinger Digital - Citizen Science Kampagne";

export const getYear = (date: string) => {
  // Return only the year from a date string
  return date?.split("-")[0] || "";
};
