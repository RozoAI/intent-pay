/**
 * Payment flow E2E — Deposit: Stellar USDC → EVM (Base) (mainnet, real funds).
 *
 * Same money movement as the Bridge stellar-to-evm flow, but driven through
 * Deposit mode: no upfront amount is configured — the amount is entered INSIDE
 * the SDK modal during pay-in. Source: a Stellar pool wallet via an in-page
 * headless signer (no extension — the test injects the wallet's secret; see
 * useStellarSigner). Destination: our EVM wallet address (E2E.evm.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless a Stellar secret is set
 * (E2E_STELLAR_SECRET in .env.e2e).
 *
 * Setup:  set the Stellar wallet in .env.e2e (see .env.e2e.example)
 * Run:    pnpm dev &  →  pnpm test:e2e:deposit-stellar-to-evm
 */
import { test } from "@playwright/test"
import { E2E } from "../../env"
import {
  payInWithStellarHeadlessDeposit,
  startDepositPayment,
  useStellarSigner,
  waitForPayoutCompleted,
  setupPaymentIdCapture,
  reportPayment,
} from "../../helpers"

test.describe("Deposit: Stellar USDC → Base (mainnet, real funds)", () => {
  test.skip(
    !E2E.stellar.secret || !E2E.evm.address,
    "Set E2E_STELLAR_SECRET and E2E_EVM_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "Stellar USDC → EVM (Base) (deposit)",
      status: testInfo.status,
    })
  })

  test("deposit USDC from Stellar to an EVM destination", async ({ page }) => {
    getPayId = setupPaymentIdCapture(page)
    // Drive the in-page headless signer with our Stellar secret — must run
    // before navigation.
    await useStellarSigner(page, E2E.stellar.secret)

    await startDepositPayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address,
    })
    // Deposit has no preset amount — enter it inside the modal during pay-in.
    // depositAmount respects E2E_AMOUNT but enforces the 0.1 USDC SDK minimum.
    await payInWithStellarHeadlessDeposit(page, E2E.depositAmount)
    await waitForPayoutCompleted(page)
  })
})
