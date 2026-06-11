/**
 * Payment flow E2E — Stellar USDC → Solana (mainnet, real funds).
 *
 * Source: our Stellar wallet via an in-page headless signer (no extension —
 *         the test injects the secret; see useStellarSigner).
 * Destination: a Solana address (E2E.solana.address) on rozoSolana (chainId 900).
 *
 * No Solana signer is needed here — Solana is only the DESTINATION, so we just
 * pay out to its address. (Solana → Stellar, which needs a headless Solana
 * source signer, comes later.)
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless a Stellar secret is set
 * (E2E_STELLAR_SECRET in .env.e2e).
 *
 * Setup:  set the Stellar wallet + E2E_SOLANA_ADDRESS in .env.e2e
 * Run:    pnpm dev &  →  pnpm test:e2e:stellar-to-solana
 */
import { test } from "@playwright/test"
import { E2E } from "../../env"
import {
  payInWithStellarHeadless,
  startBridgePayment,
  useStellarSigner,
  waitForPayoutCompleted,
} from "../../helpers"

test.describe("Bridge: Stellar USDC → Solana (mainnet, real funds)", () => {
  test.skip(
    !E2E.stellar.secret,
    "No Stellar secret — set E2E_STELLAR_SECRET in .env.e2e"
  )

  test("send USDC from Stellar to Solana destination", async ({ page }) => {
    // Drive the in-page headless signer with our Stellar secret — must run
    // before navigation.
    await useStellarSigner(page, E2E.stellar.secret)

    await startBridgePayment(page, {
      destChain: "Solana",
      destToken: "USDC",
      address: E2E.solana.address,
      amount: E2E.amount,
    })
    await payInWithStellarHeadless(page)
    await waitForPayoutCompleted(page)
  })
})
