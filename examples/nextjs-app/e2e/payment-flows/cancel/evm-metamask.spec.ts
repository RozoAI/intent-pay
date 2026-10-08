/**
 * Wallet-confirmation boundary E2E — EVM via MetaMask (mainnet, NO funds moved).
 *
 * These tests drive the real MetaMask extension up to the transaction-
 * confirmation popup and then CANCEL — nothing is ever signed or submitted, so
 * no funds leave the wallet. They exist to cover the cases the real-funds suite
 * skips: the exact amount handed to the wallet, and the bad paths (user
 * cancels, insufficient balance).
 *
 * Reaching the confirmation popup requires the source-token balance gate to
 * pass, so the funded cached MetaMask profile is reused. Still no funds move.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:wallet-cancel
 *
 * Skipped unless E2E_EVM_SEED_PHRASE and E2E_STELLAR_ADDRESS are set.
 */
import { expect } from "@playwright/test"
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { E2E } from "../../env"
import {
  clickRetryPayment,
  connectMetaMask,
  expectSourceAmount,
  expectSourceInsufficient,
  payInWithMetaMaskToWallet,
  rejectAndExpectCancelled,
  startBridgePayment,
  waitForMetaMaskConfirmation,
} from "../../helpers"

const test = testWithChainwright(metamaskFixture())

// Bridge EVM → Stellar: Base USDC source, Stellar destination. The destination
// is never reached because we always cancel at the wallet.
const DEST = {
  destChain: "Stellar",
  destToken: "USDC",
  address: E2E.stellar.address!,
}

// Intentionally far above a throwaway wallet's balance, so every source token
// comes back disabled with "Balance too low". Overridable for wallets that hold
// more — pick a value still within the quote API's accepted range.
const INSUFFICIENT_AMOUNT = process.env.E2E_INSUFFICIENT_AMOUNT ?? "1000"

test.describe("Wallet boundary: EVM via MetaMask (mainnet, no funds moved)", () => {
  test.skip(
    !E2E.evm.seedPhrase || !E2E.stellar.address,
    "Set E2E_EVM_SEED_PHRASE and E2E_STELLAR_ADDRESS in .env.e2e"
  )

  test("source option shows the configured amount before the wallet opens", async ({
    page,
    metamask,
  }) => {
    await metamask.unlock()
    await startBridgePayment(page, { ...DEST, amount: E2E.amount })

    await connectMetaMask(page, metamask)
    // The amount the wallet will be asked to sign comes from the SDK's own
    // option title (e.g. "0.02 USDC on Base") — assert it here rather than
    // scraping MetaMask's version-specific DOM.
    await expectSourceAmount(page, E2E.evm.sourceOptionId, E2E.amount)
  })

  test("user cancels at the wallet confirmation → Payment Cancelled", async ({
    page,
    metamask,
  }) => {
    await metamask.unlock()
    await startBridgePayment(page, { ...DEST, amount: E2E.amount })

    const prompt = await payInWithMetaMaskToWallet(page, metamask, {
      sourceOptionId: E2E.evm.sourceOptionId,
    })
    // Confirmation popup is up: the confirm button is present (and Cancel is
    // enabled — asserted inside payInWithMetaMaskToWallet).
    await expect(prompt.getByTestId("confirm-footer-button")).toBeVisible()

    await rejectAndExpectCancelled(page, metamask)
  })

  test("retry after cancel re-opens the wallet confirmation popup", async ({
    page,
    metamask,
  }) => {
    await metamask.unlock()
    await startBridgePayment(page, { ...DEST, amount: E2E.amount })

    await payInWithMetaMaskToWallet(page, metamask, {
      sourceOptionId: E2E.evm.sourceOptionId,
    })
    await rejectAndExpectCancelled(page, metamask)

    // "Retry Payment" re-runs the transfer and re-opens the wallet popup.
    await clickRetryPayment(page)
    const prompt = await waitForMetaMaskConfirmation(page, metamask)
    await expect(prompt.getByTestId("confirm-footer-button")).toBeVisible()

    // Reject the retry too so the test never signs anything.
    await rejectAndExpectCancelled(page, metamask)
  })

  test("insufficient balance disables the source option and never opens the wallet", async ({
    page,
    metamask,
  }) => {
    await metamask.unlock()
    await startBridgePayment(page, { ...DEST, amount: INSUFFICIENT_AMOUNT })

    await connectMetaMask(page, metamask)
    await expectSourceInsufficient(page, E2E.evm.sourceOptionId)
    // A disabled option cannot be clicked, so the modal stays on the token list
    // and no wallet confirmation can appear.
    await expect(page.getByTestId("rozopay-modal")).toBeVisible()
  })
})
