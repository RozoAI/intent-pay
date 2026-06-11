/**
 * Payment flow E2E — Deposit: Stellar USDC → Solana (mainnet, real funds).
 *
 * Source: Stellar headless in-page signer. Destination: E2E.solana.address.
 * No upfront amount — entered inside the SDK modal during pay-in.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_STELLAR_SECRET is set.
 *
 * Run:  pnpm dev &  →  pnpm test:e2e:deposit-stellar-to-solana
 */
import { test } from "@playwright/test"
import { E2E } from "../../env"
import {
  payInWithStellarHeadlessDeposit,
  startDepositPayment,
  useStellarSigner,
  waitForPayoutCompleted,
} from "../../helpers"

test.describe("Deposit: Stellar USDC → Solana (mainnet, real funds)", () => {
  test.skip(
    !E2E.stellar.secret || !E2E.solana.address,
    "Set E2E_STELLAR_SECRET and E2E_SOLANA_ADDRESS in .env.e2e"
  )

  test("deposit USDC from Stellar to Solana destination", async ({ page }) => {
    await useStellarSigner(page, E2E.stellar.secret)
    await startDepositPayment(page, {
      destChain: "Solana",
      destToken: "USDC",
      address: E2E.solana.address,
    })
    // depositAmount respects E2E_AMOUNT but enforces the 0.1 USDC SDK minimum.
    await payInWithStellarHeadlessDeposit(page, E2E.depositAmount)
    await waitForPayoutCompleted(page)
  })
})
