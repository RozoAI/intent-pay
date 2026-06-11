# RozoPay E2E Integration Guide

How to add end-to-end payment tests to any app that embeds the RozoPay SDK
(`@rozoai/intent-pay`), covering **EVM**, **Solana**, and **Stellar** sources
with [Playwright](https://playwright.dev) + [chainwright](https://www.npmjs.com/package/chainwright).

> These tests drive **real wallets on mainnet with real funds**. Use throwaway
> wallets holding only tiny test amounts, and never commit secrets.

See [`TEST_IDS.md`](./TEST_IDS.md) for the full list of stable `data-testid`s the
SDK exposes.

---

## How wallet signing is driven

Each chain uses a different, deliberate strategy. Pick per source chain:

| Source chain                | Strategy                                    | Why                                                                                                  |
| --------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **EVM** (Base, Ethereum, …) | Real **MetaMask** extension via chainwright | The SDK connects EVM wallets through wagmi connectors; chainwright automates the extension popups.   |
| **Solana**                  | Real **Phantom** extension via chainwright  | The SDK auto-detects Solana wallets via the Wallet Standard; Phantom is a real Standard wallet.      |
| **Stellar**                 | **Headless in-page signer** (no extension)  | The SDK accepts an injectable `stellarKit` prop, so a secret-key signer runs in-page with no popups. |

A wallet is **reusable**: it's the *source* in one direction and the
*destination* in the other (e.g. EVM→Stellar uses the EVM wallet as source and a
Stellar address as destination; Stellar→EVM reverses it).

---

## 1. Install

```bash
pnpm add -D @playwright/test@^1.60.0 chainwright@^0.9.12
```

The Stellar headless signer needs `@creit.tech/stellar-wallets-kit` and
`@stellar/stellar-sdk`. **These are peer dependencies of `@rozoai/intent-pay` —
pin them to the versions the SDK declares**, and make sure only **one** copy
resolves in your tree. A second/mismatched copy of `stellar-wallets-kit` throws
`StellarWalletsKit custom element is already registered` at runtime.

```bash
# Match @rozoai/intent-pay's peerDependencies:
pnpm add @creit.tech/stellar-wallets-kit@^1.9.5 @stellar/stellar-sdk@^14.2.0
```

> Confirm the exact ranges against your installed SDK version with
> `pnpm why @creit.tech/stellar-wallets-kit` (and `@stellar/stellar-sdk`). If
> your app already depends on these for its real Stellar integration, reuse that
> same version — don't add a second one.

chainwright downloads the wallet extensions on demand. Supported wallets include
`metamask`, `phantom`, `solflare`, `keplr`, `petra`, `meteor`.

---

## 2. Directory layout

```
your-app/
  e2e/
    env.ts                      # central env loader (single source of truth)
    helpers.ts                  # reusable flow steps (copy from this guide)
    playwright.config.ts
    wallet-setup/
      metamask.setup.ts         # cached MetaMask profile (EVM source)
      phantom.setup.ts          # cached Phantom profile (Solana source)
    payment-flows/
      bridge/
        evm-to-stellar.spec.ts
        stellar-to-evm.spec.ts
        solana-to-stellar.spec.ts
        ...
  lib/
    e2e-stellar-kit.ts          # headless Stellar signer (Stellar source)
    e2e-stellar-constants.ts    # wallet id/name, kit-free (ESM-safe import)
  .env.e2e                      # secrets (gitignored)
  .env.e2e.example              # template (committed)
```

---

## 3. Environment config

Keep **one** typed config module that loads env files the same way everywhere
(Playwright config, wallet setups, and specs all import it).

```ts
// e2e/env.ts
import { existsSync } from "node:fs"

// Load env files once, at import time. Guarded so a missing file is a no-op.
for (const file of [".env.e2e", ".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file)
}

const BASE_USDC_OPTION_ID = "8453-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

export const E2E = {
  amount: process.env.E2E_AMOUNT ?? "0.02",

  // EVM wallet — driven by the MetaMask extension via chainwright.
  evm: {
    seedPhrase: process.env.E2E_EVM_SEED_PHRASE ?? "",
    walletPassword: process.env.E2E_EVM_WALLET_PASSWORD ?? "TempE2ePassword123!",
    address: process.env.E2E_EVM_ADDRESS ?? "",
    // Source token to pay FROM: rozopay-option-{chainId}-{tokenAddress}
    sourceOptionId: process.env.E2E_EVM_SOURCE_OPTION_ID ?? BASE_USDC_OPTION_ID,
  },

  // Stellar wallet — driven by an in-page headless signer (no extension).
  // The SECRET is injected at runtime (never an env var the app reads).
  stellar: {
    secret: process.env.E2E_STELLAR_SECRET ?? "",
    address: process.env.E2E_STELLAR_ADDRESS ?? "",
  },

  // Solana wallet — source via Phantom; destination via its address.
  // Payout chain is rozoSolana (900); pay-in token lives on native Solana (501).
  solana: {
    seedPhrase: process.env.E2E_SOLANA_SEED_PHRASE ?? "",
    walletPassword: process.env.E2E_SOLANA_WALLET_PASSWORD ?? "TempE2ePassword123!",
    address: process.env.E2E_SOLANA_ADDRESS ?? "",
    // rozopay-option-{chainId}-{mint}; default = Solana USDC
    sourceOptionId:
      process.env.E2E_SOLANA_SOURCE_OPTION_ID ??
      "501-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
} as const
```

```dotenv
# .env.e2e.example  (copy to .env.e2e, fill in, NEVER commit .env.e2e)
E2E_AMOUNT=0.02

# EVM (MetaMask)
E2E_EVM_SEED_PHRASE=""
E2E_EVM_WALLET_PASSWORD=""
E2E_EVM_ADDRESS=
# E2E_EVM_SOURCE_OPTION_ID=8453-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Stellar (headless signer — secret injected at runtime, needs funds + USDC trustline)
E2E_STELLAR_SECRET=
E2E_STELLAR_ADDRESS=

# Solana (Phantom)
E2E_SOLANA_SEED_PHRASE=""
E2E_SOLANA_WALLET_PASSWORD=""
E2E_SOLANA_ADDRESS=
# E2E_SOLANA_SOURCE_OPTION_ID=501-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

Add `.env.e2e` to `.gitignore`.

---

## 4. Playwright config

Key choices: `workers: 1` and `retries: 0` for real-funds flows (never
double-send), a fast headless `mocked` project, and a **dependency chain** that
enforces run order. Individual project scripts use `--no-deps` to run in
isolation.

```ts
// e2e/playwright.config.ts
import { defineConfig, devices } from "@playwright/test"
import "./env" // loads .env.e2e / .env.local as a side effect

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
  workers: 1,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "on-failure" }]],

  // Start your app first (`pnpm dev`), or set E2E_START_SERVER=1 in CI.
  webServer: process.env.E2E_START_SERVER
    ? {
        command: "pnpm dev",
        url: process.env.BASE_URL || "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,

  projects: [
    // Fast, headless. Excludes every real-funds flow.
    {
      name: "mocked",
      testIgnore: "**/payment-flows/**",
      use: { ...devices["Desktop Chrome"], headless: true },
      retries: process.env.CI ? 2 : 0,
      timeout: 60_000,
    },

    // EVM source → headed (MetaMask can't load headless). Runs after mocked.
    {
      name: "evm-to-stellar",
      testMatch: "**/payment-flows/bridge/evm-to-stellar.spec.ts",
      dependencies: ["mocked"],
      use: { ...realFundsUse, headless: false },
      retries: 0,
      timeout: 10 * 60_000,
    },

    // Stellar source → headless OK (in-page signer, no extension).
    {
      name: "stellar-to-evm",
      testMatch: "**/payment-flows/bridge/stellar-to-evm.spec.ts",
      dependencies: ["evm-to-stellar"],
      use: { ...realFundsUse, headless: true },
      retries: 0,
      timeout: 10 * 60_000,
    },

    // Solana source → headed (Phantom can't load headless).
    {
      name: "solana-to-stellar",
      testMatch: "**/payment-flows/bridge/solana-to-stellar.spec.ts",
      dependencies: ["stellar-to-evm"],
      use: { ...realFundsUse, headless: false },
      retries: 0,
      timeout: 10 * 60_000,
    },
  ],
})
```

**Ordering:** a project's `dependencies` always run first. Running the whole
suite gives `mocked → evm-to-stellar → stellar-to-evm → solana-to-stellar`.
Running `--project=stellar-to-evm` pulls its dependency chain too — add
`--no-deps` to run just one flow in isolation.

### Scripts

```jsonc
// package.json
{
  "scripts": {
    "test:e2e": "playwright test --config e2e/playwright.config.ts",
    "test:e2e:mocked": "playwright test --config e2e/playwright.config.ts --project=mocked",
    "test:e2e:evm-to-stellar": "playwright test --config e2e/playwright.config.ts --project=evm-to-stellar --no-deps",
    "test:e2e:stellar-to-evm": "playwright test --config e2e/playwright.config.ts --project=stellar-to-evm --no-deps",
    "test:e2e:solana-to-stellar": "playwright test --config e2e/playwright.config.ts --project=solana-to-stellar --no-deps",
    // Builds the cached extension profiles for EVM + Solana sources:
    "setup-wallets": "chainwright e2e/wallet-setup --wallets metamask phantom -f"
  }
}
```

---

## 5. EVM source — MetaMask via chainwright

### Wallet setup (one-time cached profile)

```ts
// e2e/wallet-setup/metamask.setup.ts
import { defineWalletSetup } from "chainwright/core"
import { Metamask } from "chainwright/metamask"
import { E2E } from "../env"

