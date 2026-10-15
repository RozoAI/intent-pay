#!/usr/bin/env node
/**
 * Release helper for @rozoai/intent-pay.
 *
 * Usage:
 *   node scripts/release.js beta [--dry-run]
 *   node scripts/release.js latest [--dry-run]
 *
 * Prepares version and changelog changes for a release PR. CI publishes after
 * its merged release commit is tagged.
 */

import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(pkgRoot, "../..");
const pkgPath = path.join(pkgRoot, "package.json");
const changelogPath = path.join(repoRoot, "CHANGELOG.md");

const [mode, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");
if (!["beta", "latest"].includes(mode) || flags.some((flag) => flag !== "--dry-run")) {
  console.error("Usage: node scripts/release.js <beta|latest> [--dry-run]");
  process.exit(1);
}

function run(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { stdio: "pipe", encoding: "utf-8", ...opts }).trim();
}

function runInherit(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

function fail(message) {
  throw new Error(`Release preflight failed: ${message}`);
}

function packageVersionExists(packageName, version) {
  try {
    return Boolean(run(`npm view ${packageName}@${version} version --json`));
  } catch (error) {
    const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
    if (/E404|404 Not Found/.test(output)) return false;
    throw error;
  }
}

function currentPublishedGitHead(packageName, version) {
  try {
    return run(`npm view ${packageName}@${version} gitHead`).trim();
  } catch {
    return "";
  }
}

function validateReleaseTarget() {
  run("git fetch origin master --tags", { cwd: repoRoot });

  if (run("git branch --show-current", { cwd: repoRoot }) === "master") {
    fail("prepare releases on a branch and merge them through a pull request");
  }
  if (run("git status --porcelain", { cwd: repoRoot })) {
    fail("working tree must be clean");
  }
  if (
    run("git merge-base origin/master HEAD", { cwd: repoRoot }) !==
    run("git rev-parse origin/master", { cwd: repoRoot })
  ) {
    fail("release branch must include origin/master");
  }
}

function latestStableTag() {
  const stableTags = run('git tag --list "v[0-9]*" --sort=-v:refname', { cwd: repoRoot })
    .split("\n")
    .filter((tag) => tag && !tag.includes("-"));
  return stableTags[0] ?? "";
}

function getChangelogStartRef(packageName, currentVersion) {
  if (currentVersion.includes("-")) return latestStableTag();

  const releaseTag = `v${currentVersion}`;
  try {
    run(`git rev-parse --verify --quiet ${releaseTag}^{commit}`, { cwd: repoRoot });
    return releaseTag;
  } catch {
    // Older releases may not have a matching tag.
  }

  const publishedGitHead = currentPublishedGitHead(packageName, currentVersion);
  if (/^[0-9a-f]{40}$/i.test(publishedGitHead)) {
    try {
      run(`git merge-base --is-ancestor ${publishedGitHead} HEAD`, { cwd: repoRoot });
      return publishedGitHead;
    } catch {
      // Fall through to the latest stable tag if npm's gitHead is unavailable locally.
    }
  }

  return latestStableTag();
}

function addChangelogEntry(nextVersion, startRef) {
  const tmpPath = path.join(repoRoot, ".changelog-entry.tmp.md");
  const fromArg = startRef ? `--from ${startRef}` : "";
  runInherit(
    `npx changelogithub --to HEAD --name "v${nextVersion}" ${fromArg} --emoji --output "${tmpPath}"`,
    { cwd: repoRoot },
  );

  const today = new Date().toISOString().slice(0, 10);
  const body = readFileSync(tmpPath, "utf-8")
    .trimEnd()
    .replace(/\n*##### .*View changes on GitHub.*$/m, "")
    .trimEnd();
  const entry = `## [${nextVersion}] - ${today}\n\n${body}\n\n---\n`;
  rmSync(tmpPath);

  const changelog = readFileSync(changelogPath, "utf-8");
  const lines = changelog.split("\n");
  const insertAt = lines.findIndex((line) => line.startsWith("## ["));
  if (insertAt === -1) {
    writeFileSync(changelogPath, `${changelog.trimEnd()}\n\n${entry}\n`);
  } else {
    lines.splice(insertAt, 0, entry, "");
    writeFileSync(changelogPath, lines.join("\n"));
  }
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const currentVersion = pkg.version;
const betaMatch = currentVersion.match(/^(\d+\.\d+\.\d+)-beta\.(\d+)$/);
const core = betaMatch ? betaMatch[1] : currentVersion;
const betaNum = betaMatch ? Number.parseInt(betaMatch[2], 10) : null;
const [major, minor, patch] = core.split(".").map(Number);
const nextStableVersion = `${major}.${minor}.${patch + 1}`;
const nextVersion =
  mode === "beta"
    ? betaNum === null
      ? `${nextStableVersion}-beta.1`
      : `${core}-beta.${betaNum + 1}`
    : betaNum !== null
      ? core
      : nextStableVersion;

validateReleaseTarget();
if (packageVersionExists(pkg.name, nextVersion)) {
  fail(`${pkg.name}@${nextVersion} already exists on npm`);
}

const changelogStartRef = mode === "latest" ? getChangelogStartRef(pkg.name, currentVersion) : "";
console.log(`Version: ${currentVersion} -> ${nextVersion}`);
console.log(`Changelog start: ${changelogStartRef || "repository start"}`);

if (dryRun) {
  console.log("Dry run passed. No files changed and nothing was published.");
  process.exit(0);
}

runInherit("pnpm --filter @rozoai/intent-pay lint", { cwd: repoRoot });
runInherit("pnpm --filter @rozoai/intent-pay test", { cwd: repoRoot });

pkg.version = nextVersion;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
if (mode === "latest") addChangelogEntry(nextVersion, changelogStartRef);

console.log(`\nPrepared ${pkg.name}@${nextVersion}. Commit these changes, open a release PR, and tag its merged commit to publish from CI.`);
