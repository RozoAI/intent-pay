/**
 * Playwright globalSetup — validates required E2E env vars before any test
 * starts.
 *
 * The mocked project (CI, no real funds) is exempt: set
 * SKIP_ENV_VALIDATION=1 to bypass this check when only running the mocked suite.
 *
 * Required vars for real-funds flows:
 *   EVM source / destination
 *     E2E_EVM_SEED_PHRASE   — MetaMask recovery phrase (EVM source flows)
 *     E2E_EVM_ADDRESS       — destination address for EVM payout flows
 *   Stellar source / destination
 *     E2E_STELLAR_SECRET    — Stellar secret key (Stellar source flows)
 *     E2E_STELLAR_ADDRESS   — destination address for Stellar payout flows
 *   Solana source / destination
 *     E2E_SOLANA_SEED_PHRASE — Phantom recovery phrase (Solana source flows)
 *     E2E_SOLANA_ADDRESS    — destination address for Solana payout flows
 */

import { existsSync } from "node:fs"

// Mirror the same env-loading logic used in env.ts so validation sees the same
// values that the tests will see.
for (const file of [".env.e2e", ".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file)
}

const REQUIRED_VARS: Array<{ name: string; description: string }> = [
  {
    name: "E2E_EVM_SEED_PHRASE",
    description: "MetaMask recovery phrase for EVM source flows",
  },
  {
    name: "E2E_EVM_ADDRESS",
    description: "EVM destination address for flows that pay out to EVM",
  },
  {
    name: "E2E_STELLAR_SECRET",
    description: "Stellar secret key for Stellar source flows",
  },
  {
    name: "E2E_STELLAR_ADDRESS",
    description:
      "Stellar destination address for flows that pay out to Stellar",
  },
  {
    name: "E2E_SOLANA_SEED_PHRASE",
    description: "Phantom recovery phrase for Solana source flows",
  },
  {
    name: "E2E_SOLANA_ADDRESS",
    description: "Solana destination address for flows that pay out to Solana",
  },
]

export default function globalSetup() {
  // Allow the mocked-only CI path to skip validation.
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    console.log("[E2E] SKIP_ENV_VALIDATION=1 — skipping env var validation.")
    return
  }

  const missing = REQUIRED_VARS.filter(
    ({ name }) => !process.env[name] || process.env[name]!.trim() === ""
  )

  if (missing.length === 0) return

  const lines = missing
    .map(({ name, description }) => `  • ${name}  — ${description}`)
    .join("\n")

  throw new Error(
    `\n\n❌ E2E environment is not fully configured. The following variables are missing or empty:\n\n${lines}\n\n` +
      `Copy .env.e2e.example to .env.e2e and fill in all values before running E2E tests.\n` +
      `To run only the mocked suite (no real funds), use:\n` +
      `  SKIP_ENV_VALIDATION=1 pnpm test:e2e:mocked\n`
  )
}
