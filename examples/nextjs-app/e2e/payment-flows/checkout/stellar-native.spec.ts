/**
 * Payment flow E2E — Checkout (payId): Stellar XLM → EVM (Base) (mainnet, real funds).
 *
 * THIS TEST IS CURRENTLY DISABLED. Checkout creates a server-side payId, and
 * the SDK's Stellar pay-in component explicitly rejects native-token sources
 * in payId mode (see PayWithStellarToken: `isPayIdMode && isNativeToken`).
 *
 * Source: Stellar wallet via the in-page headless signer.
 * Destination: our EVM wallet address (E2E.evm.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_STELLAR_SECRET and
 * E2E_EVM_ADDRESS are set.
 *
 * Setup:  set E2E_STELLAR_SECRET and E2E_EVM_ADDRESS in .env.e2e
 * Run:    pnpm dev &  →  pnpm test:e2e:checkout-stellar-native
 */
import { test } from "@playwright/test"
import { E2E } from "../../env"
import {
  payInWithStellarHeadless,
  setupPaymentIdCapture,
  reportPayment,
  startCheckoutPayment,
  useStellarSigner,
  waitForPayoutCompleted,
} from "../../helpers"

test.describe("Checkout (payId): Stellar XLM → EVM (Base) (mainnet, real funds)", () => {
  test.skip(
    !E2E.stellar.secret || !E2E.evm.address,
    "Set E2E_STELLAR_SECRET and E2E_EVM_ADDRESS in .env.e2e"
  )
  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "Stellar XLM → EVM (Base) checkout",
      status: testInfo.status,
    })
  })

  test.fixme("create a payId then pay it with XLM from Stellar to EVM", async ({
    page,
  }) => {
    getPayId = setupPaymentIdCapture(page)
    await useStellarSigner(page, E2E.stellar.secret!)

    // ponytail: native XLM requires ~$0.10 USD minimum. Use 0.11 USDC
    // (destination amount = USD value) to stay above the threshold with buffer.
    await startCheckoutPayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address!,
      amount: "0.11",
    })

    await payInWithStellarHeadless(page, /XLM/i)
    await waitForPayoutCompleted(page)
  })
})
