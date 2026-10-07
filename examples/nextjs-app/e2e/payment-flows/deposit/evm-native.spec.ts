/**
 * Payment flow E2E — Deposit: EVM native (ETH / BNB) → Stellar (real funds).
 *
 * Deposit mode sets no upfront amount; the source amount is entered inside the
 * SDK modal after selecting the source token. Source: EVM wallet via the
 * MetaMask extension (chainwright). Destination: our Stellar wallet address.
 *
 * THIS TEST MOVES REAL MONEY. Each test is skipped unless E2E_EVM_SEED_PHRASE
 * and E2E_STELLAR_ADDRESS are set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  node e2e/run.cjs deposit-evm-native
 */
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { E2E } from "../../env"
import {
  payInWithMetaMask,
  startDepositPayment,
  waitForPayoutCompleted,
  setupPaymentIdCapture,
  reportPayment,
} from "../../helpers"

const test = testWithChainwright(metamaskFixture())

// ponytail: native source sentinels — EIP-7528 (viem/ethAddress).
const ETH_BASE_SOURCE_OPTION_ID =
  "8453-0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
const BNB_BSC_SOURCE_OPTION_ID = "56-0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

test.describe("Deposit: EVM native → Stellar (mainnet, real funds)", () => {
  let getPayId: (() => string | undefined) | undefined
  let route = "EVM native → Stellar (deposit)"

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route,
      status: testInfo.status,
    })
  })

  test("ETH on Base → Stellar USDC", async ({ page, metamask }) => {
    test.skip(
      !E2E.evm.seedPhrase || !E2E.stellar.address,
      "Set E2E_EVM_SEED_PHRASE and E2E_STELLAR_ADDRESS in .env.e2e"
    )
    route = "ETH on Base → Stellar USDC (deposit)"
    getPayId = setupPaymentIdCapture(page)
    // Cached MetaMask profile starts locked — unlock before any popup can appear.
    await metamask.unlock()

    await startDepositPayment(page, {
      destChain: "Stellar",
      destToken: "USDC",
      address: E2E.stellar.address!,
    })
    // ponytail: native ETH on Base requires ~$0.10 USD minimum. depositAmount
    // respects E2E_AMOUNT but enforces the SDK minimum.
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: ETH_BASE_SOURCE_OPTION_ID,
      amount: E2E.depositAmount,
    })
    await waitForPayoutCompleted(page)
  })

  test("BNB on BSC → Stellar USDC", async ({ page, metamask }) => {
    test.skip(
      !E2E.evm.seedPhrase || !E2E.stellar.address,
      "Set E2E_EVM_SEED_PHRASE and E2E_STELLAR_ADDRESS in .env.e2e"
    )
    route = "BNB on BSC → Stellar USDC (deposit)"
    getPayId = setupPaymentIdCapture(page)
    await metamask.unlock()

    // BNB (BSC) native source, deposit-address flow. Verified viable by dryrun
    // quote (source BNB@56); needs BNB funds on BSC.
    await startDepositPayment(page, {
      destChain: "Stellar",
      destToken: "USDC",
      address: E2E.stellar.address!,
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: BNB_BSC_SOURCE_OPTION_ID,
      amount: E2E.depositAmount,
    })
    await waitForPayoutCompleted(page)
  })
})
