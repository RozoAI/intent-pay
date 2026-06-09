# E2E Playground Tests — Bridge Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playwright E2E tests for the Bridge mode flow in `examples/nextjs-app`, with stable `data-testid` attributes in the SDK using a consistent naming convention, and a published testid inventory for other devs/apps to consume.

**Architecture:** Tests live in `examples/nextjs-app/e2e/`. The SDK gets `data-testid` attributes on key elements using the convention `rozopay-{component}-{id}`. A human-readable inventory file at `packages/connectkit/TEST_IDS.md` documents every testid as a stable public contract. Playwright drives the Next.js dev server and tests only what doesn't need real wallet signing.

**Tech Stack:** Playwright `@playwright/test`, Next.js dev server, pnpm workspaces

---

## Scope

### Covered
- Modal open / close (Escape, backdrop click)
- Bridge config form → Confirm → Pay Now enabled
- `resetPayment()` Applying loading state
- Payment method list renders with correct options
- SelectMethod option buttons are clickable and have stable testids
- EventLog empty before payment

### Not covered (out of scope for now)
- Real wallet transaction signing
- Actual on-chain payment completion
- Checkout / Deposit modes (separate plan)

---

## `data-testid` Convention

Format: `rozopay-{component}-{identifier}`

| Element | `data-testid` |
|---------|--------------|
| Modal root | `rozopay-modal` |
| Background overlay | `rozopay-modal-overlay` |
| Close button | `rozopay-modal-close` |
| Options list container | `rozopay-options-list` |
| Each option button | `rozopay-option-{option.id}` |
| Order header | `rozopay-order-header` |
| Powered by footer | `rozopay-powered-by-footer` |

