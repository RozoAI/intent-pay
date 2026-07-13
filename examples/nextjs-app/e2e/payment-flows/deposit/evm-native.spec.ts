/**
 * Payment flow E2E — Deposit: EVM ETH → Stellar (mainnet, real funds).
 *
 * Deposit mode sets no upfront amount; the ETH amount is entered inside the
 * SDK modal after selecting the source token. Source: EVM wallet via the
 * MetaMask extension (chainwright). Destination: our Stellar wallet address
 * (E2E.stellar.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_EVM_SEED_PHRASE is set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:deposit-evm-native
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

// ponytail: ETH sentinel address from viem/ethAddress (EIP-7528).
const ETH_SOURCE_OPTION_ID = "8453-0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEE9E"

test.describe("Deposit: EVM ETH → Stellar (mainnet, real funds)", () => {
  test.skip(
    !E2E.evm.seedPhrase || !E2E.stellar.address,
    "Set E2E_EVM_SEED_PHRASE and E2E_STELLAR_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "EVM ETH → Stellar (deposit)",
      status: testInfo.status,
    })
  })

  test("deposit ETH from EVM to a Stellar destination", async ({
    page,
    metamask,
  }) => {
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
      sourceOptionId: ETH_SOURCE_OPTION_ID,
      amount: E2E.depositAmount,
    })
    await waitForPayoutCompleted(page)
  })
})
