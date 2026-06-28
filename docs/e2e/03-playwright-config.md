# Playwright Config

## Key decisions for real-funds tests

- `workers: 1` — never run two payment flows concurrently.
- `retries: 0` — a retry re-sends funds. Never change this for payment projects.
- `mocked` project excludes `payment-flows/**` — safe for CI without secrets.
- Linear `dependencies` chain keeps the full suite in a predictable order.
- Use `--no-deps` to run one flow in isolation without pulling its chain.

## `e2e/playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test"
import "./env"

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
    // Safe for CI — no secrets needed.
    {
      name: "mocked",
      testIgnore: "**/payment-flows/**",
      use: { ...devices["Desktop Chrome"], headless: false },
      retries: process.env.CI ? 2 : 0,
      timeout: 60_000,
    },

    // Bridge — run order: mocked → evm-to-stellar → stellar-to-evm → stellar-to-solana
    //                     → solana-to-stellar → solana-to-evm → evm-to-solana
    { name: "evm-to-stellar",    testMatch: "**/payment-flows/bridge/evm-to-stellar.spec.ts",    dependencies: ["mocked"],           use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "stellar-to-evm",    testMatch: "**/payment-flows/bridge/stellar-to-evm.spec.ts",    dependencies: ["evm-to-stellar"],    use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "stellar-to-solana", testMatch: "**/payment-flows/bridge/stellar-to-solana.spec.ts", dependencies: ["stellar-to-evm"],    use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "solana-to-stellar", testMatch: "**/payment-flows/bridge/solana-to-stellar.spec.ts", dependencies: ["stellar-to-solana"], use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "solana-to-evm",     testMatch: "**/payment-flows/bridge/solana-to-evm.spec.ts",     dependencies: ["solana-to-stellar"], use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "evm-to-solana",     testMatch: "**/payment-flows/bridge/evm-to-solana.spec.ts",     dependencies: ["solana-to-evm"],     use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },

    // Checkout
    { name: "checkout-evm-to-stellar",    testMatch: "**/payment-flows/checkout/evm-to-stellar.spec.ts",    dependencies: ["evm-to-solana"],              use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "checkout-evm-to-solana",     testMatch: "**/payment-flows/checkout/evm-to-solana.spec.ts",     dependencies: ["checkout-evm-to-stellar"],    use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "checkout-stellar-to-evm",    testMatch: "**/payment-flows/checkout/stellar-to-evm.spec.ts",    dependencies: ["checkout-evm-to-solana"],     use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "checkout-stellar-to-solana", testMatch: "**/payment-flows/checkout/stellar-to-solana.spec.ts", dependencies: ["checkout-stellar-to-evm"],    use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "checkout-solana-to-stellar", testMatch: "**/payment-flows/checkout/solana-to-stellar.spec.ts", dependencies: ["checkout-stellar-to-solana"], use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "checkout-solana-to-evm",     testMatch: "**/payment-flows/checkout/solana-to-evm.spec.ts",     dependencies: ["checkout-solana-to-stellar"], use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },

    // Deposit — minimum 0.1 USDC; amount entered inside the modal
    { name: "deposit-stellar-to-evm",    testMatch: "**/payment-flows/deposit/stellar-to-evm.spec.ts",    dependencies: ["checkout-solana-to-evm"],    use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "deposit-stellar-to-solana", testMatch: "**/payment-flows/deposit/stellar-to-solana.spec.ts", dependencies: ["deposit-stellar-to-evm"],    use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "deposit-evm-to-stellar",    testMatch: "**/payment-flows/deposit/evm-to-stellar.spec.ts",    dependencies: ["deposit-stellar-to-solana"], use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "deposit-evm-to-solana",     testMatch: "**/payment-flows/deposit/evm-to-solana.spec.ts",     dependencies: ["deposit-evm-to-stellar"],    use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "deposit-solana-to-stellar", testMatch: "**/payment-flows/deposit/solana-to-stellar.spec.ts", dependencies: ["deposit-evm-to-solana"],     use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
    { name: "deposit-solana-to-evm",     testMatch: "**/payment-flows/deposit/solana-to-evm.spec.ts",     dependencies: ["deposit-solana-to-stellar"], use: { ...realFundsUse, headless: false }, retries: 0, timeout: 10 * 60_000 },
  ],
})
```

Full run order: `mocked → bridge (6) → checkout (6) → deposit (6)`.

---

## `package.json` scripts

```jsonc
{
  "scripts": {
    "test:e2e":        "playwright test --config e2e/playwright.config.ts",
    "test:e2e:mocked": "playwright test --config e2e/playwright.config.ts --project=mocked",

    "test:e2e:evm-to-stellar":    "playwright test --config e2e/playwright.config.ts --project=evm-to-stellar --no-deps",
    "test:e2e:evm-to-solana":     "playwright test --config e2e/playwright.config.ts --project=evm-to-solana --no-deps",
    "test:e2e:stellar-to-evm":    "playwright test --config e2e/playwright.config.ts --project=stellar-to-evm --no-deps",
    "test:e2e:stellar-to-solana": "playwright test --config e2e/playwright.config.ts --project=stellar-to-solana --no-deps",
    "test:e2e:solana-to-evm":     "playwright test --config e2e/playwright.config.ts --project=solana-to-evm --no-deps",
    "test:e2e:solana-to-stellar": "playwright test --config e2e/playwright.config.ts --project=solana-to-stellar --no-deps",

    "test:e2e:checkout-evm-to-stellar":    "playwright test --config e2e/playwright.config.ts --project=checkout-evm-to-stellar --no-deps",
    "test:e2e:checkout-evm-to-solana":     "playwright test --config e2e/playwright.config.ts --project=checkout-evm-to-solana --no-deps",
    "test:e2e:checkout-stellar-to-evm":    "playwright test --config e2e/playwright.config.ts --project=checkout-stellar-to-evm --no-deps",
    "test:e2e:checkout-stellar-to-solana": "playwright test --config e2e/playwright.config.ts --project=checkout-stellar-to-solana --no-deps",
    "test:e2e:checkout-solana-to-evm":     "playwright test --config e2e/playwright.config.ts --project=checkout-solana-to-evm --no-deps",
    "test:e2e:checkout-solana-to-stellar": "playwright test --config e2e/playwright.config.ts --project=checkout-solana-to-stellar --no-deps",

    "test:e2e:deposit-stellar-to-evm":    "playwright test --config e2e/playwright.config.ts --project=deposit-stellar-to-evm --no-deps",
    "test:e2e:deposit-stellar-to-solana": "playwright test --config e2e/playwright.config.ts --project=deposit-stellar-to-solana --no-deps",
    "test:e2e:deposit-evm-to-stellar":    "playwright test --config e2e/playwright.config.ts --project=deposit-evm-to-stellar --no-deps",
    "test:e2e:deposit-evm-to-solana":     "playwright test --config e2e/playwright.config.ts --project=deposit-evm-to-solana --no-deps",
    "test:e2e:deposit-solana-to-stellar": "playwright test --config e2e/playwright.config.ts --project=deposit-solana-to-stellar --no-deps",
    "test:e2e:deposit-solana-to-evm":     "playwright test --config e2e/playwright.config.ts --project=deposit-solana-to-evm --no-deps",

    "setup-wallets": "chainwright e2e/wallet-setup --wallets metamask phantom -f"
  }
}
```
