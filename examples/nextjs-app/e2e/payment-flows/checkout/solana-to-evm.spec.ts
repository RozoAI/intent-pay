/**
 * Payment flow E2E — Checkout (payId): Solana USDC → EVM (Base) (mainnet, real funds).
 *
 * Source: Solana wallet via Phantom (chainwright). Destination: E2E.evm.address.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_SOLANA_SEED_PHRASE is set.
 *
 * Setup:  set E2E_SOLANA_SEED_PHRASE in .env.e2e  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:checkout-solana-to-evm
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

test.describe("Checkout (payId): Solana USDC → Base (mainnet, real funds)", () => {
  test.skip(
    !E2E.solana.seedPhrase,
    "E2E_SOLANA_SEED_PHRASE not set — see .env.e2e.example"
  )

  test("create a payId then pay it with USDC from Solana to EVM", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    await unlockPhantomIfNeeded(phantom, phantomPage)
    await startCheckoutPayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address,
      amount: E2E.amount,
    })
    await payInWithPhantom(page, phantom, {
      sourceOptionId: E2E.solana.sourceOptionId,
    })
    await waitForPayoutCompleted(page)
  })
})