export default defineWalletSetup(
  E2E.evm.walletPassword,
  async ({ walletPage }) => {
    const metamask = new Metamask(walletPage)
    await metamask.onboard({
      mode: "import",
      secretRecoveryPhrase: E2E.evm.seedPhrase,
      mainAccountName: "Account 1",
    })
  },
  { slowMo: 2000 }
)
```

Build it once with `pnpm setup-wallets` (re-run after changing the seed phrase).

### Spec

```ts
// e2e/payment-flows/bridge/evm-to-stellar.spec.ts
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { E2E } from "../../env"
import { payInWithMetaMask, startBridgePayment, waitForPayoutCompleted } from "../../helpers"

const test = testWithChainwright(metamaskFixture())

test.describe("Bridge: EVM USDC → Stellar (mainnet, real funds)", () => {
  test.skip(!E2E.evm.seedPhrase, "E2E_EVM_SEED_PHRASE not set")

  test("send USDC from EVM to Stellar", async ({ page, metamask }) => {
    await metamask.unlock() // cached profile starts locked
    await startBridgePayment(page, {
      destChain: "Stellar",
      destToken: "USDC",
      address: E2E.stellar.address,
      amount: E2E.amount,
    })
    await payInWithMetaMask(page, metamask, { sourceOptionId: E2E.evm.sourceOptionId })
    await waitForPayoutCompleted(page)
  })
})
```

---

## 6. Solana source — Phantom via chainwright

### Wallet setup

```ts
// e2e/wallet-setup/phantom.setup.ts
import { defineWalletSetup } from "chainwright/core"
import { Phantom } from "chainwright/phantom"
import { E2E } from "../env"

