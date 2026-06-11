/**
 * Payment flow E2E — Deposit: Solana USDC → Stellar (mainnet, real funds).
 *
 * Same money movement as bridge/solana-to-stellar, but via Deposit mode:
 * no upfront amount — it is entered INSIDE the SDK modal during pay-in.
 * Source: Solana wallet via Phantom (chainwright). Destination: E2E.stellar.address.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_SOLANA_SEED_PHRASE is set.
 *
 * Setup:  set E2E_SOLANA_SEED_PHRASE in .env.e2e  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:deposit-solana-to-stellar
 */
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import {
  payInWithPhantom,
  startDepositPayment,
  unlockPhantomIfNeeded,
  waitForPayoutCompleted,
} from "../../helpers"

const test = testWithChainwright(phantomFixture())

test.describe("Deposit: Solana USDC → Stellar (mainnet, real funds)", () => {
  test.skip(
    !E2E.solana.seedPhrase || !E2E.stellar.address,
    "Set E2E_SOLANA_SEED_PHRASE and E2E_STELLAR_ADDRESS in .env.e2e"
  )

  test("deposit USDC from Solana to a Stellar destination", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    await unlockPhantomIfNeeded(phantom, phantomPage)

    await startDepositPayment(page, {
      destChain: "Stellar",
      destToken: "USDC",
      address: E2E.stellar.address,
    })
    await payInWithPhantom(page, phantom, {
      sourceOptionId: E2E.solana.sourceOptionId,
      // depositAmount respects E2E_AMOUNT but enforces the 0.1 USDC SDK minimum.
      amount: E2E.depositAmount,
    })
    await waitForPayoutCompleted(page)
  })
})
