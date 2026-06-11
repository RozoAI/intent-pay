import { existsSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"

// Load real-wallet env vars if present (gitignored — copy from .env.e2e.example).
// Safe to call at the top level; does nothing when the file doesn't exist.
if (existsSync(".env.e2e")) {
  process.loadEnvFile(".env.e2e")
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
    // Headless, fast timeouts. Excludes the real-wallet test which needs a
    // browser extension and real funds.
    {
      name: "mocked",
      testIgnore: "**/payment-flow.spec.ts",
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

    // ── Real-wallet / mainnet suite ───────────────────────────────────────────
    // Headed (extensions don't load headless). Single worker, no retries —
    // real funds, must not double-send. Skipped unless E2E_SEED_PHRASE is set.
    {
      name: "real-wallet",
      testMatch: "**/payment-flow.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.BASE_URL || "http://localhost:3000",
        headless: false,
        actionTimeout: 30_000,
        navigationTimeout: 30_000,
        trace: "on",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
      },
      retries: 0,
      // Generous budget — real cross-chain payout (e.g. to Stellar) can take
      // several minutes to settle after the payin transaction confirms.
      timeout: 10 * 60_000,
    },
  ],
})
