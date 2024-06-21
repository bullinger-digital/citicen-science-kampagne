import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Json = JsonValue;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Comment {
  content: string;
  created_log_id: number;
  deleted_log_id: number | null;
  id: Generated<number>;
  resolved_log_id: number | null;
  target: string;
  updated_log_id: number | null;
}

export interface GitExport {
  base_commit_hash: string;
  created_log_id: number;
  id: Generated<number>;
  updated_log_id: number | null;
  written_at: Timestamp;
}

export interface GitImport {
  created_log_id: number;
  hash: string;
  id: Generated<number>;
  is_current: Generated<boolean>;
}

export interface Letter {
  created_log_id: number;
  id: Generated<number>;
}

export interface LetterLock {
  id: Generated<number>;
  locked_at: Generated<Timestamp>;
  locked_by_id: number;
}

export interface LetterVersion {
  actions: Generated<Json>;
  created_log_id: number;
  deleted_log_id: number | null;
  extract_date: string | null;
  extract_language: string | null;
  extract_source: string | null;
  extract_status: string | null;
  extract_type: string | null;
  git_export_id: number | null;
  git_import_id: number;
  id: number;
  is_latest: Generated<boolean>;
  is_new: Generated<boolean>;
  is_touched: Generated<boolean>;
  review_state: string;
  reviewed_log_id: number | null;
  version_id: Generated<number>;
  xml: string;
}

export interface LetterVersionAction {
  action_id: Generated<number>;
}

export interface LetterVersionExtractPerson {
  cert: string;
  link_type: string;
  node_text: string;
  person_id: number;
  version_id: number;
}

export interface LetterVersionExtractPlace {
  cert: string;
  link_type: string;
  node_text: string;
  place_id: number;
  version_id: number;
}

export interface Log {
  created_by_id: number;
  id: Generated<number>;
  log_type: string;
  timestamp: Generated<Timestamp>;
}

export interface OrgNames {
  created_log_id: number;
  git_import_id: number | null;
  id: string;
  id_int: Generated<number>;
  xml: string;
}

export interface Person {
  computed_link_counts: Generated<number>;
  created_log_id: number;
  id: Generated<number>;
}

export interface PersonCacheGnd {
  ok: boolean;
  result: Json;
  status: number;
  statusText: string;
  timestamp: Generated<Timestamp>;
  url: string;
}

export interface PersonVersion {
  aliases: Json;
  aliases_string: Generated<string | null>;
  created_log_id: number;
  deleted_log_id: number | null;
  forename: string;
  git_export_id: number | null;
  git_import_id: number;
  gnd: string | null;
  hist_hub: string | null;
  id: number;
  is_latest: Generated<boolean>;
  is_new: Generated<boolean>;
  is_touched: Generated<boolean>;
  portrait: string | null;
  review_state: string;
  reviewed_log_id: number | null;
  surname: string;
  version_id: Generated<number>;
  wiki: string | null;
}

export interface Place {
  computed_link_counts: Generated<number>;
  created_log_id: number;
  id: Generated<number>;
}

export interface PlaceVersion {
  country: string;
  created_log_id: number;
  deleted_log_id: number | null;
  district: string;
  geonames: Generated<string>;
  git_export_id: number | null;
  git_import_id: number;
  id: number;
  is_latest: Generated<boolean>;
  is_new: Generated<boolean>;
  is_touched: Generated<boolean>;
  latitude: number | null;
  longitude: number | null;
  review_state: string;
  reviewed_log_id: number | null;
  settlement: string;
  version_id: Generated<number>;
}

export interface RemovedPersonAlias {
  created_log_id: number;
  id: Generated<number>;
}

export interface RemovedPersonAliasVersion {
  created_log_id: number;
  forename: string;
  git_export_id: number | null;
  git_import_id: number;
  id: number;
  is_latest: Generated<boolean>;
  is_new: Generated<boolean>;
  is_touched: Generated<boolean>;
  person_id: number;
  review_state: string;
  reviewed_log_id: number | null;
  surname: string;
  type: string;
  version_id: Generated<number>;
}

export interface User {
  created_at: Generated<Timestamp>;
  email: string;
  id: Generated<number>;
  last_login_at: Timestamp;
  roles: Generated<Json>;
  sub: string;
  updated_at: Generated<Timestamp>;
  user_name: string;
}

export interface DB {
  comment: Comment;
  git_export: GitExport;
  git_import: GitImport;
  letter: Letter;
  letter_lock: LetterLock;
  letter_version: LetterVersion;
  letter_version_action: LetterVersionAction;
  letter_version_extract_person: LetterVersionExtractPerson;
  letter_version_extract_place: LetterVersionExtractPlace;
  log: Log;
  org_names: OrgNames;
  person: Person;
  person_cache_gnd: PersonCacheGnd;
  person_version: PersonVersion;
  place: Place;
  place_version: PlaceVersion;
  removed_person_alias: RemovedPersonAlias;
  removed_person_alias_version: RemovedPersonAliasVersion;
  user: User;
}
