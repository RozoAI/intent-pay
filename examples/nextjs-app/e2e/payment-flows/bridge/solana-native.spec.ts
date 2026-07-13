/**
 * Payment flow E2E — Bridge: Solana SOL → EVM (Base) (mainnet, real funds).
 *
 * Source: Solana wallet via the Phantom extension (chainwright).
 * Destination: our EVM wallet address (E2E.evm.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_SOLANA_SEED_PHRASE is set.
 *
 * Setup:  set E2E_SOLANA_SEED_PHRASE (Phantom recovery phrase) in .env.e2e, then
 *         build the cached Phantom profile:  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:bridge-solana-native
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

// ponytail: WSOL mint from pay-common/src/token.ts solanaSOL.
const SOL_SOURCE_OPTION_ID = "501-So11111111111111111111111111111111111111112"

test.describe("Bridge: Solana SOL → Base (mainnet, real funds)", () => {
  test.skip(
    !E2E.solana.seedPhrase || !E2E.evm.address,
    "Set E2E_SOLANA_SEED_PHRASE and E2E_EVM_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "Solana SOL → EVM (Base)",
      status: testInfo.status,
    })
  })

  test("send SOL from Solana to EVM destination", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    getPayId = setupPaymentIdCapture(page)
    // Cached Phantom profile usually starts unlocked — only unlock if locked.
    await unlockPhantomIfNeeded(phantom, phantomPage)

    // ponytail: native SOL requires ~$1.00 USD minimum. Use 1.05 USDC
    // (destination amount = USD value) to stay above the threshold with buffer.
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
})
