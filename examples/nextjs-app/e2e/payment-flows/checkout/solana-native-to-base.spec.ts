/* Real funds: rozoDemo checkout, SOL → Base USDC exactOut. */
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import {
  payInWithPhantom,
  reportPayment,
  setupPaymentIdCapture,
  startCheckoutPayment,
  unlockPhantomIfNeeded,
  waitForPayoutCompleted,
} from "../../helpers"

const test = testWithChainwright(phantomFixture())
test.describe("rozoDemo checkout: SOL → Base USDC (real funds)", () => {
  test.skip(
    !E2E.solana.seedPhrase || !E2E.evm.address,
    "Set E2E_SOLANA_SEED_PHRASE and E2E_EVM_ADDRESS"
  )
  let payId: (() => string | undefined) | undefined
  test.afterEach(async ({}, info) => {
    console.log(
      `[checkout-solana-native-to-base] paymentId=${payId?.() ?? "not captured"} status=${info.status}`
    )
    await reportPayment(info, {
      payId: payId?.(),
      route: "SOL → Base USDC (rozoDemo checkout)",
      status: info.status,
    })
  })
  test("SOL → Base USDC", async ({ page, phantom, phantomPage }) => {
    payId = setupPaymentIdCapture(page)
    await unlockPhantomIfNeeded(phantom, phantomPage)
    await startCheckoutPayment(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address!,
      amount: "1.10",
      exactOut: true,
    })
    await payInWithPhantom(page, phantom, {
      sourceOptionId: "501-11111111111111111111111111111111",
    })
    await waitForPayoutCompleted(page)
  })
})
