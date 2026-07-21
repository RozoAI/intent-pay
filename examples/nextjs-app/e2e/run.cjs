#!/usr/bin/env node
/**
 * E2E test runner. Single source of truth for all Playwright projects.
 * Replaces the sprawling test:e2e:* npm scripts.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *   node e2e/run.js                  run ALL projects (full suite)
 *   node e2e/run.js [project]        run a single named project (--no-deps)
 *   node e2e/run.js --mocked         run the fast mocked suite only
 *   node e2e/run.js --list           print all registered project names
 *
 *   Extra args after [project] are forwarded to Playwright:
 *     node e2e/run.js bridge-evm-native --headed
 *     node e2e/run.js mocked --grep "Create Payment"
 *
 * ─── Environment ─────────────────────────────────────────────────────────────
 *   SKIP_ENV_VALIDATION=1   skip .env validation (used by --mocked)
 *   E2E_REAL_API=true       hit the live API in the mocked suite
 *
 * ─── Maintenance ─────────────────────────────────────────────────────────────
 * KEEP THIS FILE IN SYNC with e2e/playwright.config.ts.
 * Any time you add, rename, or remove a Playwright project you MUST:
 *   1. Update the PROJECTS array below (preserves --list accuracy and
 *      the unknown-project guard at runtime).
 *   2. Add/update the corresponding project block in playwright.config.ts.
 *   3. If the project is a real-funds flow, add a spec file under
 *      e2e/payment-flows/<mode>/<name>.spec.ts.
 *
 * Project naming convention:
 *   <mode>-<from>-to-<to>           cross-chain  (e.g. bge-evm-to-stellar)
 *   <mode>-<chain>-native           native token (e.g. deposit-solana-native)
 *   <mode>-<chain>                  stablecoin   (e.g. merchant-solana)
 *   <mode>-deposit-address-<chain>-native  deposit-address flow
 *   mocked                          headless fast suite (no real funds)
 */

// All registered projects — single source of truth.
// Order matches playwright.config.ts dependency chain.
const PROJECTS = [
  "mocked",
  // bridge
  "evm-to-stellar",
  "stellar-to-evm",
  "stellar-to-solana",
  "solana-to-stellar",
  "solana-to-evm",
  "evm-to-solana",
  "bridge-evm-native",
  "bridge-solana-native",
  "bridge-stellar-native",
  // checkout
  "checkout-evm-to-stellar",
  "checkout-evm-to-solana",
  "checkout-stellar-to-evm",
  "checkout-stellar-to-solana",
  "checkout-solana-to-stellar",
  "checkout-solana-to-evm",
  "checkout-evm-native",
  "checkout-solana-native",
  "checkout-stellar-native",
  // merchant
  "merchant-evm",
  "merchant-solana",
  "merchant-stellar",
  "merchant-evm-native",
  "merchant-solana-native",
  "merchant-stellar-native",
  "merchant-polygon-native",
  // pay-to-address (merchant)
  "merchant-evm-pay-to-address",
  "merchant-evm-native-pay-to-address",
  "merchant-solana-pay-to-address",
  // deposit
  "deposit-stellar-to-evm",
  "deposit-stellar-to-solana",
  "deposit-evm-to-stellar",
  "deposit-evm-to-solana",
  "deposit-solana-to-stellar",
  "deposit-solana-to-evm",
  "deposit-evm-native",
  "deposit-solana-native",
  "deposit-stellar-native",
]

const { execSync } = require("child_process")
const args = process.argv.slice(2).filter((a) => a !== "--")

if (args.includes("--list")) {
  console.log(PROJECTS.join("\n"))
  process.exit(0)
}

const base =
  "node_modules/.bin/playwright test --config e2e/playwright.config.ts"

let cmd
if (args.includes("--mocked")) {
  const rest = args.filter((a) => a !== "--mocked").join(" ")
  cmd = `SKIP_ENV_VALIDATION=1 ${base} --project=mocked ${rest}`
} else if (args.length === 0) {
  cmd = base
} else {
  const [project, ...rest] = args
  if (!PROJECTS.includes(project)) {
    console.error(
      `Unknown project: "${project}"\nRun with --list to see all projects.`
    )
    process.exit(1)
  }
  cmd = `${base} --project=${project} --no-deps ${rest.join(" ")}`
}

console.log(`\n$ ${cmd}\n`)
try {
  execSync(cmd.trim(), { stdio: "inherit" })
} catch (err) {
  process.exit(err.status ?? 1)
}
