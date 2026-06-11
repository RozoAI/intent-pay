/**
 * Payment flow E2E test — real wallet, real funds, MAINNET (Chainwright + MetaMask).
 *
 * Drives a real MetaMask extension to send a real cross-chain USDC payment
 * from an EVM wallet to a Stellar destination address through the RozoPay
 * Bridge mode flow.
 *
 * THIS TEST MOVES REAL MONEY. It is NOT run in CI and NOT run automatically.
 * Skipped entirely unless E2E_SEED_PHRASE is set.
 *
 * Setup (one-time):
 *   cp .env.e2e.example .env.e2e   # fill in E2E_SEED_PHRASE etc.
 *   pnpm setup-wallets             # build the cached MetaMask profile
 *
 * Run:
 *   pnpm dev &
 *   pnpm test:e2e:mainnet
 */
import { expect } from "@playwright/test"
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { fillConfig, gotoMode, openModal } from "./helpers"

const SEED_PHRASE = process.env.E2E_SEED_PHRASE
const DEST_STELLAR_ADDRESS =
  process.env.E2E_DEST_STELLAR_ADDRESS ??
  "GDATMUNQEPN4TPETV47LAKGJELK4DUHHDRPMGD3K5LOHUPXX2DI623KY"
const AMOUNT = process.env.E2E_AMOUNT ?? "0.2"
// Base USDC: chainId 8453, token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
const SOURCE_OPTION_ID =
  process.env.E2E_SOURCE_OPTION_ID ??
  "8453-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

const test = testWithChainwright(metamaskFixture())

test.describe("Payment flow — Bridge: EVM USDC -> Stellar (mainnet, real funds)", () => {
  test.skip(!SEED_PHRASE, "E2E_SEED_PHRASE not set — see .env.e2e.example")

  test("send USDC to Stellar destination", async ({ page, metamask }) => {
    // Unlock MetaMask before interacting with the dApp — the cached wallet
    // starts locked and must be unlocked before any notification popup can appear.
    await metamask.unlock()

    await gotoMode(page, "bridge")
    await fillConfig(page, {
      chainName: "Stellar",
      tokenSymbol: "USDC",
      address: DEST_STELLAR_ADDRESS,
      amount: AMOUNT,
    })

    // Confirm config → Pay Now → open SDK modal
    await page.getByRole("button", { name: /confirm/i }).click()
    await expect(page.getByRole("button", { name: /pay now/i })).toBeEnabled({
      timeout: 20_000,
    })
    await openModal(page)

    // Choose "Pay with wallet" → Connect Wallet sub-screen
    await page.getByRole("button", { name: /pay with wallet/i }).click()

    // Click MetaMask → chain selector
    await page.getByRole("button", { name: /metamask/i }).click()

    // Pick Ethereum → triggers MetaMask extension notification popup
    await page.getByRole("button", { name: /ethereum/i }).click()

    // Approve the connection in MetaMask.
    //
    // chainwright's connectToApp() drives the notification popup through
    // Connect → "Connecting" spinner → permissions notice → Next. On MetaMask
    // v13.x a plain connect request auto-closes the popup right after "Connect",
    // before chainwright's `waitFor(heading "Connecting", detached)` resolves —
    // so it throws "Target page/context closed" even though the connection
    // succeeded. Swallow exactly that case; the options-list assertion below is
    // the real proof the wallet connected.
    try {
      await metamask.connectToApp()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!/closed/i.test(msg)) throw err
    }

    // Pick the source token — testid: `rozopay-option-{chainId}-{tokenAddress}`
    // Wait for the specific option to be visible and stable — the list can
    // re-render multiple times as the wallet connection settles, so waiting on
    // the list alone is not enough.
    const sourceOption = page.getByTestId(`rozopay-option-${SOURCE_OPTION_ID}`)
    await expect(sourceOption).toBeVisible({ timeout: 120_000 })
    await expect(sourceOption).toBeEnabled({ timeout: 10_000 })
    await sourceOption.click()

    // Approve + send the on-chain transaction in MetaMask
    await metamask.confirmTransaction()

    // Wait until the PAYOUT completes — not just the payin.
    //
    // The Confirmation screen shows three states:
    //   "Confirming..."       → payin tx still being mined
    //   "Payment Confirmed"   → payin done, payout still processing
    //                            (body shows "Processing payout...")
    //   "Payment Completed"   → payout resolved (final state)
    //
    // So we wait for the exact "Payment Completed" heading and confirm the
    // "Processing payout..." indicator is gone. Cross-chain payout to Stellar
    // can take a few minutes, hence the generous timeout.
    await expect(
      page.getByText("Payment Completed", { exact: true })
    ).toBeVisible({ timeout: 8 * 60_000 })
    await expect(page.getByText(/processing payout/i)).toBeHidden()
  })
})