export default defineWalletSetup(
  E2E.solana.walletPassword,
  async ({ walletPage }) => {
    const phantom = new Phantom(walletPage)
    await phantom.onboard({
      mode: "recovery phrase",
      secretRecoveryPhrase: E2E.solana.seedPhrase,
      accountName: "Account 1",
      toggleNetworkMode: { mode: "off" }, // testnet off → Solana mainnet (idempotent)
    })
  },
  { slowMo: 2000 }
)
```

### Spec

```ts
// e2e/payment-flows/bridge/solana-to-stellar.spec.ts
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import {
  payInWithPhantom,
  startBridgePayment,
  unlockPhantomIfNeeded,
  waitForPayoutCompleted,
} from "../../helpers"

const test = testWithChainwright(phantomFixture())

test.describe("Bridge: Solana USDC → Stellar (mainnet, real funds)", () => {
  test.skip(!E2E.solana.seedPhrase, "E2E_SOLANA_SEED_PHRASE not set")

  test("send USDC from Solana to Stellar", async ({ page, phantom, phantomPage }) => {
    await unlockPhantomIfNeeded(phantom, phantomPage) // Phantom often starts UNLOCKED
    await startBridgePayment(page, {
      destChain: "Solana", // or any destination; Solana shown here is illustrative
      destToken: "USDC",
      address: E2E.stellar.address,
      amount: E2E.amount,
    })
    await payInWithPhantom(page, phantom, { sourceOptionId: E2E.solana.sourceOptionId })
    await waitForPayoutCompleted(page)
  })
})
```

> Phantom is multi-chain, so the SDK may show an "Ethereum / Solana" chain
> picker after you pick the wallet — but only when both chains are offered. The
> helper clicks "Solana" best-effort and skips it when absent.

---

## 7. Stellar source — headless in-page signer (no extension)

Stellar is special: the SDK accepts an injectable `stellarKit` prop, so instead
of automating an extension we build a kit backed by a secret key and run it
in-page. The secret is injected **at runtime by Playwright** — never read from
an env var by the app — so the headless kit can only ever exist in tests.

### 7a. Constants (kit-free, ESM-safe)

Keep the wallet id/name in their own file so specs can import the name without
pulling in `@creit.tech/stellar-wallets-kit` (which transitively loads
`@stellar/freighter-api` and breaks under the test runner's ESM loader).

```ts
// lib/e2e-stellar-constants.ts
export const E2E_STELLAR_WALLET_ID = "e2e-headless"
export const E2E_STELLAR_WALLET_NAME = "E2E Headless Signer"
```

### 7b. The headless kit

```ts
// lib/e2e-stellar-kit.ts
import {
  ModuleType,
  StellarWalletsKit,
  WalletNetwork,
  type ModuleInterface,
} from "@creit.tech/stellar-wallets-kit"
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk"
import { E2E_STELLAR_WALLET_ID, E2E_STELLAR_WALLET_NAME } from "./e2e-stellar-constants"

