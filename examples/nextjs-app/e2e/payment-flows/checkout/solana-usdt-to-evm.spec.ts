/**
 * Payment flow E2E — Checkout (payId): Solana USDT → EVM (Base) (mainnet, real funds).
 *
 * Solana USDT is a live SDK source but every prior SDK payment-flow spec paid
 * with USDC. This covers the non-USDC Solana stablecoin path end to end.
 *
 * Source: Solana wallet via Phantom (chainwright). Destination: E2E.evm.address
 * (Base USDC). The wallet must hold USDT on Solana — the proxy's wallet option
 * list only returns tokens the wallet actually holds, so no USDT means no
 * `rozopay-option-501-Es9vMF…` row and the pay-in times out.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_SOLANA_SEED_PHRASE is set.
 *
 * Setup:  set E2E_SOLANA_SEED_PHRASE in .env.e2e  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  node e2e/run.cjs checkout-solana-usdt-to-evm
 */
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import {
  payInWithPhantom,
  startCheckoutPayment,
  unlockPhantomIfNeeded,
  waitForPayoutCompleted,
  setupPaymentIdCapture,
  reportPayment,
} from "../../helpers"

const test = testWithChainwright(phantomFixture())

// ponytail: ~$1 keeps the run comfortably above the USDT route minimum while
// staying inside the throwaway-wallet budget. Override not needed for this flow.
const USDT_AMOUNT = "1.00"

test.describe("Checkout (payId): Solana USDT → Base (mainnet, real funds)", () => {
  test.skip(
    !E2E.solana.seedPhrase || !E2E.evm.address,
    "Set E2E_SOLANA_SEED_PHRASE and E2E_EVM_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "Solana USDT → EVM (Base) (checkout)",
      status: testInfo.status,
    })
  })

  test("create a payId then pay it with USDT from Solana to EVM", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    getPayId = setupPaymentIdCapture(page)
    await unlockPhantomIfNeeded(phantom, phantomPage)
    await startCheckoutPayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address!,
      amount: USDT_AMOUNT,
    })
    await payInWithPhantom(page, phantom, {
      sourceOptionId: E2E.solana.usdtSourceOptionId,
    })
    await waitForPayoutCompleted(page)
  })
})
