/**
 * Payment flow E2E — EVM USDC → Stellar (mainnet, real funds).
 *
 * Source: EVM wallet via the MetaMask extension (chainwright).
 * Destination: our Stellar wallet address (E2E.stellar.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_EVM_SEED_PHRASE is set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:evm-to-stellar
 */
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { E2E } from "../../env"
import {
  payInWithMetaMask,
  startBridgePayment,
  waitForPayoutCompleted,
} from "../../helpers"

const test = testWithChainwright(metamaskFixture())

test.describe("Bridge: EVM USDC → Stellar (mainnet, real funds)", () => {
  test.skip(
    !E2E.evm.seedPhrase,
    "E2E_EVM_SEED_PHRASE not set — see .env.e2e.example"
  )

  test("send USDC from EVM to Stellar destination", async ({
    page,
    metamask,
  }) => {
    // Cached MetaMask profile starts locked — unlock before any popup can appear.
    await metamask.unlock()

    await startBridgePayment(page, {
      destChain: "Stellar",
      destToken: "USDC",
      address: E2E.stellar.address,
      amount: E2E.amount,
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: E2E.evm.sourceOptionId,
    })
    await waitForPayoutCompleted(page)
  })
})