class HeadlessSecretKeyModule implements ModuleInterface {
  moduleType = ModuleType.HOT_WALLET
  productId = E2E_STELLAR_WALLET_ID
  productName = E2E_STELLAR_WALLET_NAME
  productUrl = "https://rozo.ai"
  productIcon = "https://rozo.ai/rozo-logo.png"
  private readonly keypair: Keypair

  constructor(secret: string) {
    this.keypair = Keypair.fromSecret(secret)
  }
  async isAvailable() { return true }
  async getAddress() { return { address: this.keypair.publicKey() } }
  async signTransaction(xdr: string, opts?: { networkPassphrase?: string }) {
    const tx = TransactionBuilder.fromXDR(xdr, opts?.networkPassphrase ?? Networks.PUBLIC)
    tx.sign(this.keypair)
    return { signedTxXdr: tx.toXDR(), signerAddress: this.keypair.publicKey() }
  }
  async signAuthEntry() { throw new Error("not supported by E2E headless signer") }
  async signMessage() { throw new Error("not supported by E2E headless signer") }
  async getNetwork() { return { network: "PUBLIC", networkPassphrase: Networks.PUBLIC } }
}

// Singleton — the kit registers a custom element, construct once per page.
let cachedKit: StellarWalletsKit | undefined
export function createHeadlessStellarKit(secret: string): StellarWalletsKit {
  if (cachedKit) return cachedKit
  cachedKit = new StellarWalletsKit({
    network: WalletNetwork.PUBLIC,
    selectedWalletId: E2E_STELLAR_WALLET_ID,
    modules: [new HeadlessSecretKeyModule(secret)],
  })
  return cachedKit
}
```

### 7c. Wire it into your provider (E2E-only)

In the state initializer that creates the SDK provider, build the kit **only**
from the runtime-injected window var, and pass it as `stellarKit`:

```tsx
// app/providers.tsx (or wherever you render <RozoPayProvider />)
const [stellarKit] = useState<StellarWalletsKit | undefined>(() => {
  if (typeof window === "undefined") return undefined
  const secret = (window as Window & { __E2E_STELLAR_SECRET__?: string })
    .__E2E_STELLAR_SECRET__
  if (!secret) return undefined
  try {
    return createHeadlessStellarKit(secret)
  } catch (err) {
    console.error("[E2E] Failed to create headless Stellar kit:", err)
    return undefined
  }
})

