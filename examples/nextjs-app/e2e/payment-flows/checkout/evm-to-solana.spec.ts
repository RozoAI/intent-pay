/**
 * Payment flow E2E — Checkout (payId): EVM USDC → Solana (mainnet, real funds).
 *
 * Same money movement as bridge/evm-to-solana, but via Checkout mode.
 * Source: EVM wallet via MetaMask (chainwright). Destination: E2E.solana.address.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_EVM_SEED_PHRASE is set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:checkout-evm-to-solana
 */
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { E2E } from "../../env"
import {
  payInWithMetaMask,
  startCheckoutPayment,
  waitForPayoutCompleted,
} from "../../helpers"

const test = testWithChainwright(metamaskFixture())

test.describe("Checkout (payId): EVM USDC → Solana (mainnet, real funds)", () => {
  test.skip(
    !E2E.evm.seedPhrase,
    "E2E_EVM_SEED_PHRASE not set — see .env.e2e.example"
  )

  test("create a payId then pay it with USDC from EVM to Solana", async ({
    page,
    metamask,
  }) => {
    await metamask.unlock()

    await startCheckoutPayment(page, {
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
