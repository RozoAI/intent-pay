/**
 * Wallet-confirmation boundary E2E — Solana via Phantom (mainnet, NO funds
 * moved). Phantom twin of evm-metamask.spec.ts: drive the real extension up to
 * the transaction-confirmation popup, then cancel.
 *
 * Reaching the confirmation popup requires the source-token balance gate to
 * pass, so the funded cached Phantom profile is reused. Still no funds move.
 *
 * Setup:  set E2E_SOLANA_SEED_PHRASE + E2E_EVM_ADDRESS in .env.e2e  →
 *         pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:wallet-cancel
 *
 * Skipped unless E2E_SOLANA_SEED_PHRASE and E2E_EVM_ADDRESS are set.
 */
import { expect } from "@playwright/test"
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import {
  clickRetryPayment,
  connectPhantom,
  expectSourceAmount,
  payInWithPhantomToWallet,
  rejectAndExpectCancelled,
  startBridgePayment,
  unlockPhantomIfNeeded,
  waitForPhantomConfirmation,
} from "../../helpers"

const test = testWithChainwright(phantomFixture())

// Bridge Solana → EVM (Base): Solana USDC source, Base destination.
const DEST = {
  destChain: "Base",
  destToken: "USDC",
  address: E2E.evm.address!,
}

test.describe("Wallet boundary: Solana via Phantom (mainnet, no funds moved)", () => {
  test.skip(
    !E2E.solana.seedPhrase || !E2E.evm.address,
    "Set E2E_SOLANA_SEED_PHRASE and E2E_EVM_ADDRESS in .env.e2e"
  )

  test("source option shows the configured amount before the wallet opens", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    await unlockPhantomIfNeeded(phantom, phantomPage)
    await startBridgePayment(page, { ...DEST, amount: E2E.amount })

    await connectPhantom(page, phantom)
    await expectSourceAmount(page, E2E.solana.sourceOptionId, E2E.amount)
  })

  test("user cancels at the wallet confirmation → Payment Cancelled", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    await unlockPhantomIfNeeded(phantom, phantomPage)
    await startBridgePayment(page, { ...DEST, amount: E2E.amount })

    const prompt = await payInWithPhantomToWallet(page, phantom, {
      sourceOptionId: E2E.solana.sourceOptionId,
    })
    // Confirmation popup is up — the Approve button is present (Cancel is
    // enabled — asserted inside payInWithPhantomToWallet).
    await expect(prompt.getByTestId("primary-button")).toBeVisible()

    await rejectAndExpectCancelled(page, phantom)
  })

  test("retry after cancel re-opens the wallet confirmation popup", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    await unlockPhantomIfNeeded(phantom, phantomPage)
    await startBridgePayment(page, { ...DEST, amount: E2E.amount })

    await payInWithPhantomToWallet(page, phantom, {
      sourceOptionId: E2E.solana.sourceOptionId,
    })
    await rejectAndExpectCancelled(page, phantom)

    await clickRetryPayment(page)
    const prompt = await waitForPhantomConfirmation(page, phantom)
    await expect(prompt.getByTestId("primary-button")).toBeVisible()

    await rejectAndExpectCancelled(page, phantom)
  })
})