// ...
<RozoPayProvider stellarKit={stellarKit} /* ...other props */>{children}</RozoPayProvider>
```

Because there is no env-var path, the headless kit can never activate in
production — its presence *is* E2E test mode.

### 7d. Spec

```ts
// e2e/payment-flows/bridge/stellar-to-evm.spec.ts
import { test } from "@playwright/test"
import { E2E } from "../../env"
import {
  payInWithStellarHeadless,
  startBridgePayment,
  useStellarSigner,
  waitForPayoutCompleted,
} from "../../helpers"

test.describe("Bridge: Stellar USDC → EVM (mainnet, real funds)", () => {
  test.skip(!E2E.stellar.secret, "E2E_STELLAR_SECRET not set")

  test("send USDC from Stellar to EVM", async ({ page }) => {
    await useStellarSigner(page, E2E.stellar.secret) // MUST run before navigation
    await startBridgePayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address,
      amount: E2E.amount,
    })
    await payInWithStellarHeadless(page)
    await waitForPayoutCompleted(page)
  })
})
```

---

## 8. Payment-flow helpers (`e2e/helpers.ts`)

The reusable part of these tests is **everything from the SDK modal onward** —
it's identical across apps because it's driven by the SDK's stable test IDs. The
part that *gets you to the modal* (navigating, filling your config/checkout
form, clicking your own pay button) is **app-specific** — keep it in your own
helper and finish it once the modal is open.

### 8a. Reaching the modal (app-specific — adapt to your UI)

This is only an illustrative shape. Your app's form, routes, and button labels
differ — the **only contract** is: end with the SDK modal open
(`rozopay-modal` visible). For Stellar-source flows, also call
`useStellarSigner(page, secret)` *before* you navigate.

```ts
import { type Page, expect } from "@playwright/test"

async function fillYourConfigForm(
  page: Page,
  opts: { destChain: string; destToken: string; address: string; amount?: string }
) {
  // ...drive YOUR config UI here (chain/token selects, address + amount inputs)...
}

/** End state: the SDK modal is open on the payment-method screen. */
export async function startBridgePayment(
  page: Page,
  opts: { destChain: string; destToken: string; address: string; amount: string }
) {
  await page.goto("/bridge")
  await fillYourConfigForm(page, opts)
  await page.getByRole("button", { name: /confirm/i }).click()
  await page.getByRole("button", { name: /pay now/i }).click()
  await expect(page.getByTestId("rozopay-modal")).toBeVisible({ timeout: 10_000 })
}
```

### 8b. Pay-in + completion (reusable — copy verbatim)

These only touch the SDK modal (via test IDs) and the wallet extensions, so they
work unchanged in any app. They assume the modal is already open — except
`useStellarSigner` (runs before navigation) and `unlockPhantomIfNeeded`
(wallet-level).

```ts
import { type Locator, type Page, expect } from "@playwright/test"
import type { Metamask } from "chainwright/metamask"
import type { Phantom } from "chainwright/phantom"
import { E2E_STELLAR_WALLET_NAME } from "../lib/e2e-stellar-constants"

/** Click a locator only if it appears within `timeout`. For optional UI branches. */
async function clickIfVisible(locator: Locator, timeout = 5_000) {
  try {
    await locator.click({ timeout })
  } catch {
    /* optional step — element didn't appear */
  }
}

