/**
 * Payment flow E2E — Deposit: Solana SOL → EVM (Base) (mainnet, real funds).
 *
 * Deposit mode sets no upfront amount; the SOL amount is entered inside the
 * SDK modal after selecting the source token. Source: Solana wallet via the
 * Phantom extension (chainwright). Destination: our EVM wallet address
 * (E2E.evm.address).
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_SOLANA_SEED_PHRASE is set.
 *
 * Setup:  set E2E_SOLANA_SEED_PHRASE (Phantom recovery phrase) in .env.e2e, then
 *         build the cached Phantom profile:  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:deposit-solana-native
 */
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import {
  payInWithPhantom,
  startDepositPayment,
  unlockPhantomIfNeeded,
  waitForPayoutCompleted,
  setupPaymentIdCapture,
  reportPayment,
} from "../../helpers"

const test = testWithChainwright(phantomFixture())

// ponytail: WSOL mint from pay-common/src/token.ts solanaSOL.
const SOL_SOURCE_OPTION_ID = "501-So11111111111111111111111111111111111111112"

test.describe("Deposit: Solana SOL → EVM (Base) (mainnet, real funds)", () => {
  test.skip(
    !E2E.solana.seedPhrase || !E2E.evm.address,
    "Set E2E_SOLANA_SEED_PHRASE and E2E_EVM_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "Solana SOL → EVM (Base) (deposit)",
      status: testInfo.status,
    })
  })

  test("deposit SOL from Solana to EVM destination", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    getPayId = setupPaymentIdCapture(page)
    await unlockPhantomIfNeeded(phantom, phantomPage)

    await startDepositPayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address!,
    })
    // ponytail: native SOL requires ~$1.00 USD minimum. depositAmount
    // respects E2E_AMOUNT but enforces the SDK minimum.
    await payInWithPhantom(page, phantom, {
      sourceOptionId: SOL_SOURCE_OPTION_ID,
      amount: E2E.depositAmount,
    })
    await waitForPayoutCompleted(page)
  })
})
