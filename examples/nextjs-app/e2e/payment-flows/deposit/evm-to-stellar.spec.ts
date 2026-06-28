/**
 * Payment flow E2E — Deposit: EVM USDC → Stellar (mainnet, real funds).
 *
 * Same money movement as bridge/evm-to-stellar, but via Deposit mode:
 * no upfront amount — it is entered INSIDE the SDK modal during pay-in.
 * Source: EVM wallet via MetaMask (chainwright). Destination: E2E.stellar.address.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_EVM_SEED_PHRASE is set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:deposit-evm-to-stellar
 */
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { E2E } from "../../env"
import {
  payInWithMetaMask,
  startDepositPayment,
  waitForPayoutCompleted,
} from "../../helpers"

const test = testWithChainwright(metamaskFixture())

test.describe("Deposit: EVM USDC → Stellar (mainnet, real funds)", () => {
  test.skip(
    !E2E.evm.seedPhrase || !E2E.stellar.address,
    "Set E2E_EVM_SEED_PHRASE and E2E_STELLAR_ADDRESS in .env.e2e"
  )

  test("deposit USDC from EVM to a Stellar destination", async ({
    page,
    metamask,
  }) => {
    await metamask.unlock()

    await startDepositPayment(page, {
      destChain: "Stellar",
      destToken: "USDC",
      address: E2E.stellar.address,
    })
    // Deposit has no preset amount — the SDK shows an in-modal amount screen
    // after the source token is selected.
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: E2E.evm.sourceOptionId,
      // depositAmount respects E2E_AMOUNT but enforces the 0.1 USDC SDK minimum.
      amount: E2E.depositAmount,
    })
    await waitForPayoutCompleted(page)
  })
})
