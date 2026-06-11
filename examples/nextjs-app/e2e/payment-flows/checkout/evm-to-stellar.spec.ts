/**
 * Payment flow E2E — Checkout (payId): EVM USDC → Stellar (mainnet, real funds).
 *
 * Same money movement as the Bridge evm-to-stellar flow, but driven through
 * Checkout mode: the order is created server-side via createPayment() first,
 * returning a payId the SDK pays against. Source: EVM wallet via the MetaMask
 * extension (chainwright). Destination: our Stellar wallet (E2E.stellar.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_EVM_SEED_PHRASE is set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:checkout-evm-to-stellar
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

test.describe("Checkout (payId): EVM USDC → Stellar (mainnet, real funds)", () => {
  test.skip(
    !E2E.evm.seedPhrase || !E2E.stellar.address,
    "Set E2E_EVM_SEED_PHRASE and E2E_STELLAR_ADDRESS in .env.e2e"
  )

  test("create a payId then pay it with USDC from EVM to Stellar", async ({
    page,
    metamask,
  }) => {
    // Cached MetaMask profile starts locked — unlock before any popup can appear.
    await metamask.unlock()

    await startCheckoutPayment(page, {
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
