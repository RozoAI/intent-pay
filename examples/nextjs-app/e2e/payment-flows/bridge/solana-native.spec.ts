/**
 * Payment flow E2E — Bridge: Solana SOL → destination (mainnet, real funds).
 *
 * Source: Solana wallet via the Phantom extension (chainwright).
 * Destinations: Base / Stellar, per test.
 *
 * THIS TEST MOVES REAL MONEY. Each test is skipped unless
 * E2E_SOLANA_SEED_PHRASE (and the destination address) is set.
 *
 * Setup:  set E2E_SOLANA_SEED_PHRASE (Phantom recovery phrase) in .env.e2e, then
 *         build the cached Phantom profile:  pnpm setup-wallets
 * Run:    pnpm dev &  →  node e2e/run.cjs bridge-solana-native
 */
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import {
  payInWithPhantom,
  startBridgePayment,
  unlockPhantomIfNeeded,
  waitForPayoutCompleted,
  reportPayment,
  setupPaymentIdCapture,
} from "../../helpers"

const test = testWithChainwright(phantomFixture())

// Native SOL is the System Program, never the WSOL mint.
const SOL_SOURCE_OPTION_ID = "501-11111111111111111111111111111111"

test.describe("Bridge: Solana SOL → destination (mainnet, real funds)", () => {
  let getPayId: (() => string | undefined) | undefined
  let route = "Solana SOL → destination"

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route,
      status: testInfo.status,
    })
  })

  test("SOL → Base USDC", async ({ page, phantom, phantomPage }) => {
    test.skip(
      !E2E.solana.seedPhrase || !E2E.evm.address,
      "Set E2E_SOLANA_SEED_PHRASE and E2E_EVM_ADDRESS in .env.e2e"
    )
    route = "Solana SOL → Base USDC"
    getPayId = setupPaymentIdCapture(page)
    // Cached Phantom profile usually starts unlocked — only unlock if locked.
    await unlockPhantomIfNeeded(phantom, phantomPage)

    // ponytail: native SOL requires ~$1.00 USD minimum.
    await startBridgePayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address!,
      amount: "1.05",
    })
    await payInWithPhantom(page, phantom, {
      sourceOptionId: SOL_SOURCE_OPTION_ID,
    })
    await waitForPayoutCompleted(page)
  })

  test("SOL → Stellar USDC", async ({ page, phantom, phantomPage }) => {
    test.skip(
      !E2E.solana.seedPhrase || !E2E.stellar.address,
      "Set E2E_SOLANA_SEED_PHRASE and E2E_STELLAR_ADDRESS in .env.e2e"
    )
    route = "Solana SOL → Stellar USDC"
    getPayId = setupPaymentIdCapture(page)
    await unlockPhantomIfNeeded(phantom, phantomPage)

    // Destination variety for a native SOL source (previously only Base).
    await startBridgePayment(page, {
      destChain: "Stellar",
      destToken: "USDC",
      address: E2E.stellar.address!,
      amount: "1.05",
    })
    await payInWithPhantom(page, phantom, {
      sourceOptionId: SOL_SOURCE_OPTION_ID,
    })
    await waitForPayoutCompleted(page)
  })
})
