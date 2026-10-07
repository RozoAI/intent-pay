/**
 * Payment flow E2E — Pay-to-address: USDC on Solana → merchant (mainnet, real funds).
 *
 * Creates a merchant payId, opens the SDK modal, selects "Pay to address",
 * chooses USDC on Solana, reads the deposit address + amount, and sends USDC
 * via a raw SPL token transfer.
 *
 * THIS TEST IS CURRENTLY DISABLED. Raw Solana SPL transfers require
 * @solana/web3.js which is not yet a dependency of this package.
 * To unblock: add @solana/web3.js + @solana/spl-token to package.json,
 * then implement the transfer using Connection + createTransferInstruction.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_MERCHANT_APP_ID and
 * E2E_SOLANA_SEED_PHRASE are set.
 *
 * Setup:  set E2E_MERCHANT_APP_ID and E2E_SOLANA_SEED_PHRASE in .env.e2e
 * Run:    pnpm dev &  →  node e2e/run.cjs merchant-solana-pay-to-address
 */
import { test, expect } from "@playwright/test"
import { E2E } from "../../env"
import {
  getDepositAddressInfo,
  reportPayment,
  startMerchantDepositAddressCheckout,
} from "../../helpers"

// ponytail: USDC on Solana requires ~$0.01 USD minimum. Merchant amount in
// local currency (RM); 0.50 RM ≈ $0.11-$0.13 USD, safely above threshold.
const USDC_MAINNET_MIN_RM = "0.50"

test.describe("Pay-to-address: USDC on Solana → merchant (mainnet, real funds)", () => {
  test.skip(
    !E2E.merchant.appId || !E2E.solana.seedPhrase,
    "Set E2E_MERCHANT_APP_ID and E2E_SOLANA_SEED_PHRASE in .env.e2e"
  )

  let payId: string | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId,
      route: "USDC on Solana → merchant deposit address",
      status: testInfo.status,
    })
  })

  test.fixme("create a merchant payId, deposit USDC on Solana, and confirm", // ponytail: blocked — add @solana/web3.js + @solana/spl-token to unblock.
  async ({ page }) => {
    payId = await startMerchantDepositAddressCheckout(page, {
      apiUrl: E2E.merchant.apiUrl,
      appId: E2E.merchant.appId!,
      amountLocal: USDC_MAINNET_MIN_RM,
      currencyLocal: E2E.merchant.currencyLocal,
      source: { chainId: "501", tokenSymbol: "USDC" },
    })

    // SELECT_METHOD → "Pay to address"
    const payToAddressOption = page.getByTestId("rozopay-option-depositAddress")
    await expect(payToAddressOption).toBeVisible({ timeout: 30_000 })
    await payToAddressOption.click()

    // SELECT_DEPOSIT_ADDRESS_CHAIN → USDC on Solana
    const solanaUsdcOption = page.getByTestId("rozopay-option-USDC on Solana")
    await expect(solanaUsdcOption).toBeVisible({ timeout: 30_000 })
    await solanaUsdcOption.click()

    // WAITING_DEPOSIT_ADDRESS: read amount + address
    const { amount, address } = await getDepositAddressInfo(page)

    if (!address || !amount) {
      throw new Error(
        `Missing deposit address info: address=${address}, amount=${amount}`
      )
    }

    // TODO: send SPL USDC transfer once @solana/web3.js is available.
    // const connection = new Connection("https://api.mainnet-beta.solana.com")
    // const payer = Keypair.fromSecretKey(bs58.decode(E2E.solana.seedPhrase!))
    // ... createTransferInstruction + sendAndConfirmTransaction
    throw new Error("Not implemented: add @solana/web3.js + @solana/spl-token")
  })
})
