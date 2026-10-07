/**
 * Native route viability probe — real backend, NO funds.
 *
 * Drives the Bridge → Pay to address path (no wallet needed), selects each
 * candidate native source, and reads the live `/payment-api/payments?dryrun=true`
 * quote to record whether that native route is currently payable. Non-dryrun
 * `createPayment` calls are aborted, so nothing is created and no funds move.
 *
 * This is the Phase-0 gate from docs/native-token-payments-plan.md: know which
 * native sources the backend actually quotes before writing funded specs.
 *
 * Off by default — set E2E_NATIVE_VIABILITY=true. It needs network + a running
 * dev server, so it must never run in the default mocked CI pass.
 *
 *   pnpm dev &  →  E2E_NATIVE_VIABILITY=true SKIP_ENV_VALIDATION=1 \
 *     pnpm --filter examples/nextjs-app exec playwright test \
 *       --config e2e/playwright.config.ts --project=mocked e2e/native/viability
 *
 * The `expect` column is today's observed state. A route flipping (backend
 * provisions/reverts an asset) fails the assert on purpose — update the table
 * only after an authorised change, not to silence it.
 */
import { expect, test, type Page, type Response } from "@playwright/test"
import { E2E } from "../env"
import { fillConfig, gotoMode, openModal } from "../helpers"

const DESTINATION = "0x000000000000000000000000000000000000dEaD"

type Expectation =
  | { kind: "viable"; sourceChainId: string }
  | { kind: "disabled" }
  | { kind: "absent" }
  | { kind: "rejected"; errorCode: string }

const ROUTES: Array<{
  id: string
  amount: string
  expect: Expectation
}> = [
  // Native EVM, quoted successfully by the backend.
  {
    id: "ETH on Base",
    amount: "0.11",
    expect: { kind: "viable", sourceChainId: "8453" },
  },
  {
    id: "BNB on BNB",
    amount: "0.11",
    expect: { kind: "viable", sourceChainId: "56" },
  },
  // Solana native is quoted on Intents chain 900 with tokenAddress "native".
  {
    id: "SOL on Solana",
    amount: "1.05",
    expect: { kind: "viable", sourceChainId: "900" },
  },
  // Present in the catalog but disabled for this environment/amount.
  { id: "ETH on Ethereum", amount: "0.11", expect: { kind: "disabled" } },
  { id: "ETH on Arbitrum", amount: "0.11", expect: { kind: "disabled" } },
  // Not returned by getDepositAddressOptions for this app.
  { id: "POL on Polygon", amount: "0.11", expect: { kind: "absent" } },
  // Backend rejects the quote outright.
  {
    id: "XLM on Stellar",
    amount: "0.5",
    expect: { kind: "rejected", errorCode: "invalidTokenSymbol" },
  },
]

/** Route real dryrun quotes through, abort any real createPayment. */
async function blockRealCreation(page: Page) {
  await page.route("**/payment-api/payments*", (route) => {
    if (route.request().url().includes("dryrun=true")) return route.continue()
    return route.abort()
  })
}

function waitForDryrun(page: Page): Promise<Response> {
  return page.waitForResponse((r) => {
    const url = r.url()
    return url.includes("/payment-api/payments") && url.includes("dryrun=true")
  })
}

async function openChainPicker(page: Page, amount: string) {
  await gotoMode(page, "bridge")
  await fillConfig(page, {
    chainName: "Base",
    tokenSymbol: "USDC",
    address: DESTINATION,
    amount,
  })
  await page.getByRole("button", { name: /confirm/i }).click()
  await page
    .getByRole("button", { name: /pay now/i })
    .waitFor({ timeout: 20_000 })
  await openModal(page)
  await page.getByTestId("rozopay-option-depositAddress").click()
  await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({
    timeout: 30_000,
  })
}

test.use({ navigationTimeout: 60_000, actionTimeout: 20_000 })

test.describe("Native route viability (real backend, no funds)", () => {
  test.skip(
    !E2E.nativeViability,
    "Set E2E_NATIVE_VIABILITY=1 to probe live native quotes (network, no funds)"
  )

  for (const route of ROUTES) {
    test(`${route.id} → ${route.expect.kind}`, async ({ page }) => {
      await blockRealCreation(page)
      await openChainPicker(page, route.amount)

      const option = page.getByTestId(`rozopay-option-${route.id}`)

      if (route.expect.kind === "absent") {
        await expect(option).toHaveCount(0)
        return
      }

      await expect(option).toBeVisible({ timeout: 20_000 })

      if (route.expect.kind === "disabled") {
        await expect(option).toBeDisabled()
        return
      }

      const dryrun = waitForDryrun(page)
      await option.click()
      const response = await dryrun
      const body = (await response.json()) as {
        source?: { chainId?: string; tokenAddress?: string; amount?: string }
        error?: { code?: string }
      }

      if (route.expect.kind === "rejected") {
        expect(response.status()).toBeGreaterThanOrEqual(400)
        expect(body.error?.code).toBe(route.expect.errorCode)
        return
      }

      // viable
      expect(response.status()).toBe(200)
      expect(body.source?.chainId).toBe(route.expect.sourceChainId)
      expect(Number(body.source?.amount)).toBeGreaterThan(0)
    })
  }
})
