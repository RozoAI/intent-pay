/**
 * Payment flow E2E — Deposit: EVM USDC → Solana (mainnet, real funds).
 *
 * Source: EVM wallet via MetaMask (chainwright). Destination: E2E.solana.address.
 * No upfront amount — entered inside the SDK modal during pay-in.
 *
 * THIS TEST MOVES REAL MONEY. Skipped unless E2E_EVM_SEED_PHRASE is set.
 *
 * Run:  pnpm dev &  →  pnpm test:e2e:deposit-evm-to-solana
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

test.describe("Deposit: EVM USDC → Solana (mainnet, real funds)", () => {
  test.skip(
    !E2E.evm.seedPhrase || !E2E.solana.address,
    "Set E2E_EVM_SEED_PHRASE and E2E_SOLANA_ADDRESS in .env.e2e"
  )

  let getPayId: (() => string | undefined) | undefined

  test.afterEach(async ({}, testInfo) => {
    await reportPayment(testInfo, {
      payId: getPayId?.(),
      route: "EVM USDC → Solana (deposit)",
      status: testInfo.status,
    })
  })

  test("deposit USDC from EVM to Solana destination", async ({
    page,
    metamask,
  }) => {
    getPayId = setupPaymentIdCapture(page)
    await metamask.unlock()
    await startDepositPayment(page, {
      destChain: "Solana",
      destToken: "USDC",
      address: E2E.solana.address,
    })
    await payInWithMetaMask(page, metamask, {
      sourceOptionId: E2E.evm.sourceOptionId,
      // depositAmount respects E2E_AMOUNT but enforces the 0.1 USDC SDK minimum.
      amount: E2E.depositAmount,
    })
    await waitForPayoutCompleted(page)
  })
})
