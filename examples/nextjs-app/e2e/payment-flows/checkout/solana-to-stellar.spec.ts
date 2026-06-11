/**
 * Payment flow E2E — Checkout (payId): Solana USDC → Stellar (mainnet, real funds).
 *
 * Same money movement as bridge/solana-to-stellar, but via Checkout mode.
 * Source: Solana wallet via Phantom (chainwright). Destination: E2E.stellar.address.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_SOLANA_SEED_PHRASE is set.
 *
 * Setup:  set E2E_SOLANA_SEED_PHRASE in .env.e2e  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:checkout-solana-to-stellar
 */
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import {
  payInWithPhantom,
  startCheckoutPayment,
  unlockPhantomIfNeeded,
  waitForPayoutCompleted,
} from "../../helpers"

const test = testWithChainwright(phantomFixture())

test.describe("Checkout (payId): Solana USDC → Stellar (mainnet, real funds)", () => {
  test.skip(
    !E2E.solana.seedPhrase || !E2E.stellar.address,
    "Set E2E_SOLANA_SEED_PHRASE and E2E_STELLAR_ADDRESS in .env.e2e"
  )

  test("create a payId then pay it with USDC from Solana to Stellar", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    await unlockPhantomIfNeeded(phantom, phantomPage)

    await startCheckoutPayment(page, {
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
