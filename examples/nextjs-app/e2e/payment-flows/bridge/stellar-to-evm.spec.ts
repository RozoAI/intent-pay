/**
 * Payment flow E2E — Stellar USDC → EVM (Base) (mainnet, real funds).
 *
 * Source: a Stellar pool wallet via an in-page headless signer (no extension —
 *         the test injects the wallet's secret; see useStellarSigner).
 * Destination: our EVM wallet address (E2E.evm.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless a Stellar secret is set
 * (E2E_STELLAR_SECRET in .env.e2e).
 *
 * Setup:  set the Stellar wallet in .env.e2e (see .env.e2e.example)
 * Run:    pnpm dev &  →  pnpm test:e2e:stellar-to-evm
 */
import { test } from "@playwright/test"
import { E2E } from "../../env"
import {
  payInWithStellarHeadless,
  startBridgePayment,
  useStellarSigner,
  waitForPayoutCompleted,
} from "../../helpers"

test.describe("Bridge: Stellar USDC → Base (mainnet, real funds)", () => {
  test.skip(
    !E2E.stellar.secret || !E2E.evm.address,
    "Set E2E_STELLAR_SECRET and E2E_EVM_ADDRESS in .env.e2e"
  )

  test("send USDC from Stellar to EVM destination", async ({ page }) => {
    // Drive the in-page headless signer with our Stellar secret — must run
    // before navigation.
    await useStellarSigner(page, E2E.stellar.secret)

    await startBridgePayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address,
      amount: E2E.amount,
    })
    await payInWithStellarHeadless(page)
    await waitForPayoutCompleted(page)
  })
})
