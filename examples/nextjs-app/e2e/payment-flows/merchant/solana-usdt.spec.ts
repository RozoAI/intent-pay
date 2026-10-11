/**
 * Payment flow E2E — Merchant (payId): Solana USDT → merchant (mainnet, real funds).
 *
 * A merchant payId is created server-side via the merchant endpoint; its
 * destination is fixed by the merchant's config (e.g. pos_rozostudio → USDC on
 * Base). This test only drives the SOURCE: pay the merchant order with Solana
 * USDT via the Phantom extension (chainwright).
 *
 * Solana USDT is a live SDK source but every prior merchant spec paid with USDC.
 * The wallet must hold USDT on Solana — the proxy's wallet option list only
 * returns tokens the wallet actually holds, so no USDT means no
 * `rozopay-option-501-Es9vMF…` row and the pay-in times out.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_MERCHANT_APP_ID and
 * E2E_SOLANA_SEED_PHRASE are set.
 *
 * Setup:  set E2E_MERCHANT_APP_ID in .env.e2e  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  node e2e/run.cjs merchant-solana-usdt
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

// ponytail: merchant amounts are in local currency (RM). 1.50 RM ≈ $0.38,
// above the USDT route minimum and within the throwaway-wallet budget.
const USDT_AMOUNT_LOCAL_RM = "1.50"

test.describe("Merchant (payId): Solana USDT → merchant (mainnet, real funds)", () => {
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
      route: "Solana USDT → merchant",
      status: testInfo.status,
    })
  })

  test("create a merchant payId then pay it with USDT from Solana", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    await unlockPhantomIfNeeded(phantom, phantomPage)

    payId = await startMerchantCheckout(page, {
      apiUrl: E2E.merchant.apiUrl,
      appId: E2E.merchant.appId!,
      amountLocal: USDT_AMOUNT_LOCAL_RM,
      currencyLocal: E2E.merchant.currencyLocal,
      // The merchant endpoint validates `source.tokenSymbol` as "USDC or the
      // chain's native token" — it is a settlement hint, not the pay-in token,
      // so a USDT pay-in still passes USDC here (mirrors merchant/solana).
      source: { chainId: "8453", tokenSymbol: "USDC" },
    })
    await payInWithPhantom(page, phantom, {
      sourceOptionId: E2E.solana.usdtSourceOptionId,
    })
    await waitForPayoutCompleted(page)
  })
})
