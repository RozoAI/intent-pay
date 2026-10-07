/**
 * Payment flow E2E — Bridge: EVM native (ETH / BNB) → destination (real funds).
 *
 * Source: EVM wallet via the MetaMask extension (chainwright).
 * Destinations: Stellar / Arbitrum / Solana / Base, per test.
 *
 * THIS TEST MOVES REAL MONEY. Each test is skipped unless E2E_EVM_SEED_PHRASE
 * (and the destination address) is set.
 *
 * Setup:  cp .env.e2e.example .env.e2e  →  fill in  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  node e2e/run.cjs bridge-evm-native
 *
 * `ponytail:` amount comments hold the chain minimums observed from a dryrun
 * quote (2024-xx). If a route is disabled backend-side the option never enables;
 * tune the amount after the first funded run rather than guessing further.
 */
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { E2E } from "../../env"
import {
  payInWithMetaMask,
  startBridgePayment,
  waitForPayoutCompleted,
  reportPayment,
  setupPaymentIdCapture,
} from "../../helpers"

const test = testWithChainwright(metamaskFixture())

// ponytail: native source sentinels — EIP-7528 for EVM, System Program for SOL.
const ETH_BASE_SOURCE_OPTION_ID =
  "8453-0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
const BNB_BSC_SOURCE_OPTION_ID = "56-0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

test.describe("Bridge: EVM native → destination (mainnet, real funds)", () => {
  let getPayId: (() => string | undefined) | undefined
  // Reported per test — the afterEach must name the route that actually ran.
  let route = "EVM native → destination"

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
    route = "ETH on Base → Stellar USDC"
    getPayId = setupPaymentIdCapture(page)
    // Cached MetaMask profile starts locked — unlock before any popup can appear.
    await metamask.unlock()

    // ponytail: native ETH on Base requires ~$0.10 USD minimum.
    await startBridgePayment(page, {
      destChain: "Stellar",
      destToken: "USDC",
      address: E2E.stellar.address!,
      amount: "0.11",
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: ETH_BASE_SOURCE_OPTION_ID,
    })
    await waitForPayoutCompleted(page)
  })

  test("ETH on Base → Arbitrum USDC", async ({ page, metamask }) => {
    test.skip(
      !E2E.evm.seedPhrase || !E2E.evm.address,
      "Set E2E_EVM_SEED_PHRASE and E2E_EVM_ADDRESS in .env.e2e"
    )
    route = "ETH on Base → Arbitrum USDC"
    getPayId = setupPaymentIdCapture(page)
    await metamask.unlock()

    // Same-chain-family destination (EVM → EVM): verifies the native source
    // quote is accepted when the payout chain differs from Base.
    await startBridgePayment(page, {
      destChain: "Arbitrum",
      destToken: "USDC",
      address: E2E.evm.address!,
      amount: "0.11",
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: ETH_BASE_SOURCE_OPTION_ID,
    })
    await waitForPayoutCompleted(page)
  })

  test("ETH on Base → Solana USDC", async ({ page, metamask }) => {
    test.skip(
      !E2E.evm.seedPhrase || !E2E.solana.address,
      "Set E2E_EVM_SEED_PHRASE and E2E_SOLANA_ADDRESS in .env.e2e"
    )
    route = "ETH on Base → Solana USDC"
    getPayId = setupPaymentIdCapture(page)
    await metamask.unlock()

    // Solana payout adds a $0.20 chain minimum → 0.25 gives headroom.
    await startBridgePayment(page, {
      destChain: "Solana",
      destToken: "USDC",
      address: E2E.solana.address!,
      amount: "0.25",
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: ETH_BASE_SOURCE_OPTION_ID,
    })
    await waitForPayoutCompleted(page)
  })

  test("BNB on BSC → Base USDC", async ({ page, metamask }) => {
    test.skip(
      !E2E.evm.seedPhrase || !E2E.evm.address,
      "Set E2E_EVM_SEED_PHRASE and E2E_EVM_ADDRESS in .env.e2e"
    )
    route = "BNB on BSC → Base USDC"
    getPayId = setupPaymentIdCapture(page)
    await metamask.unlock()

    // BNB (BSC) is a native source with no existing funded coverage. Verified
    // viable by dryrun quote (source BNB@56, zero address); needs BNB gas funds
    // in the MetaMask profile on BSC.
    await startBridgePayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address!,
      amount: "0.11",
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: BNB_BSC_SOURCE_OPTION_ID,
    })
    await waitForPayoutCompleted(page)
  })
})
