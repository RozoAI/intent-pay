/**
 * Payment flow E2E — Solana USDC → Stellar (mainnet, real funds).
 *
 * Source: Solana wallet via the Phantom extension (chainwright).
 * Destination: our Stellar wallet address (E2E.stellar.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_SOLANA_SEED_PHRASE is set.
 *
 * Setup:  set E2E_SOLANA_SEED_PHRASE (Phantom recovery phrase) in .env.e2e, then
 *         build the cached Phantom profile:  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:solana-to-stellar
 */
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import {
  payInWithPhantom,
  startBridgePayment,
  unlockPhantomIfNeeded,
  waitForPayoutCompleted,
  setupPaymentIdCapture,
  reportPayment,
} from "../../helpers"

const test = testWithChainwright(phantomFixture())

test.describe("Bridge: Solana USDC → Stellar (mainnet, real funds)", () => {
  test.skip(
    !E2E.solana.seedPhrase || !E2E.stellar.address,
    "Set E2E_SOLANA_SEED_PHRASE and E2E_STELLAR_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "Solana USDC → Stellar",
      status: testInfo.status,
    })
  })

  test("send USDC from Solana to Stellar destination", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    getPayId = setupPaymentIdCapture(page)
    // Cached Phantom profile usually starts unlocked — only unlock if locked.
    await unlockPhantomIfNeeded(phantom, phantomPage)

    await startBridgePayment(page, {
      destChain: "Stellar",
      destToken: "USDC",
      address: E2E.stellar.address,
      amount: E2E.amount,
    })
    await payInWithPhantom(page, phantom, {
      sourceOptionId: E2E.solana.sourceOptionId,
    })
    await waitForPayoutCompleted(page)
  })
})