// ─── Pay-in: EVM (MetaMask) ───────────────────────────────────────────────────

export async function payInWithMetaMask(
  page: Page,
  metamask: Metamask,
  opts: { sourceOptionId: string }
) {
  await page.getByRole("button", { name: /pay with wallet/i }).click()
  await page.getByRole("button", { name: /metamask/i }).click()
  // Chain picker only shows when both EVM + Solana are offered — best-effort.
  await clickIfVisible(page.getByRole("button", { name: /ethereum/i }))

  try {
    await metamask.connectToApp()
  } catch (err) {
    // Benign "target closed" when MetaMask auto-closes the popup after Connect.
    if (!/closed/i.test(err instanceof Error ? err.message : String(err))) throw err
  }

  const sourceOption = page.getByTestId(`rozopay-option-${opts.sourceOptionId}`)
  await expect(sourceOption).toBeVisible({ timeout: 120_000 })
  await expect(sourceOption).toBeEnabled({ timeout: 10_000 })
  await sourceOption.click()

  await metamask.confirmTransaction()
}

// ─── Pay-in: Solana (Phantom) ─────────────────────────────────────────────────

/** Phantom's cached profile often starts UNLOCKED; only unlock if locked. */
export async function unlockPhantomIfNeeded(phantom: Phantom, phantomPage: Page) {
  const locked = await phantomPage.locator("input[name='password']").isVisible()
  if (locked) await phantom.unlock()
}

export async function payInWithPhantom(
  page: Page,
  phantom: Phantom,
  opts: { sourceOptionId: string }
) {
  await page.getByRole("button", { name: /pay with wallet/i }).click()
  await page.getByRole("button", { name: /phantom/i }).click()
  await clickIfVisible(page.getByRole("button", { name: /solana/i }))

  try {
    await phantom.connectToApp()
  } catch (err) {
    if (!/closed/i.test(err instanceof Error ? err.message : String(err))) throw err
  }

  const sourceOption = page.getByTestId(`rozopay-option-${opts.sourceOptionId}`)
  await expect(sourceOption).toBeVisible({ timeout: 120_000 })
  await expect(sourceOption).toBeEnabled({ timeout: 10_000 })
  await sourceOption.click()

  await phantom.confirmTransaction()
}

// ─── Pay-in: Stellar (headless signer) ────────────────────────────────────────

/** Inject the Stellar secret BEFORE navigation so the app builds the in-page kit. */
export async function useStellarSigner(page: Page, secret: string) {
  await page.addInitScript((s) => {
    ;(window as Window & { __E2E_STELLAR_SECRET__?: string }).__E2E_STELLAR_SECRET__ = s
  }, secret)
}

export async function payInWithStellarHeadless(page: Page) {
  await page.getByRole("button", { name: /pay with stellar/i }).click()
  await page.getByText(E2E_STELLAR_WALLET_NAME, { exact: false }).first().click()

  await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 60_000 })
  const usdcOption = page
    .locator("[data-testid^='rozopay-option-']")
    .filter({ hasText: /USDC/i })
    .first()
  await expect(usdcOption).toBeVisible({ timeout: 60_000 })
  await usdcOption.click()
}

// ─── Shared completion assertion ──────────────────────────────────────────────

