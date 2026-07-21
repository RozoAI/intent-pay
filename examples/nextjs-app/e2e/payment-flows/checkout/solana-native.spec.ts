/**
 * Payment flow E2E — Checkout (payId): Solana SOL → EVM (Base) (mainnet, real funds).
 *
 * Same money movement as the Bridge solana-native flow, but driven through
 * Checkout mode: the order is created server-side via createPayment() first,
 * returning a payId the SDK pays against. Source: Solana wallet via the Phantom
 * extension (chainwright). Destination: our EVM wallet (E2E.evm.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_SOLANA_SEED_PHRASE is set.
 *
 * Setup:  set E2E_SOLANA_SEED_PHRASE (Phantom recovery phrase) in .env.e2e, then
 *         build the cached Phantom profile:  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:checkout-solana-native
 */
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import {
  payInWithPhantom,
  startCheckoutPayment,
  unlockPhantomIfNeeded,
  waitForPayoutCompleted,
  reportPayment,
  setupPaymentIdCapture,
} from "../../helpers"

const test = testWithChainwright(phantomFixture())

// ponytail: WSOL mint from pay-common/src/token.ts solanaSOL.
const SOL_SOURCE_OPTION_ID = "501-So11111111111111111111111111111111111111112"

test.describe("Checkout (payId): Solana SOL → EVM (Base) (mainnet, real funds)", () => {
  test.skip(
    !E2E.solana.seedPhrase || !E2E.evm.address,
    "Set E2E_SOLANA_SEED_PHRASE and E2E_EVM_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "Solana SOL → EVM (Base) (checkout)",
      status: testInfo.status,
    })
  })

  test("create a payId then pay it with SOL from Solana to EVM", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    getPayId = setupPaymentIdCapture(page)
    await unlockPhantomIfNeeded(phantom, phantomPage)

    // ponytail: native SOL requires ~$1.00 USD minimum. Use 1.05 USDC
    // (destination amount = USD value) to stay above the threshold with buffer.
    await startCheckoutPayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address!,
      amount: "1.05",
    })
    await payInWithPhantom(page, phantom, {
      sourceOptionId: SOL_SOURCE_OPTION_ID,
    })
    await waitForPayoutCompleted(page)
  })
})
