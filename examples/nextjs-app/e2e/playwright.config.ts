import { defineConfig, devices } from "@playwright/test"
// Importing env loads .env.e2e + .env.local as a side effect (see e2e/env.ts).
import "./env"

// Shared `use` defaults for the real-funds payment-flow projects.
const realFundsUse = {
  ...devices["Desktop Chrome"],
  baseURL: process.env.BASE_URL || "http://localhost:3000",
  actionTimeout: 30_000,
  navigationTimeout: 30_000,
  trace: "on" as const,
  screenshot: "only-on-failure" as const,
  video: "retain-on-failure" as const,
}

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "on-failure" }]],

  // Run `pnpm dev` before running tests, or set E2E_START_SERVER=1 in CI.
  webServer: process.env.E2E_START_SERVER
    ? {
        command: "pnpm dev",
        url: process.env.BASE_URL || "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: "ignore",
        stderr: "ignore",
      }
    : undefined,

  projects: [
    // ── Mocked suite ──────────────────────────────────────────────────────────
    // Headless, fast. Excludes every real-funds flow under payment-flows/.
    {
      name: "mocked",
      testIgnore: "**/payment-flows/**",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.BASE_URL || "http://localhost:3000",
        headless: true,
        actionTimeout: 10_000,
        navigationTimeout: 15_000,
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
      },
      retries: process.env.CI ? 2 : 0,
      timeout: 60_000,
    },

    // ── EVM → Stellar (real funds) ────────────────────────────────────────────
    // Headed — the MetaMask extension can't load headless. Skipped unless
    // E2E_EVM_SEED_PHRASE is set. Depends on `mocked` so the fast mocked suite
    // always runs first.
    {
      name: "evm-to-stellar",
      testMatch: "**/payment-flows/bridge/evm-to-stellar.spec.ts",
      dependencies: ["mocked"],
      use: { ...realFundsUse, headless: false },
      retries: 0,
      timeout: 10 * 60_000,
    },

    // ── Stellar → EVM (real funds) ────────────────────────────────────────────
    // Headless is fine — no extension; the app injects a headless signer.
    // Skipped unless a Stellar secret is set. Depends on evm-to-stellar, which in
    // turn depends on mocked — giving the order mocked → evm-to-stellar →
    // stellar-to-evm whenever this project is selected.
    {
      name: "stellar-to-evm",
      testMatch: "**/payment-flows/bridge/stellar-to-evm.spec.ts",
      dependencies: ["evm-to-stellar"],
      use: { ...realFundsUse, headless: true },
      retries: 0,
      timeout: 10 * 60_000,
    },

    // ── Stellar → Solana (real funds) ─────────────────────────────────────────
    // Headless — source is the in-page Stellar signer; Solana is the destination
    // only (no Solana signer needed). Skipped unless a Stellar secret is set.
    // Extends the chain: … → stellar-to-evm → stellar-to-solana.
    {
      name: "stellar-to-solana",
      testMatch: "**/payment-flows/bridge/stellar-to-solana.spec.ts",
      dependencies: ["stellar-to-evm"],
      use: { ...realFundsUse, headless: true },
      retries: 0,
      timeout: 10 * 60_000,
    },

    // ── Solana → Stellar (real funds) ─────────────────────────────────────────
    // Headed — the Phantom extension can't load headless. Source is Solana via
    // Phantom (chainwright); destination is our Stellar address. Skipped unless
    // E2E_SOLANA_SECRET is set. Extends the chain: … → stellar-to-solana →
    // solana-to-stellar.
    {
      name: "solana-to-stellar",
      testMatch: "**/payment-flows/bridge/solana-to-stellar.spec.ts",
      dependencies: ["stellar-to-solana"],
      use: { ...realFundsUse, headless: false },
      retries: 0,
      timeout: 10 * 60_000,
    },

    // ── Solana → EVM (real funds) ─────────────────────────────────────────────
    // Headed — the Phantom extension can't load headless. Source is Solana via
    // Phantom (chainwright); destination is our EVM (Base) address. Skipped
    // unless E2E_SOLANA_SEED_PHRASE is set. Extends the chain: … →
    // solana-to-stellar → solana-to-evm.
    {
      name: "solana-to-evm",
      testMatch: "**/payment-flows/bridge/solana-to-evm.spec.ts",
      dependencies: ["solana-to-stellar"],
      use: { ...realFundsUse, headless: false },
      retries: 0,
      timeout: 10 * 60_000,
    },

    // ── Checkout (payId): EVM → Stellar (real funds) ──────────────────────────
    // Same money movement as evm-to-stellar, but via Checkout mode (the order is
    // created server-side with createPayment(), then paid against its payId).
    // Headed — the MetaMask extension can't load headless. Skipped unless
    // E2E_EVM_SEED_PHRASE is set. Depends on `mocked` so the fast mocked suite
    // always runs first.
    {
      name: "checkout-evm-to-stellar",
      testMatch: "**/payment-flows/checkout/evm-to-stellar.spec.ts",
      dependencies: ["solana-to-evm"],
      use: { ...realFundsUse, headless: false },
      retries: 0,
      timeout: 10 * 60_000,
    },

    // ── Deposit: Stellar → EVM (real funds) ───────────────────────────────────
    // Same money movement as stellar-to-evm, but via Deposit mode (no upfront
    // amount — it's entered inside the modal during pay-in). Headless is fine —
    // no extension; the app injects a headless signer. Skipped unless a Stellar
    // secret is set.
    {
      name: "deposit-stellar-to-evm",
      testMatch: "**/payment-flows/deposit/stellar-to-evm.spec.ts",
      dependencies: ["checkout-evm-to-stellar"],
      use: { ...realFundsUse, headless: true },
      retries: 0,
      timeout: 10 * 60_000,
    },
  ],
})
