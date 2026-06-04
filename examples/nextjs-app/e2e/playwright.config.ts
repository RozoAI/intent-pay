import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "on-failure" }]],
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Run `pnpm dev` in examples/nextjs-app before running tests.
  // In CI, set E2E_START_SERVER=1 to have Playwright start the server automatically.
  webServer: process.env.E2E_START_SERVER
    ? {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: "ignore",
        stderr: "ignore",
      }
    : undefined,
})
