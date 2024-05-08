import { JSDOM } from "jsdom";
import path from "path";

if (!globalThis.window) {
  // Hack to make JSDOM window available globally
  // used in xmlSerialize.ts
  (globalThis as any).jsDomWindow = new JSDOM().window;
}

export const repoPath = path.join(process.cwd(), "tei-corpus");
export const letterPath = path.join(repoPath, "./data/letters");
export const personsFilePath = path.join(repoPath, "./data/index/persons.xml");
export const placesFilePath = path.join(
  repoPath,
  "./data/index/localities.xml"
);
export const orgNamesFilePath = path.join(
  repoPath,
  "./data/index/organizations.xml"
);