/** Wait for the cross-chain PAYOUT to fully complete (not just the payin). */
export async function waitForPayoutCompleted(page: Page, timeout = 8 * 60_000) {
  await expect(page.getByText("Payment Completed", { exact: true })).toBeVisible({ timeout })
  await expect(page.getByText(/processing payout/i)).toBeHidden()
}
```

> **Checkout / Deposit modes:** these only differ in the *app-specific* "reach
> the modal" step (8a) — Checkout clicks "Create Payment" to mint a payId before
> "Pay Now"; Deposit opens the modal with no amount and you enter it in-modal
> after token selection (the SDK shows an amount input with placeholder `0.00`).
> The 8b pay-in helpers are unchanged. See the example app's `helpers.ts` for
> ready-made `startCheckoutPayment` / `startDepositPayment` / `enterDepositAmount`.

---

## 9. SDK test IDs

The SDK exposes stable `data-testid`s — see [`TEST_IDS.md`](./TEST_IDS.md) for
the full inventory. The ones the helpers above rely on:

| `data-testid`           | Use                                                      |
| ----------------------- | -------------------------------------------------------- |
| `rozopay-modal`         | Assert the payment modal opened.                         |
| `rozopay-modal-overlay` | Click to close the modal via backdrop.                   |
| `rozopay-options-list`  | Assert the method/token list rendered.                   |
| `rozopay-option-{id}`   | Click a specific option (prefix-match for "any option"). |

**Option id formats:**
- Wallet connectors: `rozopay-option-io.metamask`, `rozopay-option-Phantom`
- Source tokens: `rozopay-option-{chainId}-{tokenAddress}`
  - Base USDC → `rozopay-option-8453-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
  - Solana USDC → `rozopay-option-501-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

When you don't know the exact token address, filter by symbol instead:

```ts
const usdc = page.locator("[data-testid^='rozopay-option-']").filter({ hasText: /USDC/i }).first()
```

---

## 10. Running

```bash
# 1. Fill secrets
cp .env.e2e.example .env.e2e   # then edit

# 2. Build cached extension profiles (EVM + Solana sources)
pnpm setup-wallets

# 3. Start the app
pnpm dev

# 4. Run flows (in another terminal)
pnpm test:e2e                    # full suite in order (mocked → flows)
pnpm test:e2e:stellar-to-evm     # one flow, isolated (--no-deps)
```

In CI, set `E2E_START_SERVER=1` so Playwright boots the app itself. Real-funds
flows are skipped automatically when their secret isn't set, so CI can safely
run only the `mocked` project by default.

---

## 11. Troubleshooting / gotchas

These are the real issues you'll hit — each one cost a debugging session:

| Symptom                                                     | Cause                                                                                                                        | Fix                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `phantom.unlock()` times out on `input[name='password']`    | Phantom's cached profile starts **unlocked**; `unlock()` blindly fills the password field.                                   | Use `unlockPhantomIfNeeded()` — only unlock if the lock screen is shown.                                              |
| Clicking `/ethereum/i` (or `/solana/i`) times out           | The chain picker only renders for multi-chain wallets **when both chains are offered**; otherwise the SDK connects directly. | Make the chain pick best-effort via `clickIfVisible()`.                                                               |
| `connectToApp()` throws `Target page/context closed`        | The extension auto-closes the popup right after Connect/Approve.                                                             | Swallow only errors matching `/closed/i`; the option-list assertion proves the connection.                            |
| Checkout payId flow fails with `missingAppId` on fee calc   | The `payId` button variant carries no `appId`, and the fee call read it from props.                                          | Fixed in SDK: fee calls now prefer `order.metadata.appId`. Ensure your SDK version includes it.                       |
| `StellarWalletsKit custom element is already registered`    | The kit registers a web component; constructing it twice throws.                                                             | Use the singleton (`cachedKit`) in `createHeadlessStellarKit`, and build it once in the provider's state initializer. |
| Spec import of the Stellar kit breaks under the test runner | The kit transitively imports `@stellar/freighter-api` (browser-only).                                                        | Import the wallet **name** from `e2e-stellar-constants.ts` (kit-free), never from the kit module.                     |
| Running one flow also runs others                           | Project `dependencies` always run first.                                                                                     | Add `--no-deps` to the single-flow script.                                                                            |
| Real funds double-sent                                      | Retries re-ran a payment.                                                                                                    | Keep `retries: 0` and `workers: 1` for real-funds projects.                                                           |

### Security checklist
- Throwaway wallets only, tiny balances.
- `.env.e2e` is gitignored; secrets never reach the app bundle (Stellar secret is injected at runtime, never via `NEXT_PUBLIC_*`).
- Stellar destination wallets need a **USDC trustline**; source wallets need funds.
- Solana setup forces **mainnet** (`toggleNetworkMode: { mode: "off" }`).
```
