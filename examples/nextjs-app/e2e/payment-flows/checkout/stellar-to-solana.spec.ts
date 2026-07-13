/**
 * Payment flow E2E — Checkout (payId): Stellar USDC → Solana (mainnet, real funds).
 *
 * Source: Stellar headless in-page signer. Destination: E2E.solana.address.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_STELLAR_SECRET is set.
 *
 * Run:  pnpm dev &  →  pnpm test:e2e:checkout-stellar-to-solana
 */
import { test } from "@playwright/test"
import { E2E } from "../../env"
import {
  payInWithStellarHeadless,
  startCheckoutPayment,
  useStellarSigner,
  waitForPayoutCompleted,
  setupPaymentIdCapture,
  reportPayment,
} from "../../helpers"

test.describe("Checkout (payId): Stellar USDC → Solana (mainnet, real funds)", () => {
  test.skip(
    !E2E.stellar.secret || !E2E.solana.address,
    "Set E2E_STELLAR_SECRET and E2E_SOLANA_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "Stellar USDC → Solana (checkout)",
      status: testInfo.status,
    })
  })

  test("create a payId then pay it with USDC from Stellar to Solana", async ({
    page,
  }) => {
    getPayId = setupPaymentIdCapture(page)
    await useStellarSigner(page, E2E.stellar.secret)
    await startCheckoutPayment(page, {
      destChain: "Solana",
      destToken: "USDC",
      address: E2E.solana.address,
      amount: E2E.amount,
    })
    await payInWithStellarHeadless(page)
    await waitForPayoutCompleted(page)
  })
})
