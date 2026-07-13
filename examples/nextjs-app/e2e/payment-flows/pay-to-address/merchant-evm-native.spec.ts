/**
 * Payment flow E2E — Pay-to-address: ETH on Base → merchant (mainnet, real funds).
 *
 * Creates a merchant payId, opens the SDK modal, selects "Pay to address",
 * chooses ETH on Base (native), reads the deposit address + amount, and sends
 * ETH via a raw viem sendTransaction from the E2E seed-phrase wallet.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_MERCHANT_APP_ID and
 * E2E_EVM_SEED_PHRASE are set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  node e2e/run.cjs merchant-evm-native-pay-to-address
 */
import { test, expect } from "@playwright/test"
import { createPublicClient, createWalletClient, http, parseEther } from "viem"
import { base } from "viem/chains"
import { mnemonicToAccount } from "viem/accounts"
import { E2E } from "../../env"
import {
  getDepositAddressInfo,
  reportPayment,
  startMerchantDepositAddressCheckout,
  waitForPayoutCompleted,
} from "../../helpers"

// ponytail: native ETH on Base requires ~$0.10 USD minimum. Merchant amount in
// local currency (RM); 0.50 RM ≈ $0.11-$0.13 USD, safely above threshold.
const ETH_BASE_MIN_RM = "0.50"

test.describe("Pay-to-address: ETH on Base → merchant (mainnet, real funds)", () => {
  test.skip(
    !E2E.merchant.appId || !E2E.evm.seedPhrase,
    "Set E2E_MERCHANT_APP_ID and E2E_EVM_SEED_PHRASE in .env.e2e"
  )

  let payId: string | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId,
      route: "ETH on Base → merchant deposit address",
      status: testInfo.status,
    })
  })

  test("create a merchant payId, deposit ETH on Base, and confirm", async ({
    page,
  }) => {
    payId = await startMerchantDepositAddressCheckout(page, {
      apiUrl: E2E.merchant.apiUrl,
      appId: E2E.merchant.appId!,
      amountLocal: ETH_BASE_MIN_RM,
      currencyLocal: E2E.merchant.currencyLocal,
      source: { chainId: "8453", tokenSymbol: "ETH" },
    })

    // SELECT_METHOD → "Pay to address"
    const payToAddressOption = page.getByTestId("rozopay-option-depositAddress")
    await expect(payToAddressOption).toBeVisible({ timeout: 30_000 })
    await payToAddressOption.click()

    // SELECT_DEPOSIT_ADDRESS_CHAIN → ETH on Base (native)
    // DepositAddressPaymentOptions.BASE = "Base"
    const baseNativeOption = page.getByTestId("rozopay-option-Base")
    await expect(baseNativeOption).toBeVisible({ timeout: 30_000 })
    await baseNativeOption.click()

    // WAITING_DEPOSIT_ADDRESS: read amount + address
    const { amount, address } = await getDepositAddressInfo(page)

    if (!address || !amount) {
      throw new Error(
        `Missing deposit address info: address=${address}, amount=${amount}`
      )
    }

    // Send ETH from the seed-phrase wallet to the deposit address.
    const account = mnemonicToAccount(E2E.evm.seedPhrase!)
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(),
    })
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    })

    const txHash = await walletClient.sendTransaction({
      to: address as `0x${string}`,
      value: parseEther(amount),
    })

    await publicClient.waitForTransactionReceipt({ hash: txHash })

    await waitForPayoutCompleted(page)
  })
})
