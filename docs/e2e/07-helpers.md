# SDK Pay-In Helpers (`e2e/helpers.ts`)

Copy this file verbatim into your app. Everything here touches only the SDK modal
via `data-testid` attributes and the wallet extension APIs. It works unchanged
across all Rozo apps — your only app-specific code is the step that opens the modal.

```ts
import { type Locator, type Page, expect } from "@playwright/test"
import type { Metamask } from "chainwright/metamask"
import type { Phantom } from "chainwright/phantom"
import { E2E_STELLAR_WALLET_NAME } from "../lib/e2e-stellar-constants"

// Click a locator only if it appears within `timeout`. For optional UI branches.
async function clickIfVisible(locator: Locator, timeout = 5_000) {
  try {
    await locator.click({ timeout })
  } catch { /* element absent — skip */ }
}

// ─── Deposit amount ───────────────────────────────────────────────────────────

/**
 * Enter amount on the SDK's in-modal amount screen, then continue.
 * Only for Deposit flows — called right after the source token is picked.
 * Minimum: 0.1 USDC.
 */
export async function enterDepositAmount(page: Page, amount: string) {
  const input = page.getByPlaceholder("0.00")
  await expect(input).toBeVisible({ timeout: 30_000 })
  await input.fill(amount)
  const btn = page.getByRole("button", { name: /continue/i })
  await expect(btn).toBeEnabled({ timeout: 10_000 })
  await btn.click()
}

// ─── EVM pay-in (MetaMask) ────────────────────────────────────────────────────

/**
 * Complete an EVM pay-in. Assumes the SDK modal is already open.
 * Pass `amount` for Deposit flows (entered on the in-modal amount screen).
 */
export async function payInWithMetaMask(
  page: Page,
  metamask: Metamask,
  opts: { sourceOptionId: string; amount?: string }
) {
  await page.getByRole("button", { name: /pay with wallet/i }).click()
  await page.getByRole("button", { name: /metamask/i }).click()
  // Chain picker only appears when both EVM and Solana are offered.
  await clickIfVisible(page.getByRole("button", { name: /ethereum/i }))

  try {
    await metamask.connectToApp()
  } catch (err) {
    // MetaMask auto-closes the popup after Connect — safe to ignore.
    if (!/closed/i.test(err instanceof Error ? err.message : String(err))) throw err
  }

  const option = page.getByTestId(`rozopay-option-${opts.sourceOptionId}`)
  await expect(option).toBeVisible({ timeout: 120_000 })
  await expect(option).toBeEnabled({ timeout: 10_000 })
  await option.click()

  if (opts.amount != null) await enterDepositAmount(page, opts.amount)

  await metamask.confirmTransaction()
}

// ─── Solana pay-in (Phantom) ──────────────────────────────────────────────────

/**
 * Unlock Phantom only if the lock screen is showing.
 * Phantom's cached profile often starts unlocked — calling unlock() blindly
 * will time out waiting for the password field.
 */
export async function unlockPhantomIfNeeded(phantom: Phantom, phantomPage: Page) {
  const locked = await phantomPage.locator("input[name='password']").isVisible()
  if (locked) await phantom.unlock()
}

/**
 * Complete a Solana pay-in. Assumes the SDK modal is already open.
 * Pass `amount` for Deposit flows.
 */
export async function payInWithPhantom(
  page: Page,
  phantom: Phantom,
  opts: { sourceOptionId: string; amount?: string }
) {
  await page.getByRole("button", { name: /pay with wallet/i }).click()
  await page.getByRole("button", { name: /phantom/i }).click()
  // Chain picker only appears when both EVM and Solana are offered.
  await clickIfVisible(page.getByRole("button", { name: /solana/i }))

  try {
    await phantom.connectToApp()
  } catch (err) {
    if (!/closed/i.test(err instanceof Error ? err.message : String(err))) throw err
  }

  const option = page.getByTestId(`rozopay-option-${opts.sourceOptionId}`)
  await expect(option).toBeVisible({ timeout: 120_000 })
  await expect(option).toBeEnabled({ timeout: 10_000 })
  await option.click()

  if (opts.amount != null) await enterDepositAmount(page, opts.amount)

  await phantom.confirmTransaction()
}

// ─── Stellar pay-in (headless signer) ────────────────────────────────────────

/**
 * Inject the Stellar secret before page navigation.
 * The app reads window.__E2E_STELLAR_SECRET__ in its provider initializer.
 * MUST be called before page.goto().
 */
export async function useStellarSigner(page: Page, secret: string) {
  await page.addInitScript((s) => {
    ;(window as Window & { __E2E_STELLAR_SECRET__?: string }).__E2E_STELLAR_SECRET__ = s
  }, secret)
}

async function selectStellarUsdcSource(page: Page) {
  await page.getByRole("button", { name: /pay with stellar/i }).click()
  await page.getByText(E2E_STELLAR_WALLET_NAME, { exact: false }).first().click()

  await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 60_000 })
  const usdc = page.locator("[data-testid^='rozopay-option-']").filter({ hasText: /USDC/i }).first()
  await expect(usdc).toBeVisible({ timeout: 60_000 })
  await usdc.click()
}

/** Stellar pay-in for Bridge and Checkout modes. */
export async function payInWithStellarHeadless(page: Page) {
  await selectStellarUsdcSource(page)
}

/** Stellar pay-in for Deposit mode — enters amount on the in-modal screen. */
export async function payInWithStellarHeadlessDeposit(page: Page, amount: string) {
  await selectStellarUsdcSource(page)
  await enterDepositAmount(page, amount)
}

// ─── Completion ───────────────────────────────────────────────────────────────

/**
 * Wait until the cross-chain payout resolves.
 *
 * SDK confirmation screen states:
 *   "Confirming..."     → pay-in tx settling
 *   "Payment Confirmed" → pay-in done, payout in progress
 *   "Payment Completed" → payout resolved ← assert this
 */
export async function waitForPayoutCompleted(page: Page, timeout = 8 * 60_000) {
  await expect(page.getByText("Payment Completed", { exact: true })).toBeVisible({ timeout })
  await expect(page.getByText(/processing payout/i)).toBeHidden()
}
```
