#!/usr/bin/env node
/**
 * Release helper for @rozoai/intent-pay.
 *
 * Usage:
 *   node scripts/release.js beta [--dry-run] [--push]
 *   node scripts/release.js latest [--dry-run] [--push]
 *
 * Set OTP to publish when npm two-factor auth is enabled. The script forwards
 * it to npm without adding it to command output.
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
const push = flags.includes("--push");
if (
  !["beta", "latest"].includes(mode) ||
  flags.some((flag) => !["--dry-run", "--push"].includes(flag)) ||
  (dryRun && push) ||
  (!dryRun && !push)
) {
  console.error("Usage: node scripts/release.js <beta|latest> [--dry-run|--push]");
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

  if (run("git branch --show-current", { cwd: repoRoot }) !== "master") {
    fail("current branch must be master");
  }
  if (run("git status --porcelain", { cwd: repoRoot })) {
    fail("working tree must be clean");
  }
  if (
    run("git rev-parse HEAD", { cwd: repoRoot }) !==
    run("git rev-parse origin/master", { cwd: repoRoot })
  ) {
    fail("local master must exactly match origin/master");
  }
}

function getChangelogStartRef(packageName, currentVersion) {
  const releaseTag = `v${currentVersion}`;
  try {
    run(`git rev-parse --verify --quiet ${releaseTag}^{commit}`, { cwd: repoRoot });
    return releaseTag;
  } catch {
    // Older releases may not have a matching tag.
  }

  const publishedGitHead = currentPublishedGitHead(packageName, currentVersion);
  if (publishedGitHead) {
    try {
      run(`git merge-base --is-ancestor ${publishedGitHead} HEAD`, { cwd: repoRoot });
      return publishedGitHead;
    } catch {
      // Fall through to the latest stable tag if npm's gitHead is unavailable locally.
    }
  }

  const stableTags = run('git tag --list "v[0-9]*" --sort=-v:refname', { cwd: repoRoot })
    .split("\n")
    .filter((tag) => tag && !tag.includes("-"));
  return stableTags[0] ?? "";
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
const nextVersion =
  mode === "beta"
    ? `${core}-beta.${betaNum === null ? 1 : betaNum + 1}`
    : betaNum !== null
      ? core
      : `${core.split(".").slice(0, 2).join(".")}.${Number(core.split(".")[2]) + 1}`;
const distTag = mode === "beta" ? "beta" : "latest";

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

runInherit(`git add "${pkgPath}"`, { cwd: repoRoot });
if (mode === "latest") runInherit(`git add "${changelogPath}"`, { cwd: repoRoot });
runInherit(`git commit -m "chore(release): v${nextVersion}"`, { cwd: repoRoot });
runInherit(`git tag v${nextVersion}`, { cwd: repoRoot });
runInherit(`git push origin master v${nextVersion}`, { cwd: repoRoot });

// prepublishOnly runs the package build. The pushed release commit becomes npm's
// gitHead. Forward OTP through npm config without adding it to command output.
runInherit(`npm publish --tag ${distTag}`, {
  cwd: pkgRoot,
  env: process.env.OTP ? { ...process.env, npm_config_otp: process.env.OTP } : process.env,
});
runInherit(`npm view ${pkg.name}@${nextVersion} version`, { cwd: repoRoot });

console.log(`\nDone. Published ${pkg.name}@${nextVersion} (tag: ${distTag}).`);
