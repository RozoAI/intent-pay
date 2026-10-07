/**
 * Payment flow E2E — Merchant (payId): EVM native (ETH / BNB) → merchant.
 *
 * A merchant payId is created server-side via the merchant endpoint
 * (/payment-api/payments/merchant); its destination is fixed by the merchant's
 * config (e.g. pos_rozostudio → USDC on Base). Each test only drives the SOURCE.
 *
 * THIS TEST MOVES REAL MONEY. Each test is skipped unless E2E_MERCHANT_APP_ID
 * and E2E_EVM_SEED_PHRASE are set.
 *
 * Setup:  set E2E_MERCHANT_APP_ID in .env.e2e  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  node e2e/run.cjs merchant-evm-native
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

// ponytail: native source sentinels — EIP-7528 (viem/ethAddress).
const ETH_BASE_SOURCE_OPTION_ID =
  "8453-0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
const BNB_BSC_SOURCE_OPTION_ID = "56-0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

test.describe("Merchant (payId): EVM native → merchant (mainnet, real funds)", () => {
  // Captured mid-test so the afterEach report has the payId even if a later
  // step fails. Reset per test so a skipped run doesn't inherit a stale id.
  let payId: string | undefined
  let route = "EVM native → merchant"

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId,
      route,
      status: testInfo.status,
    })
  })

  test("ETH on Base → merchant", async ({ page, metamask }) => {
    test.skip(
      !E2E.merchant.appId || !E2E.evm.seedPhrase,
      "Set E2E_MERCHANT_APP_ID and E2E_EVM_SEED_PHRASE in .env.e2e"
    )
    route = "ETH on Base → merchant"
    // Cached MetaMask profile starts locked — unlock before any popup can appear.
    await metamask.unlock()

    // ponytail: native ETH on Base requires ~$0.10 USD minimum. Merchant amount
    // is in local currency (RM); 0.50 RM ≈ $0.11-$0.13 USD, safely above threshold.
    payId = await startMerchantCheckout(page, {
      apiUrl: E2E.merchant.apiUrl,
      appId: E2E.merchant.appId!,
      amountLocal: "0.50",
      currencyLocal: E2E.merchant.currencyLocal,
      source: { chainId: "8453", tokenSymbol: "ETH" },
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: ETH_BASE_SOURCE_OPTION_ID,
    })
    await waitForPayoutCompleted(page)
  })

  test("BNB on BSC → merchant", async ({ page, metamask }) => {
    test.skip(
      !E2E.merchant.appId || !E2E.evm.seedPhrase,
      "Set E2E_MERCHANT_APP_ID and E2E_EVM_SEED_PHRASE in .env.e2e"
    )
    route = "BNB on BSC → merchant"
    await metamask.unlock()

    // BNB (BSC) native source, merchant destination fixed server-side. Verified
    // viable by dryrun quote (source BNB@56); needs BNB funds on BSC.
    payId = await startMerchantCheckout(page, {
      apiUrl: E2E.merchant.apiUrl,
      appId: E2E.merchant.appId!,
      amountLocal: "0.50",
      currencyLocal: E2E.merchant.currencyLocal,
      source: { chainId: "56", tokenSymbol: "BNB" },
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: BNB_BSC_SOURCE_OPTION_ID,
    })
    await waitForPayoutCompleted(page)
  })
})
