/**
 * Payment flow E2E — Merchant (payId): Stellar USDC → merchant (mainnet, real funds).
 *
 * A merchant payId is created server-side via the merchant endpoint; its
 * destination is fixed by the merchant's config (e.g. pos_rozostudio → USDC on
 * Base). This test only drives the SOURCE: pay the merchant order with Stellar
 * USDC via the in-page headless signer. Cross-chain Stellar → merchant.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_MERCHANT_APP_ID and
 * E2E_STELLAR_SECRET are set.
 *
 * Setup:  set E2E_MERCHANT_APP_ID and E2E_STELLAR_SECRET in .env.e2e
 * Run:    pnpm dev &  →  pnpm test:e2e:merchant-stellar
 */
import { test } from "@playwright/test"
import { E2E } from "../../env"
import {
  payInWithStellarHeadless,
  reportPayment,
  startMerchantCheckout,
  useStellarSigner,
  waitForPayoutCompleted,
} from "../../helpers"

test.describe("Merchant (payId): Stellar USDC → merchant (mainnet, real funds)", () => {
  test.skip(
    !E2E.merchant.appId || !E2E.stellar.secret,
    "Set E2E_MERCHANT_APP_ID and E2E_STELLAR_SECRET in .env.e2e"
  )

  // Captured mid-test so the afterEach report has the payId even if a later
  // step fails. Reset per test so a skipped run doesn't inherit a stale id.
  let payId: string | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId,
      route: "Stellar USDC → merchant",
      status: testInfo.status,
    })
  })

  test("create a merchant payId then pay it with USDC from Stellar", async ({
    page,
  }) => {
    await useStellarSigner(page, E2E.stellar.secret!)

    payId = await startMerchantCheckout(page, {
      apiUrl: E2E.merchant.apiUrl,
      appId: E2E.merchant.appId!,
      amountLocal: E2E.merchant.amountLocal,
      currencyLocal: E2E.merchant.currencyLocal,
      source: { chainId: "8453", tokenSymbol: "USDC" },
    })
    await payInWithStellarHeadless(page)
    await waitForPayoutCompleted(page)
  })
})
