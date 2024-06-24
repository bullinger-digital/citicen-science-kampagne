"use server";
import "server-only";

import simpleGit from "simple-git";
import { repoPath } from "../git/common";
import { requireRoleOrThrow } from "../security/withRequireRole";
import { Versioning } from "../versioning";
import { importFromCurrentCommit } from "../git/import";
import { BRANCH_NAME, exportToCurrentCommit } from "../git/export";

export const getGitStatus = async () => {
  await requireRoleOrThrow("data-admin");

  const git = simpleGit(repoPath);
  const s = await git.status();

  return JSON.stringify(s);
};

export const gitCheckoutMainAndPull = async () => {
  await requireRoleOrThrow("data-admin");

  const git = simpleGit(repoPath);
  await git.checkout("main");
  await git.pull();
};

export const updateComputedLinkCounts = async () => {
  await requireRoleOrThrow("data-admin");

  const v = new Versioning();
  await v.updateComputedLinkCounts({});
};

export const runImport = async () => {
  await requireRoleOrThrow("data-admin");
  await importFromCurrentCommit();
};

export const runExport = async () => {
  await exportToCurrentCommit();
  return `https://github.com/bullinger-digital/bullinger-korpus-tei/compare/${BRANCH_NAME}?expand=1`;
};
