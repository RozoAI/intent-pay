/**
 * Payment flow E2E — Deposit: Solana USDC → EVM (Base) (mainnet, real funds).
 *
 * Source: Solana wallet via Phantom (chainwright). Destination: E2E.evm.address.
 * No upfront amount — entered inside the SDK modal during pay-in.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_SOLANA_SEED_PHRASE is set.
 *
 * Setup:  set E2E_SOLANA_SEED_PHRASE in .env.e2e  →  pnpm setup-wallets
 * Run:    pnpm dev &  →  pnpm test:e2e:deposit-solana-to-evm
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

test.describe("Deposit: Solana USDC → EVM (Base) (mainnet, real funds)", () => {
  test.skip(
    !E2E.solana.seedPhrase || !E2E.evm.address,
    "Set E2E_SOLANA_SEED_PHRASE and E2E_EVM_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "Solana USDC → EVM (Base) (deposit)",
      status: testInfo.status,
    })
  })

  test("deposit USDC from Solana to EVM destination", async ({
    page,
    phantom,
    phantomPage,
  }) => {
    getPayId = setupPaymentIdCapture(page)
    await unlockPhantomIfNeeded(phantom, phantomPage)
    await startDepositPayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address,
    })
    await payInWithPhantom(page, phantom, {
      sourceOptionId: E2E.solana.sourceOptionId,
      // depositAmount respects E2E_AMOUNT but enforces the 0.1 USDC SDK minimum.
      amount: E2E.depositAmount,
    })
    await waitForPayoutCompleted(page)
  })
})
