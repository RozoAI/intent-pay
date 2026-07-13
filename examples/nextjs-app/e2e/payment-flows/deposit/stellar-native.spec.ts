/**
 * Payment flow E2E — Deposit: Stellar XLM → EVM (Base) (mainnet, real funds).
 *
 * Deposit mode sets no upfront amount; the XLM amount is entered inside the
 * SDK modal after selecting the source token. Source: Stellar wallet via the
 * in-page headless signer. Destination: our EVM wallet address
 * (E2E.evm.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_STELLAR_SECRET and
 * E2E_EVM_ADDRESS are set.
 *
 * Setup:  set E2E_STELLAR_SECRET and E2E_EVM_ADDRESS in .env.e2e
 * Run:    pnpm dev &  →  pnpm test:e2e:deposit-stellar-native
 */
import { test } from "@playwright/test"
import { E2E } from "../../env"
import {
  payInWithStellarHeadlessDeposit,
  setupPaymentIdCapture,
  reportPayment,
  startDepositPayment,
  useStellarSigner,
  waitForPayoutCompleted,
} from "../../helpers"

// ponytail: native XLM minimum is ~$0.10 USD. 1.0 XLM safely clears the
// threshold at typical prices (~$0.15–$0.20/XLM) while keeping the test amount
// small. Increase if your wallet balance requires it.
const XLM_DEPOSIT_AMOUNT = "1.0"

test.describe("Deposit: Stellar XLM → EVM (Base) (mainnet, real funds)", () => {
  test.skip(
    !E2E.stellar.secret || !E2E.evm.address,
    "Set E2E_STELLAR_SECRET and E2E_EVM_ADDRESS in .env.e2e"
  )
  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "Stellar XLM → EVM (Base) deposit",
      status: testInfo.status,
    })
  })

  test("deposit XLM from Stellar to an EVM destination", async ({ page }) => {
    getPayId = setupPaymentIdCapture(page)
    await useStellarSigner(page, E2E.stellar.secret!)

    await startDepositPayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address!,
    })

    await payInWithStellarHeadlessDeposit(page, XLM_DEPOSIT_AMOUNT, /XLM/i)
    await waitForPayoutCompleted(page)
  })
})
