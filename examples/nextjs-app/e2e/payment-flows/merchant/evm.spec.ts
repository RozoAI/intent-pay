/**
 * Payment flow E2E — Merchant (payId): EVM USDC → merchant (mainnet, real funds).
 *
 * A merchant payId is created server-side via the merchant endpoint
 * (/payment-api/payments/merchant); its destination is fixed by the merchant's
 * config (e.g. pos_rozostudio → USDC on Base). This test only drives the SOURCE:
 * pay the merchant order with Base USDC via the MetaMask extension (chainwright).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_MERCHANT_APP_ID and
 * E2E_EVM_SEED_PHRASE are set.
 *
 * Setup:  set E2E_MERCHANT_APP_ID in .env.e2e  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:merchant-evm
 */
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { E2E } from "../../env"
import {
  payInWithMetaMask,
  reportPayment,
  startMerchantCheckout,
  waitForPayoutCompleted,
} from "../../helpers"

const test = testWithChainwright(metamaskFixture())

test.describe("Merchant (payId): EVM USDC → merchant (mainnet, real funds)", () => {
  test.skip(
    !E2E.merchant.appId || !E2E.evm.seedPhrase,
    "Set E2E_MERCHANT_APP_ID and E2E_EVM_SEED_PHRASE in .env.e2e"
  )

  // Captured mid-test so the afterEach report has the payId even if a later
  // step fails. Reset per test so a skipped run doesn't inherit a stale id.
  let payId: string | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId,
      route: "EVM USDC → merchant",
      status: testInfo.status,
    })
  })

  test("create a merchant payId then pay it with USDC from EVM", async ({
    page,
    metamask,
  }) => {
    // Cached MetaMask profile starts locked — unlock before any popup can appear.
    await metamask.unlock()

    payId = await startMerchantCheckout(page, {
      apiUrl: E2E.merchant.apiUrl,
      appId: E2E.merchant.appId!,
      amountLocal: E2E.merchant.amountLocal,
      currencyLocal: E2E.merchant.currencyLocal,
      source: { chainId: "8453", tokenSymbol: "USDC" },
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: E2E.evm.sourceOptionId,
    })
    await waitForPayoutCompleted(page)
  })
})
