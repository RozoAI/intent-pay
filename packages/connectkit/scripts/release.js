#!/usr/bin/env node
/**
 * Release helper for @rozoai/intent-pay.
 *
 * Usage:
 *   node scripts/release.js beta    # bump beta prerelease, publish with `beta` tag
 *   node scripts/release.js latest  # promote/bump stable version, update CHANGELOG, publish with `latest` tag
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(pkgRoot, "../..");
const pkgPath = path.join(pkgRoot, "package.json");
const changelogPath = path.join(repoRoot, "CHANGELOG.md");

const mode = process.argv[2];
if (mode !== "beta" && mode !== "latest") {
  console.error("Usage: node scripts/release.js <beta|latest>");
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

const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const currentVersion = pkg.version;

// Parse "0.1.27-beta.4" -> { core: "0.1.27", betaNum: 4 }
// Parse "0.1.27" -> { core: "0.1.27", betaNum: null }
const betaMatch = currentVersion.match(/^(\d+\.\d+\.\d+)-beta\.(\d+)$/);
const core = betaMatch ? betaMatch[1] : currentVersion;
const betaNum = betaMatch ? parseInt(betaMatch[2], 10) : null;

let nextVersion;
if (mode === "beta") {
  nextVersion = `${core}-beta.${betaNum === null ? 1 : betaNum + 1}`;
} else {
  // latest: strip beta suffix if present, otherwise bump patch
  if (betaNum !== null) {
    nextVersion = core;
  } else {
    const [major, minor, patch] = core.split(".").map(Number);
    nextVersion = `${major}.${minor}.${patch + 1}`;
  }
}

console.log(`Version: ${currentVersion} -> ${nextVersion}`);

// 1. Bump package.json version
pkg.version = nextVersion;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

// 2. For latest releases, generate a CHANGELOG entry via changelogithub from commits since the last tag
if (mode === "latest") {
  let lastTag = "";
  try {
    lastTag = run("git describe --tags --abbrev=0", { cwd: repoRoot });
  } catch {
    // no tags yet, changelogithub will use the first commit
  }

  const tmpPath = path.join(repoRoot, ".changelog-entry.tmp.md");
  const fromArg = lastTag ? `--from ${lastTag}` : "";
  runInherit(
    `npx changelogithub --to HEAD --name "v${nextVersion}" ${fromArg} --emoji --output "${tmpPath}"`,
    { cwd: repoRoot },
  );

  const entry = `${readFileSync(tmpPath, "utf-8").trimEnd()}\n\n---\n`;
  run(`rm "${tmpPath}"`, { cwd: repoRoot });

  const changelog = readFileSync(changelogPath, "utf-8");
  const lines = changelog.split("\n");
  // Insert after the header block (before the first "## [" entry)
  const insertAt = lines.findIndex((l) => l.startsWith("## ["));
  if (insertAt === -1) {
    writeFileSync(changelogPath, `${changelog.trimEnd()}\n\n${entry}\n`);
  } else {
    lines.splice(insertAt, 0, entry, "");
    writeFileSync(changelogPath, lines.join("\n"));
  }

  console.log(`\nCHANGELOG.md updated via changelogithub. Review before continuing.\n`);
}

// 3. Publish
const distTag = mode === "beta" ? "beta" : "latest";
runInherit(`npm publish --tag ${distTag}`, { cwd: pkgRoot });

// 4. Commit + tag
const filesToAdd = mode === "latest" ? [pkgPath, changelogPath] : [pkgPath];
runInherit(`git add ${filesToAdd.map((f) => `"${f}"`).join(" ")}`, { cwd: repoRoot });
runInherit(`git commit -m "chore(release): v${nextVersion}"`, { cwd: repoRoot });
runInherit(`git tag v${nextVersion}`, { cwd: repoRoot });

console.log(`\nDone. Published ${pkg.name}@${nextVersion} (tag: ${distTag}).`);
console.log(`Run 'git push && git push --tags' to push the release commit and tag.`);
