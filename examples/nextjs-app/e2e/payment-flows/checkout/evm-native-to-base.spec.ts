/* Real funds: rozoDemo checkout, native EVM → Base USDC exactOut. */
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { E2E } from "../../env"
import {
  payInWithMetaMask,
  reportPayment,
  setupPaymentIdCapture,
  startCheckoutPayment,
  waitForPayoutCompleted,
} from "../../helpers"

const test = testWithChainwright(metamaskFixture())
const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
const sources = [
  { name: "Base ETH", chainId: "8453" },
  { name: "Arbitrum ETH", chainId: "42161" },
  { name: "Ethereum ETH", chainId: "1" },
  { name: "BSC BNB", chainId: "56" },
] as const

test.describe("rozoDemo checkout: native EVM → Base USDC (real funds)", () => {
  test.skip(
    !E2E.evm.seedPhrase || !E2E.evm.address,
    "Set E2E_EVM_SEED_PHRASE and E2E_EVM_ADDRESS"
  )
  let payId: (() => string | undefined) | undefined
  let route: string
  test.afterEach(async ({}, info) => {
    console.log(
      `[checkout-evm-native-to-base] paymentId=${payId?.() ?? "not captured"} status=${info.status}`
    )
    await reportPayment(info, { payId: payId?.(), route, status: info.status })
  })
  for (const source of sources) {
    test(`${source.name} → Base USDC`, async ({ page, metamask }) => {
      route = `${source.name} → Base USDC (rozoDemo checkout)`
      payId = setupPaymentIdCapture(page)
      await metamask.unlock()
      await startCheckoutPayment(page, {
        destChain: "Base",
        destToken: "USDC",
        address: E2E.evm.address!,
        amount: "1.10",
        exactOut: true,
      })
      await payInWithMetaMask(page, metamask, {
        sourceOptionId: `${source.chainId}-${NATIVE}`,
      })
      await waitForPayoutCompleted(page)
    })
  }
})