These are documented in `packages/connectkit/TEST_IDS.md` (Task 2).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/connectkit/src/components/Common/Modal/index.tsx` | Add `data-testid` to `ModalContainer`, `BackgroundOverlay`, close button |
| Modify | `packages/connectkit/src/components/Common/OptionsList/index.tsx` | Add `data-testid` to `OptionsContainer` and each `OptionButton` |
| Create | `packages/connectkit/TEST_IDS.md` | Testid inventory — public contract for consumers |
| Modify | `examples/nextjs-app/package.json` | Add Playwright dep + `test:e2e` scripts |
| Create | `examples/nextjs-app/e2e/playwright.config.ts` | Playwright config with Next.js webServer |
| Create | `examples/nextjs-app/e2e/helpers.ts` | Reusable page helpers (gotoMode, fillBridgeConfig, openModal…) |
| Create | `examples/nextjs-app/e2e/bridge.spec.ts` | Bridge mode E2E tests |
| Modify | `package.json` (root) | Add `test:e2e` root script |

---

## Task 1: Add `data-testid` attributes to SDK components

**Files:**
- Modify: `packages/connectkit/src/components/Common/Modal/index.tsx:477-686`
- Modify: `packages/connectkit/src/components/Common/OptionsList/index.tsx`

### Step 1a: Modal — add testids

- [ ] **Read current ModalContainer render** (line 477)

Already done — `ModalContainer` is at line 477, `BackgroundOverlay` at 485, close button is inside `ControllerContainer`.

- [ ] **Add testid to ModalContainer**

In `packages/connectkit/src/components/Common/Modal/index.tsx`, find:
```tsx
      <ModalContainer
        role="dialog"
        style={{
```
Replace with:
```tsx
      <ModalContainer
        role="dialog"
        data-testid="rozopay-modal"
        style={{
```

- [ ] **Add testid to BackgroundOverlay**

Find:
```tsx
        {!inline && (
          <BackgroundOverlay
            $active={rendered}
            onClick={shouldDisableBackgroundClick ? undefined : onClose}
```
Replace with:
```tsx
        {!inline && (
          <BackgroundOverlay
            $active={rendered}
            data-testid="rozopay-modal-overlay"
            onClick={shouldDisableBackgroundClick ? undefined : onClose}
```

- [ ] **Add testid to CloseButton**

Search for `<CloseButton` in the same file and add `data-testid="rozopay-modal-close"`:
```tsx
<CloseButton
  data-testid="rozopay-modal-close"
  ...
```

### Step 1b: OptionsList — add testids

- [ ] **Add testid to OptionsContainer**

In `packages/connectkit/src/components/Common/OptionsList/index.tsx`, find all `<OptionsContainer` renders (there are 2: loading branch + normal branch). Add `data-testid="rozopay-options-list"` to both:

Loading branch (line ~58):
```tsx
      <OptionsContainer $totalResults={options.length} data-testid="rozopay-options-list">
```

Normal branch (line ~78):
```tsx
        <OptionsContainer $totalResults={options.length} data-testid="rozopay-options-list">
```

- [ ] **Add testid to each OptionButton in OptionItem**

In `OptionItem` component (line ~177), find:
```tsx
    <OptionButton
      type="button"
      onClick={option.onClick}
      disabled={option.disabled}
    >
```
Replace with:
```tsx
    <OptionButton
      type="button"
      data-testid={`rozopay-option-${option.id}`}
      onClick={option.onClick}
      disabled={option.disabled}
    >
```

- [ ] **Verify build still passes**

```bash
cd packages/connectkit && pnpm build 2>&1 | tail -20
```
Expected: Build completes without TypeScript errors.

- [ ] **Commit**

```bash
git add packages/connectkit/src/components/Common/Modal/index.tsx packages/connectkit/src/components/Common/OptionsList/index.tsx
git commit -m "feat: add data-testid attributes to modal and options list for E2E testing"
```

---

## Task 2: Create testid inventory

**Files:**
- Create: `packages/connectkit/TEST_IDS.md`

- [ ] **Create TEST_IDS.md**

Create `packages/connectkit/TEST_IDS.md`:
```markdown
# RozoPaySDK — Test ID Inventory

`data-testid` attributes exposed by the SDK for E2E testing, automation, and external apps.

## Convention

Format: `rozopay-{component}-{identifier}`

All testids are stable across patch releases. Breaking changes to testids are treated as semver-minor changes.

## Modal

| `data-testid` | Element | Notes |
|--------------|---------|-------|
| `rozopay-modal` | Root modal container | Present when modal is open. Has `role="dialog"`. |
| `rozopay-modal-overlay` | Background overlay | Click closes the modal (unless `shouldDisableBackgroundClick`). |
| `rozopay-modal-close` | Close (×) button | Always present in modal header. |

## Payment Method Selection (SelectMethod page)

| `data-testid` | Element | Notes |
|--------------|---------|-------|
| `rozopay-options-list` | Options list container | Present on SelectMethod, SelectToken, SelectExchange pages. |
| `rozopay-option-{id}` | Individual option button | `{id}` is the option's stable `id` field. See table below. |

### Known option IDs

| `data-testid` | Payment method |
|--------------|---------------|
| `rozopay-option-connectedWallet` | Currently connected EVM wallet |
| `rozopay-option-connectedSolana` | Currently connected Solana wallet |
| `rozopay-option-connectedStellar` | Currently connected Stellar wallet |
| `rozopay-option-metamask` | MetaMask (not connected) |
| `rozopay-option-coinbase` | Coinbase Wallet |
| `rozopay-option-rainbow` | Rainbow Wallet |
| `rozopay-option-phantom` | Phantom |
| `rozopay-option-coinbaseExchange` | Coinbase Exchange |
| `rozopay-option-depositAddress` | Deposit address option |

> To find all option IDs, search for `id:` fields in `SelectMethod/index.tsx` and `useExternalPaymentOptions.ts`.

## Usage in Playwright

```typescript
// Wait for modal
await expect(page.getByTestId("rozopay-modal")).toBeVisible()

// Click a specific payment method
await page.getByTestId("rozopay-option-connectedWallet").click()

// Close modal
await page.getByTestId("rozopay-modal-close").click()
```

## Usage in Cypress

```javascript
cy.get('[data-testid="rozopay-modal"]').should("be.visible")
cy.get('[data-testid="rozopay-option-connectedWallet"]').click()
```
```

- [ ] **Commit**

```bash
git add packages/connectkit/TEST_IDS.md
git commit -m "docs: add TEST_IDS.md inventory for E2E data-testid attributes"
```

---

## Task 3: Install Playwright in the playground

**Files:**
- Modify: `examples/nextjs-app/package.json`
- Create: `examples/nextjs-app/e2e/playwright.config.ts`

- [ ] **Install Playwright**

```bash
cd examples/nextjs-app
pnpm add -D @playwright/test
npx playwright install chromium
```

- [ ] **Add scripts to package.json**

In `examples/nextjs-app/package.json`, add to `"scripts"`:
```json
"test:e2e": "playwright test --config e2e/playwright.config.ts",
"test:e2e:ui": "playwright test --config e2e/playwright.config.ts --ui",
"test:e2e:headed": "playwright test --config e2e/playwright.config.ts --headed"
```

- [ ] **Create playwright.config.ts**

Create `examples/nextjs-app/e2e/playwright.config.ts`:
```typescript
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: "..",  // run from examples/nextjs-app root
  },
})
```

- [ ] **Verify config loads**

```bash
cd examples/nextjs-app
pnpm test:e2e --list
```
Expected: "No tests found" (no spec files yet), no error about config.

- [ ] **Commit**

```bash
git add examples/nextjs-app/package.json examples/nextjs-app/e2e/playwright.config.ts
git commit -m "test: add Playwright setup to playground"
```

---

## Task 4: Create page helpers

**Files:**
- Create: `examples/nextjs-app/e2e/helpers.ts`

Radix `Select` (used in `ParamForm`) does NOT render a native `<select>`. It renders a button + listbox. Helpers abstract this so tests don't repeat Radix interaction logic.

- [ ] **Create helpers.ts**

Create `examples/nextjs-app/e2e/helpers.ts`:
```typescript
import { type Page, expect } from "@playwright/test"

/** Navigate to a playground mode and wait for the config aside to hydrate */
export async function gotoMode(page: Page, mode: "bridge" | "checkout" | "deposit") {
  await page.goto(`/${mode}`)
  await expect(page.getByRole("complementary", { name: "Configuration" })).toBeVisible({
    timeout: 15_000,
  })
}

/**
 * Select a value from a Radix Select component.
 * Radix renders a button (trigger) + popover listbox — not a native <select>.
 * We find the trigger by its accessible name (label text), open it, then pick the item.
 */
export async function selectRadixOption(page: Page, labelText: string, optionText: string) {
  // The SelectTrigger sits inside a labeled group — find by label
  const label = page.getByText(labelText, { exact: false })
  const trigger = label.locator("~ * [role='combobox'], + div [role='combobox']").first()
    .or(page.locator(`[role="combobox"]`).filter({ hasText: /select/i }).first())

  // Simpler: find the combobox that's near the label
  const group = page.locator("div").filter({ has: label })
  const combobox = group.getByRole("combobox").first()
  await combobox.click()

  // Listbox appears as a portal — find option by text
  await page.getByRole("option", { name: optionText }).click()
}

/**
 * Fill the Bridge config form.
 * chainName: e.g. "Base", "Polygon"
 * tokenSymbol: e.g. "USDC", "USDT"
 * address: EVM address string
 * amount: human-readable e.g. "1"
 */
export async function fillBridgeConfig(
  page: Page,
  opts: { chainName: string; tokenSymbol: string; address: string; amount: string }
) {
  await selectRadixOption(page, "Destination Chain", opts.chainName)
  await selectRadixOption(page, "Destination Token", opts.tokenSymbol)
  await page.getByPlaceholder(/EVM address/i).fill(opts.address)
  await page.getByPlaceholder(/e\.g\. 1\.00/i).fill(opts.amount)
}

/** Click Confirm and wait until Pay Now button is enabled */
export async function confirmAndWait(page: Page) {
  await page.getByRole("button", { name: /confirm/i }).click()
  await expect(page.getByRole("button", { name: /pay now/i })).toBeEnabled({ timeout: 15_000 })
}

/** Click Pay Now and wait for the SDK modal to appear */
export async function openModal(page: Page) {
  await page.getByRole("button", { name: /pay now/i }).click()
  await expect(page.getByTestId("rozopay-modal")).toBeVisible({ timeout: 10_000 })
}

/** Close modal via Escape key */
export async function closeModalEscape(page: Page) {
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("rozopay-modal")).not.toBeVisible({ timeout: 5_000 })
}

/** Close modal by clicking the overlay backdrop */
export async function closeModalBackdrop(page: Page) {
  await page.getByTestId("rozopay-modal-overlay").click({ force: true })
  await expect(page.getByTestId("rozopay-modal")).not.toBeVisible({ timeout: 5_000 })
}
```

- [ ] **Commit**

```bash
git add examples/nextjs-app/e2e/helpers.ts
git commit -m "test: add E2E page helpers for Playwright"
```

---

## Task 5: Write Bridge mode E2E tests

**Files:**
- Create: `examples/nextjs-app/e2e/bridge.spec.ts`

Test config uses Base + USDC + a burn address (no real funds risk).

- [ ] **Create bridge.spec.ts**

Create `examples/nextjs-app/e2e/bridge.spec.ts`:
```typescript
import { expect, test } from "@playwright/test"
import {
  closeModalBackdrop,
  closeModalEscape,
  confirmAndWait,
  fillBridgeConfig,
  gotoMode,
  openModal,
} from "./helpers"

const CFG = {
  chainName: "Base",
  tokenSymbol: "USDC",
  address: "0x000000000000000000000000000000000000dEaD",
  amount: "1",
}

test.describe("Bridge mode — config form", () => {
  test("Pay Now is disabled before config is confirmed", async ({ page }) => {
    await gotoMode(page, "bridge")
    await expect(page.getByRole("button", { name: /pay now/i })).toBeDisabled()
  })

  test("Confirm button is disabled when form is pristine", async ({ page }) => {
    await gotoMode(page, "bridge")
    await expect(page.getByRole("button", { name: /confirm/i })).toBeDisabled()
  })

  test("filling config enables Confirm button", async ({ page }) => {
    await gotoMode(page, "bridge")
    await fillBridgeConfig(page, CFG)
    await expect(page.getByRole("button", { name: /confirm/i })).toBeEnabled()
  })

  test("Confirm shows Applying state then enables Pay Now", async ({ page }) => {
    await gotoMode(page, "bridge")
    await fillBridgeConfig(page, CFG)
    await page.getByRole("button", { name: /confirm/i }).click()
    // Transient loading state
    await expect(page.getByRole("button", { name: /applying/i })).toBeVisible({ timeout: 5_000 })
    // Resolves to Pay Now
    await expect(page.getByRole("button", { name: /pay now/i })).toBeEnabled({ timeout: 15_000 })
  })
})

test.describe("Bridge mode — modal", () => {
  test.beforeEach(async ({ page }) => {
    await gotoMode(page, "bridge")
    await fillBridgeConfig(page, CFG)
    await confirmAndWait(page)
  })

  test("modal opens on Pay Now click", async ({ page }) => {
    await openModal(page)
    await expect(page.getByTestId("rozopay-modal")).toBeVisible()
  })

  test("modal has role=dialog", async ({ page }) => {
    await openModal(page)
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("modal closes on Escape", async ({ page }) => {
    await openModal(page)
    await closeModalEscape(page)
    await expect(page.getByTestId("rozopay-modal")).not.toBeVisible()
  })

  test("modal closes on overlay backdrop click", async ({ page }) => {
    await openModal(page)
    await closeModalBackdrop(page)
    await expect(page.getByTestId("rozopay-modal")).not.toBeVisible()
  })

  test("modal renders options list after loading", async ({ page }) => {
    await openModal(page)
    // Options list container should appear (may take time while fetching balances)
    await expect(page.getByTestId("rozopay-options-list")).toBeVisible({ timeout: 20_000 })
  })

  test("modal shows at least one payment option button", async ({ page }) => {
    await openModal(page)
    await expect(page.getByTestId("rozopay-options-list")).toBeVisible({ timeout: 20_000 })
    // At least one option row is visible
    const options = page.locator("[data-testid^='rozopay-option-']")
    await expect(options.first()).toBeVisible({ timeout: 20_000 })
    expect(await options.count()).toBeGreaterThan(0)
  })

  test("Pay Now button is re-enabled after closing modal", async ({ page }) => {
    await openModal(page)
    await closeModalEscape(page)
    await expect(page.getByRole("button", { name: /pay now/i })).toBeEnabled()
  })
})

test.describe("Bridge mode — event log", () => {
  test("event log is empty before any payment", async ({ page }) => {
    await gotoMode(page, "bridge")
    await fillBridgeConfig(page, CFG)
    await confirmAndWait(page)
    // EventLog shows empty state
    await expect(page.getByText(/no events/i)).toBeVisible()
  })
})
```

- [ ] **Run the tests (headed for first run, easier to debug)**

```bash
cd examples/nextjs-app
pnpm test:e2e:headed e2e/bridge.spec.ts
```
Expected: Most tests pass. The "Applying state" test may be flaky if `resetPayment()` resolves faster than the 5s timeout — reduce timeout or remove if consistently instant.

- [ ] **Fix selector issues if any**

Common issues and fixes:
- If `getByRole("complementary", { name: "Configuration" })` doesn't match → use `page.locator("aside")` instead
- If Radix `Select` listbox doesn't open → check if the trigger needs to be scrolled into view first: `await combobox.scrollIntoViewIfNeeded()` before `.click()`
- If `rozopay-options-list` never appears → check the SDK is built with testids (`pnpm build` in `packages/connectkit`)
- If `rozopay-modal` not visible → confirm the local SDK build is being used (check `node_modules/@rozoai/intent-pay` symlink points to local)

- [ ] **Run headless to confirm**

```bash
cd examples/nextjs-app
pnpm test:e2e e2e/bridge.spec.ts
```
Expected: All tests green.

- [ ] **Commit**

```bash
git add examples/nextjs-app/e2e/bridge.spec.ts
git commit -m "test: add Bridge mode E2E tests"
```

---

## Task 6: Wire root pnpm script

**Files:**
- Modify: `package.json` (root)

- [ ] **Add root test:e2e script**

In root `package.json`, add to `"scripts"`:
```json
"test:e2e": "pnpm --filter \"examples/nextjs-app\" test:e2e"
```

- [ ] **Verify from root**

```bash
pnpm test:e2e --list
```
Expected: Lists all bridge spec tests.

- [ ] **Commit**

```bash
git add package.json
git commit -m "test: wire test:e2e to root pnpm script"
```

---

## Self-Review

### Spec coverage
- ✅ Pay Now disabled before config confirmed
- ✅ Confirm → Applying → Pay Now enabled
- ✅ Modal opens on Pay Now
- ✅ Modal has `role="dialog"`
- ✅ Modal closes on Escape
- ✅ Modal closes on backdrop click
- ✅ Options list renders with testid
- ✅ Individual option buttons have `rozopay-option-{id}` testids
- ✅ Pay Now re-enabled after modal close
- ✅ EventLog empty before payment
- ✅ Testid inventory in `TEST_IDS.md` with Playwright + Cypress usage examples
- ✅ Root pnpm script

### Testid naming — consistent, no duplicates
All use `rozopay-{component}-{id}` format. No placeholder IDs.

### Radix Select caveat documented
`ParamForm` uses Radix Select (not native `<select>`). The `selectRadixOption` helper in `helpers.ts` handles this correctly by clicking the combobox trigger then selecting from the listbox portal.

### Known limitation
`fillBridgeConfig` relies on placeholder text matching (`/EVM address/i`, `/e\.g\. 1\.00/i`). If `ParamForm` placeholder text changes, update helpers accordingly.
