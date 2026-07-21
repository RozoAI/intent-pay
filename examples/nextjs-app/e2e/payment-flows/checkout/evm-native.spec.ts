/**
 * Payment flow E2E — Checkout (payId): EVM ETH → Stellar (mainnet, real funds).
 *
 * Same money movement as the Bridge evm-to-stellar flow, but driven through
 * Checkout mode: the order is created server-side via createPayment() first,
 * returning a payId the SDK pays against. Source: EVM wallet via the MetaMask
 * extension (chainwright). Destination: our Stellar wallet (E2E.stellar.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_EVM_SEED_PHRASE is set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:checkout-evm-native
 */
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { E2E } from "../../env"
import {
  payInWithMetaMask,
  startCheckoutPayment,
  waitForPayoutCompleted,
  reportPayment,
  setupPaymentIdCapture,
} from "../../helpers"

const test = testWithChainwright(metamaskFixture())

// ponytail: ETH sentinel address from viem/ethAddress (EIP-7528).
const ETH_SOURCE_OPTION_ID = "8453-0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEE9E"

test.describe("Checkout (payId): EVM ETH → Stellar (mainnet, real funds)", () => {
  test.skip(
    !E2E.evm.seedPhrase || !E2E.stellar.address,
    "Set E2E_EVM_SEED_PHRASE and E2E_STELLAR_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "EVM ETH → Stellar (checkout)",
      status: testInfo.status,
    })
  })

  test("create a payId then pay it with ETH from EVM to Stellar", async ({
    page,
    metamask,
  }) => {
    getPayId = setupPaymentIdCapture(page)
    // Cached MetaMask profile starts locked — unlock before any popup can appear.
    await metamask.unlock()

    // ponytail: native ETH on Base requires ~$0.10 USD minimum. Use 0.11 USDC
    // (destination amount = USD value) to stay above the threshold.
    await startCheckoutPayment(page, {
      destChain: "Stellar",
      destToken: "USDC",
      address: E2E.stellar.address!,
      amount: "0.11",
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: ETH_SOURCE_OPTION_ID,
    })
    await waitForPayoutCompleted(page)
  })
})
