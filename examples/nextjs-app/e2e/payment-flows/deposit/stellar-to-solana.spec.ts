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
    !E2E.stellar.secret,
    "No Stellar secret — set E2E_STELLAR_SECRET in .env.e2e"
  )

  test("deposit USDC from Stellar to Solana destination", async ({ page }) => {
    await useStellarSigner(page, E2E.stellar.secret)
    await startDepositPayment(page, {
      destChain: "Solana",
      destToken: "USDC",
      address: E2E.solana.address,
    })
    // Deposit requires a minimum of 0.1 USDC.
    await payInWithStellarHeadlessDeposit(page, "0.1")
    await waitForPayoutCompleted(page)
  })
})
