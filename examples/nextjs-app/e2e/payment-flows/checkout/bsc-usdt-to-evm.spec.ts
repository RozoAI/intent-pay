/**
 * Payment flow E2E — Checkout (payId): BSC USDT → EVM (Base) (mainnet, real funds).
 *
 * BSC USDT (BEP-20) is a live SDK source but every prior SDK payment-flow spec
 * paid with USDC. This covers the non-USDC BSC stablecoin path end to end.
 *
 * Source: EVM wallet via MetaMask (chainwright) on BSC (chainId 56).
 * Destination: Base USDC (E2E.evm.address). The wallet must hold USDT on BSC
 * plus BNB for gas — the proxy's wallet option list only returns tokens the
 * wallet actually holds, so no USDT means no `rozopay-option-56-0x55d3…` row
 * and the pay-in times out.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_EVM_SEED_PHRASE is set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  node e2e/run.cjs checkout-bsc-usdt-to-evm
 */
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { E2E } from "../../env"
import {
  payInWithMetaMask,
  startCheckoutPayment,
  waitForPayoutCompleted,
  reportPayment,
  setupPaymentIdCapture,
} from "../../helpers"

const test = testWithChainwright(metamaskFixture())

// ponytail: ~$1 keeps the run comfortably above the USDT route minimum while
// staying inside the throwaway-wallet budget.
const USDT_AMOUNT = "1.00"

test.describe("Checkout (payId): BSC USDT → Base (mainnet, real funds)", () => {
  test.skip(
    !E2E.evm.seedPhrase || !E2E.evm.address,
    "Set E2E_EVM_SEED_PHRASE and E2E_EVM_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "BSC USDT → EVM (Base) (checkout)",
      status: testInfo.status,
    })
  })

  test("create a payId then pay it with USDT from BSC to EVM", async ({
    page,
    metamask,
  }) => {
    getPayId = setupPaymentIdCapture(page)
    // Cached MetaMask profile starts locked — unlock before any popup can appear.
    await metamask.unlock()
    await startCheckoutPayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address!,
      amount: USDT_AMOUNT,
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: E2E.evm.bscUsdtSourceOptionId,
    })
    await waitForPayoutCompleted(page)
  })
})
