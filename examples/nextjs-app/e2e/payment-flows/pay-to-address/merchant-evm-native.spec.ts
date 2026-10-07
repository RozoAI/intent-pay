/**
 * Payment flow E2E — Pay-to-address: EVM native (ETH on Base / BNB on BSC) → merchant.
 *
 * Creates a merchant payId, opens the SDK modal, selects "Pay to address",
 * chooses the native deposit chain, reads the deposit address + amount, and sends
 * the native coin via a raw viem sendTransaction from the E2E seed-phrase wallet.
 *
 * THIS TEST MOVES REAL MONEY. Each test is skipped unless E2E_MERCHANT_APP_ID and
 * E2E_EVM_SEED_PHRASE are set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  node e2e/run.cjs merchant-evm-native-pay-to-address
 */
import { test, expect, type Page } from "@playwright/test"
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Chain,
} from "viem"
import { base, bsc } from "viem/chains"
import { mnemonicToAccount } from "viem/accounts"
import { E2E } from "../../env"
import {
  getDepositAddressInfo,
  reportPayment,
  startMerchantDepositAddressCheckout,
  waitForPayoutCompleted,
} from "../../helpers"

// ponytail: native sources require ~$0.10 USD minimum. Merchant amount in local
// currency (RM); 0.50 RM ≈ $0.11-$0.13 USD, safely above the threshold.
const NATIVE_MIN_RM = "0.50"

/**
 * The deposit catalog labels native rows `"{SYMBOL} on {chainName}"` (observed
 * live: `ETH on Base`, `BNB on BNB`), but older `DepositAddressPaymentOptions`
 * enum ids (`Base`, `BSC`) still name the same chains. Match either, so the spec
 * survives a backend label change without a false failure.
 */
function depositOption(page: Page, ids: string[]) {
  return page.locator(
    ids.map((id) => `[data-testid="rozopay-option-${id}"]`).join(", ")
  )
}

async function payToAddressWithNative(
  page: Page,
  opts: {
    sourceChainId: string
    tokenSymbol: string
    chain: Chain
    optionIds: string[]
  }
): Promise<string> {
  const payId = await startMerchantDepositAddressCheckout(page, {
    apiUrl: E2E.merchant.apiUrl,
    appId: E2E.merchant.appId!,
    amountLocal: NATIVE_MIN_RM,
    currencyLocal: E2E.merchant.currencyLocal,
    source: { chainId: opts.sourceChainId, tokenSymbol: opts.tokenSymbol },
  })

  // SELECT_METHOD → "Pay to address"
  const payToAddressOption = page.getByTestId("rozopay-option-depositAddress")
  await expect(payToAddressOption).toBeVisible({ timeout: 30_000 })
  await payToAddressOption.click()

  // SELECT_DEPOSIT_ADDRESS_CHAIN → native option for this chain.
  const chainNativeOption = depositOption(page, opts.optionIds)
  await expect(chainNativeOption).toBeVisible({ timeout: 30_000 })
  await chainNativeOption.click()

  // WAITING_DEPOSIT_ADDRESS: read amount + address.
  const { amount, address } = await getDepositAddressInfo(page)
  if (!address || !amount) {
    throw new Error(
      `Missing deposit address info: address=${address}, amount=${amount}`
    )
  }

  const account = mnemonicToAccount(E2E.evm.seedPhrase!)
  const walletClient = createWalletClient({
    account,
    chain: opts.chain,
    transport: http(),
  })
  const publicClient = createPublicClient({
    chain: opts.chain,
    transport: http(),
  })

  const txHash = await walletClient.sendTransaction({
    to: address as `0x${string}`,
    value: parseEther(amount),
  })
  await publicClient.waitForTransactionReceipt({ hash: txHash })

  await waitForPayoutCompleted(page)
  return payId
}

test.describe("Pay-to-address: EVM native → merchant (mainnet, real funds)", () => {
  let payId: string | undefined
  let route = "EVM native → merchant deposit address"

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId,
      route,
      status: testInfo.status,
    })
  })

  test("deposit ETH on Base to a merchant deposit address", async ({
    page,
  }) => {
    test.skip(
      !E2E.merchant.appId || !E2E.evm.seedPhrase,
      "Set E2E_MERCHANT_APP_ID and E2E_EVM_SEED_PHRASE in .env.e2e"
    )
    route = "ETH on Base → merchant deposit address"
    payId = await payToAddressWithNative(page, {
      sourceChainId: "8453",
      tokenSymbol: "ETH",
      chain: base,
      optionIds: ["ETH on Base", "Base"],
    })
  })

  test("deposit BNB on BSC to a merchant deposit address", async ({ page }) => {
    test.skip(
      !E2E.merchant.appId || !E2E.evm.seedPhrase,
      "Set E2E_MERCHANT_APP_ID and E2E_EVM_SEED_PHRASE in .env.e2e"
    )
    route = "BNB on BSC → merchant deposit address"
    payId = await payToAddressWithNative(page, {
      sourceChainId: "56",
      tokenSymbol: "BNB",
      chain: bsc,
      optionIds: ["BNB on BNB", "BSC"],
    })
  })
})
