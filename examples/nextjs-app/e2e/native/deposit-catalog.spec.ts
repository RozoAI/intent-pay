/**
 * Native source tokens — Deposit-address catalog (mocked, no funds, CI-safe).
 *
 * The SDK never synthesizes native source options: it only surfaces the rows the
 * backend returns, filters them by merchant opt-in (server-side, see the proxy's
 * `nativeAllowlist`), and normalizes native identity at the boundary. These specs
 * pin that contract at the UI level by intercepting the tRPC
 * `getDepositAddressOptions` call and asserting what the modal renders.
 *
 * Covered:
 *   • every supported native source renders with the API's own id/label
 *   • no native option appears when the API omits it (fail-closed contract)
 *   • XLM stays surfaced even when no opt-in natives are present
 *   • stablecoins keep rendering unchanged next to natives (regression)
 *   • the legacy proxy SOL sentinel is accepted as native SOL
 *
 * Not covered here (needs a connected wallet / real funds → payment-flows/):
 *   • atomic source amount and wrong-quote guards  → connectkit unit tests + Layer B
 *   • insufficient spendable balance               → connectkit unit tests + Layer B
 */
import { expect, test, type Page } from "@playwright/test"
import { fillConfig, gotoMode, openModal } from "../helpers"
import {
  ALL_NATIVE_ROWS,
  ALL_STABLE_ROWS,
  batchCount,
  nativeEthBase,
  nativeSolProxySentinel,
  nativeXlmStellar,
  stableUsdcBase,
  trpcBatch,
  type TestDepositOption,
} from "./fixtures"

const DESTINATION = "0x000000000000000000000000000000000000dEaD"

// The SDK modal flow compiles `next dev` routes on demand and boots the whole
// payment provider; the mocked project's 15s navigation budget is too tight for
// a cold first hit. Give the flow room — assertions still fail fast.
test.use({ navigationTimeout: 60_000, actionTimeout: 20_000 })
test.describe.configure({ timeout: 120_000 })

/**
 * Intercept the deposit-address catalog and drive the modal to the chain picker.
 * `payment-api` is aborted so a stray click can never create a real payment row.
 */
async function openNativeChainPicker(page: Page, rows: TestDepositOption[]) {
  await page.route("**/getDepositAddressOptions*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: trpcBatch(rows, batchCount(route.request().url())),
    })
  )
  await page.route("**/payment-api/**", (route) => route.abort())

  await gotoMode(page, "bridge")
  await fillConfig(page, {
    chainName: "Base",
    tokenSymbol: "USDC",
    address: DESTINATION,
    amount: "0.11",
  })
  await page.getByRole("button", { name: /confirm/i }).click()
  const payNow = page.getByRole("button", { name: /pay now/i })
  await expect(payNow).toBeEnabled({ timeout: 20_000 })
  await openModal(page)

  await page.getByTestId("rozopay-option-depositAddress").click()
  await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({
    timeout: 30_000,
  })
}

const nativeTestId = (o: TestDepositOption) => `rozopay-option-${o.id}`

test.describe("Native sources — deposit-address catalog (mocked)", () => {
  test("renders every supported native source with the API's own label", async ({
    page,
  }) => {
    await openNativeChainPicker(page, [...ALL_NATIVE_ROWS, ...ALL_STABLE_ROWS])

    for (const option of ALL_NATIVE_ROWS) {
      await expect(page.getByTestId(nativeTestId(option))).toBeVisible()
    }

    // ETH appears once per EVM chain — same symbol, different chain id.
    await expect(
      page.getByTestId("rozopay-option-ETH on Ethereum")
    ).toBeVisible()
    await expect(page.getByTestId("rozopay-option-ETH on Base")).toBeVisible()
    await expect(
      page.getByTestId("rozopay-option-ETH on Arbitrum")
    ).toBeVisible()

    // Native rows are selectable once the order clears their minimum.
    await expect(page.getByTestId(nativeTestId(nativeEthBase))).toBeEnabled()
    await expect(
      page.getByTestId(nativeTestId(nativeSolProxySentinel))
    ).toBeEnabled()
    await expect(page.getByTestId(nativeTestId(nativeXlmStellar))).toBeEnabled()
  })

  test("does not synthesize native options the API omits", async ({ page }) => {
    // Stablecoin-only payload: exactly what a non-opted-in merchant yields.
    await openNativeChainPicker(page, ALL_STABLE_ROWS)

    for (const option of ALL_NATIVE_ROWS) {
      await expect(page.getByTestId(nativeTestId(option))).toHaveCount(0)
    }
    // Stablecoins still render — the SDK must not go blank.
    for (const stable of ALL_STABLE_ROWS) {
      await expect(page.getByTestId(nativeTestId(stable))).toBeVisible()
    }
    // Fallback-only row proves the mocked catalog (not the static fallback) is
    // the source of truth — otherwise the negative assertions above are vacuous.
    await expect(page.getByTestId("rozopay-option-EURC on Base")).toHaveCount(0)
  })

  test("keeps XLM surfaced when no opt-in natives are present", async ({
    page,
  }) => {
    await openNativeChainPicker(page, [nativeXlmStellar, stableUsdcBase])

    await expect(page.getByTestId(nativeTestId(nativeXlmStellar))).toBeVisible()
    // The opt-in EVM/SOL natives are absent (not returned, not synthesized).
    await expect(page.getByTestId("rozopay-option-ETH on Base")).toHaveCount(0)
    await expect(page.getByTestId("rozopay-option-SOL on Solana")).toHaveCount(
      0
    )
  })

  test("accepts the legacy proxy SOL sentinel as native SOL", async ({
    page,
  }) => {
    // The proxy historically quoted `11111111111111111111111111111112`; the SDK
    // must normalize it to the canonical native SOL instead of dropping it.
    await openNativeChainPicker(page, [nativeSolProxySentinel, stableUsdcBase])

    const sol = page.getByTestId(nativeTestId(nativeSolProxySentinel))
    await expect(sol).toBeVisible()
    await expect(sol).toBeEnabled()
  })

  test("stablecoin options are unchanged next to natives (regression)", async ({
    page,
  }) => {
    await openNativeChainPicker(page, [...ALL_NATIVE_ROWS, ...ALL_STABLE_ROWS])

    for (const stable of ALL_STABLE_ROWS) {
      await expect(page.getByTestId(nativeTestId(stable))).toBeVisible()
      await expect(page.getByTestId(nativeTestId(stable))).toBeEnabled()
    }
    // A stablecoin-only row never gets native styling/labels.
    await expect(page.getByTestId("rozopay-option-USDC on Base")).toContainText(
      "USDC on Base"
    )
  })
})
