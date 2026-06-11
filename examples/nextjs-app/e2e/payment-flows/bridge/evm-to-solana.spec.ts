/**
 * Payment flow E2E — EVM USDC → Solana (mainnet, real funds).
 *
 * Source: EVM wallet via the MetaMask extension (chainwright).
 * Destination: our Solana wallet address (E2E.solana.address) on rozoSolana (chainId 900).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_EVM_SEED_PHRASE is set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:evm-to-solana
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

test.describe("Bridge: EVM USDC → Solana (mainnet, real funds)", () => {
  test.skip(
    !E2E.evm.seedPhrase || !E2E.solana.address,
    "Set E2E_EVM_SEED_PHRASE and E2E_SOLANA_ADDRESS in .env.e2e"
  )

  test("send USDC from EVM to Solana destination", async ({
    page,
    metamask,
  }) => {
    await metamask.unlock()

    await startBridgePayment(page, {
      destChain: "Solana",
      destToken: "USDC",
      address: E2E.solana.address,
      amount: E2E.amount,
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: E2E.evm.sourceOptionId,
    })
    await waitForPayoutCompleted(page)
  })
})
