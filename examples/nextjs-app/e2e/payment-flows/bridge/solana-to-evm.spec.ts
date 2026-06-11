/**
 * Payment flow E2E — Solana USDC → EVM (Base) (mainnet, real funds).
 *
 * Source: Solana wallet via the Phantom extension (chainwright).
 * Destination: our EVM wallet address (E2E.evm.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_SOLANA_SEED_PHRASE is set.
 *
 * Setup:  set E2E_SOLANA_SEED_PHRASE (Phantom recovery phrase) in .env.e2e, then
 *         build the cached Phantom profile:  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:solana-to-evm
 */
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import {
  payInWithPhantom,
  startBridgePayment,
  unlockPhantomIfNeeded,
  waitForPayoutCompleted,
} from "../../helpers"

const test = testWithChainwright(phantomFixture())

test.describe("Bridge: Solana USDC → Base (mainnet, real funds)", () => {
  test.skip(
    !E2E.solana.seedPhrase || !E2E.evm.address,
    "Set E2E_SOLANA_SEED_PHRASE and E2E_EVM_ADDRESS in .env.e2e"
  )

  test("send USDC from Solana to EVM destination", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    // Cached Phantom profile usually starts unlocked — only unlock if locked.
    await unlockPhantomIfNeeded(phantom, phantomPage)

    await startBridgePayment(page, {
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
