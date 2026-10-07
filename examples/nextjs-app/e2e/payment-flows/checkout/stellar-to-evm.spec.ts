/**
 * Payment flow E2E — Checkout (payId): Stellar USDC → EVM (Base) (mainnet, real funds).
 *
 * Same money movement as bridge/stellar-to-evm, but via Checkout mode.
 * Source: Stellar headless in-page signer. Destination: E2E.evm.address.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_STELLAR_SECRET is set.
 *
 * Setup:  set E2E_STELLAR_SECRET in .env.e2e (see .env.e2e.example)
 * Run:    pnpm dev &  →  pnpm test:e2e:checkout-stellar-to-evm
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

test.describe("Checkout (payId): Stellar USDC → Base (mainnet, real funds)", () => {
  test.skip(
    !E2E.stellar.secret || !E2E.evm.address,
    "Set E2E_STELLAR_SECRET and E2E_EVM_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "Stellar USDC → EVM (Base) (checkout)",
      status: testInfo.status,
    })
  })

  test("create a payId then pay it with USDC from Stellar to EVM", async ({
    page,
  }) => {
    getPayId = setupPaymentIdCapture(page)
    await useStellarSigner(page, E2E.stellar.secret)

    await startCheckoutPayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address,
      amount: E2E.amount,
    })
    await payInWithStellarHeadless(page)
    await waitForPayoutCompleted(page)
  })
})
