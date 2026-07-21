/**
 * Payment flow E2E — Pay-to-address: USDC on Base → merchant (mainnet, real funds).
 *
 * Creates a merchant payId, opens the SDK modal, selects "Pay to address",
 * chooses USDC on Base, reads the deposit address + amount, and sends USDC
 * via a raw ERC-20 transfer from the E2E seed-phrase wallet.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_MERCHANT_APP_ID and
 * E2E_EVM_SEED_PHRASE are set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  node e2e/run.js merchant-evm-pay-to-address
 */
import { test, expect } from "@playwright/test"
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  getAddress,
} from "viem"
import { base } from "viem/chains"
import { mnemonicToAccount } from "viem/accounts"
import { E2E } from "../../env"
import {
  getDepositAddressInfo,
  reportPayment,
  startMerchantDepositAddressCheckout,
  waitForPayoutCompleted,
} from "../../helpers"

// ponytail: minimal ERC-20 ABI — only transfer needed.
const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

// USDC on Base — 6 decimals.
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

// ponytail: USDC on Base requires ~$0.10 USD minimum. Merchant amount in local
// currency (RM); 0.50 RM ≈ $0.11-$0.13 USD, safely above threshold.
const USDC_MAINNET_MIN_RM = "0.50"

test.describe("Pay-to-address: USDC on Base → merchant (mainnet, real funds)", () => {
  test.skip(
    !E2E.merchant.appId || !E2E.evm.seedPhrase,
    "Set E2E_MERCHANT_APP_ID and E2E_EVM_SEED_PHRASE in .env.e2e"
  )

  let payId: string | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId,
      route: "USDC on Base → merchant deposit address",
      status: testInfo.status,
    })
  })

  test("create a merchant payId, deposit USDC on Base, and confirm", async ({
    page,
  }) => {
    payId = await startMerchantDepositAddressCheckout(page, {
      apiUrl: E2E.merchant.apiUrl,
      appId: E2E.merchant.appId!,
      amountLocal: USDC_MAINNET_MIN_RM,
      currencyLocal: E2E.merchant.currencyLocal,
      source: { chainId: "8453", tokenSymbol: "USDC" },
    })

    // SELECT_METHOD → "Pay to address"
    const payToAddressOption = page.getByTestId("rozopay-option-depositAddress")
    await expect(payToAddressOption).toBeVisible({ timeout: 30_000 })
    await payToAddressOption.click()

    // SELECT_DEPOSIT_ADDRESS_CHAIN → USDC on Base
    const baseUsdcOption = page.getByTestId("rozopay-option-USDC on Base")
    await expect(baseUsdcOption).toBeVisible({ timeout: 30_000 })
    await baseUsdcOption.click()

    // WAITING_DEPOSIT_ADDRESS: read amount + address
    const { amount, address } = await getDepositAddressInfo(page)

    if (!address || !amount) {
      throw new Error(
        `Missing deposit address info: address=${address}, amount=${amount}`
      )
    }

    // Send USDC from the seed-phrase wallet via raw ERC-20 transfer.
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

    const txHash = await walletClient.writeContract({
      address: BASE_USDC_ADDRESS,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [getAddress(address), parseUnits(amount, 6)],
    })

    await publicClient.waitForTransactionReceipt({ hash: txHash })

    await waitForPayoutCompleted(page)
  })
})
