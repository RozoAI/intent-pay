/**
 * Payment flow E2E — Merchant (payId): Solana USDC → merchant (mainnet, real funds).
 *
 * A merchant payId is created server-side via the merchant endpoint; its
 * destination is fixed by the merchant's config (e.g. pos_rozostudio → USDC on
 * Base). This test only drives the SOURCE: pay the merchant order with Solana
 * USDC via the Phantom extension (chainwright). Cross-chain Solana → merchant.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_MERCHANT_APP_ID and
 * E2E_SOLANA_SEED_PHRASE are set.
 *
 * Setup:  set E2E_MERCHANT_APP_ID in .env.e2e  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:merchant-solana
 */
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import {
  payInWithPhantom,
  reportPayment,
  startMerchantCheckout,
  unlockPhantomIfNeeded,
  waitForPayoutCompleted,
} from "../../helpers"

const test = testWithChainwright(phantomFixture())

test.describe("Merchant (payId): Solana USDC → merchant (mainnet, real funds)", () => {
  test.skip(
    !E2E.merchant.appId || !E2E.solana.seedPhrase,
    "Set E2E_MERCHANT_APP_ID and E2E_SOLANA_SEED_PHRASE in .env.e2e"
  )

  // Captured mid-test so the afterEach report has the payId even if a later
  // step fails. Reset per test so a skipped run doesn't inherit a stale id.
  let payId: string | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId,
      route: "Solana USDC → merchant",
      status: testInfo.status,
    })
  })

  test("create a merchant payId then pay it with USDC from Solana", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    await unlockPhantomIfNeeded(phantom, phantomPage)

    payId = await startMerchantCheckout(page, {
      apiUrl: E2E.merchant.apiUrl,
      appId: E2E.merchant.appId!,
      amountLocal: E2E.merchant.amountLocal,
      currencyLocal: E2E.merchant.currencyLocal,
      source: { chainId: "8453", tokenSymbol: "USDC" },
    })
    await payInWithPhantom(page, phantom, {
      sourceOptionId: E2E.solana.sourceOptionId,
    })
    await waitForPayoutCompleted(page)
  })
})
