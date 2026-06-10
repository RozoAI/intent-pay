/**
 * Full EVM payment flow E2E tests.
 *
 * Actual flow with injected wallet (already connected on page load):
 *   Bridge config → Confirm → Pay Now → modal opens
 *   → options list renders with "Pay with 0xf39F...2266" (connected wallet)
 *   → click connected wallet option → SelectToken page
 *   → token list loads (from mocked tRPC) → click USDC option
 *   → PayWithToken → mocked eth_sendTransaction → Confirmation page
 *
 * window.ethereum is injected via addInitScript before page load.
 * All backend API calls are intercepted via page.route().
 */
import { expect, Page, test } from "@playwright/test";
import { confirmAndWait, fillConfig, gotoMode, openModal } from "./helpers";
import { injectWalletScript, MOCK_ADDRESS, MOCK_TX_HASH } from "./wallet-mock";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_ID = "pay_e2e_test_000000000001";
const DEST_ADDRESS = "0x000000000000000000000000000000000000dEaD";
// USDC on Base
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const CFG = {
  chainName: "Base",
  tokenSymbol: "USDC",
  address: DEST_ADDRESS,
  amount: "1",
};

// Address as shown in SelectMethod (first 6 + last 4, no "0x" prefix shown)
const ADDR_SHORT = /0xf39F|f39F.*2266/i;

// ─── API mock helpers ─────────────────────────────────────────────────────────

const MOCK_TOKEN_OPTION = {
  balance: {
    token: { chainId: 8453, token: USDC_BASE, decimals: 6, symbol: "USDC", name: "USD Coin" },
    amount: "1000000",
    usd: 1.0,
  },
  required: {
    token: { chainId: 8453, token: USDC_BASE, decimals: 6, symbol: "USDC", name: "USD Coin" },
    amount: "1000000",
    usd: 1.0,
  },
  route: "direct",
};

async function mockRozoApi(page: Page) {
  // tRPC: getWalletPaymentOptions → return one USDC option
  await page.route("**/intentapi.rozo.ai**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ result: { data: [MOCK_TOKEN_OPTION] } }]),
    });
  });

  // REST: create payment
  await page.route("**/payment-api/payments", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildPaymentResponse("payment_unpaid")),
      });
    } else {
      await route.continue();
    }
  });

  // REST: get payment status (polling) — return completed immediately
  await page.route(`**/payment-api/payments/${PAYMENT_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildPaymentResponse("payment_completed")),
    });
  });

  // REST: update payin tx hash
  await page.route(`**/payment-api/payments/${PAYMENT_ID}/payin`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildPaymentResponse("payment_started")),
    });
  });

  // v1 path (legacy)
  await page.route(`**/payment/id/${PAYMENT_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildPaymentResponse("payment_completed")),
    });
  });

  // Fee endpoint
  await page.route("**/fee**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          feeType: "percentage",
          feePercent: 0.5,
          feeUSD: 0.005,
          totalUSD: 1.005,
          inputAmount: "1000000",
          outputAmount: "995000",
        },
      }),
    });
  });
}

function buildPaymentResponse(status: string) {
  return {
    success: true,
    data: {
      id: PAYMENT_ID,
      status,
      toChainId: 8453,
      toToken: USDC_BASE,
      toAddress: DEST_ADDRESS,
      toUnits: "1000000",
      fromAddress: MOCK_ADDRESS,
      payinTxHash: status !== "payment_unpaid" ? MOCK_TX_HASH : null,
      payoutTxHash: status === "payment_completed" ? MOCK_TX_HASH : null,
      mode: "HYDRATED",
      externalId: "ext_001",
      metadata: {},
      createdAt: new Date().toISOString(),
    },
  };
}

// ─── Shared setup: open modal and wait for options list ───────────────────────

async function setupAndOpenModal(page: Page) {
  await page.addInitScript(injectWalletScript);
  await mockRozoApi(page);
  await gotoMode(page, "bridge");
  await fillConfig(page, CFG);
  await confirmAndWait(page);
  await openModal(page);
  await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 25_000 });
}

/** Click the connected EVM wallet option ("Pay with 0xf39F...2266") */
async function clickConnectedWallet(page: Page) {
  await page.getByTestId("rozopay-option-connectedWallet").click();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Payment flow — EVM wallet (mocked)", () => {
  // ── Options list ─────────────────────────────────────────────────────────

  test("modal opens and options list renders", async ({ page }) => {
    await setupAndOpenModal(page);
    const opts = page.locator("[data-testid^='rozopay-option-']");
    expect(await opts.count()).toBeGreaterThan(0);
  });

  // test("connected wallet option is present", async ({ page }) => {
  //   await setupAndOpenModal(page)
  //   await expect(page.getByTestId("rozopay-option-connectedWallet")).toBeVisible()
  // })

  test("connected wallet option shows abbreviated address", async ({ page }) => {
    await setupAndOpenModal(page);
    await expect(page.getByText(ADDR_SHORT)).toBeVisible();
  });

  //   // ── SelectToken page ─────────────────────────────────────────────────────

  //   test("clicking connected wallet option navigates to SelectToken", async ({ page }) => {
  //     await setupAndOpenModal(page)
  //     await clickConnectedWallet(page)
  //     // SelectToken renders another options list (token list)
  //     await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 15_000 })
  //   })

  //   test("SelectToken shows USDC option from mocked wallet", async ({ page }) => {
  //     await setupAndOpenModal(page)
  //     await clickConnectedWallet(page)
  //     // Token option ID = getRozoTokenKey which includes chain+address — just check text
  //     await expect(page.getByText(/USDC/i).first()).toBeVisible({ timeout: 20_000 })
  //   })

  //   // ── Full payment flow ─────────────────────────────────────────────────────

  //   test("full flow: select token → PayWithToken renders", async ({ page }) => {
  //     await setupAndOpenModal(page)
  //     await clickConnectedWallet(page)

  //     // Wait for token list, pick first option
  //     await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 20_000 })
  //     await page.locator("[data-testid^='rozopay-option-']").first().click()

  //     // PayWithToken page — shows payment breakdown or waiting state
  //     await expect(
  //       page.getByText(/confirm|preparing|waiting|payment/i)
  //     ).toBeVisible({ timeout: 20_000 })
  //   })

  //   test("full flow: tx sent → WaitingWallet or Confirmation shown", async ({ page }) => {
  //     await setupAndOpenModal(page)
  //     await clickConnectedWallet(page)

  //     await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 20_000 })
  //     await page.locator("[data-testid^='rozopay-option-']").first().click()

  //     // With auto-approved eth_sendTransaction, should reach WaitingWallet or Confirmation
  //     await expect(
  //       page.getByText(/waiting|confirm in wallet|preparing|payment sent|completed|success|cancelled|failed/i)
  //     ).toBeVisible({ timeout: 30_000 })
  //   })

  //   test("full flow: Confirmation page shown after tx completes", async ({ page }) => {
  //     await setupAndOpenModal(page)
  //     await clickConnectedWallet(page)

  //     await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 20_000 })
  //     await page.locator("[data-testid^='rozopay-option-']").first().click()

  //     // Payment status mock returns completed immediately → Confirmation
  //     await expect(
  //       page.getByText(/payment sent|payment complete|completed|success/i)
  //     ).toBeVisible({ timeout: 40_000 })
  //   })

  //   // ── Modal controls ────────────────────────────────────────────────────────

  //   test("modal close button works from SelectToken page", async ({ page }) => {
  //     await setupAndOpenModal(page)
  //     await clickConnectedWallet(page)

  //     await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 15_000 })
  //     await page.getByTestId("rozopay-modal-close").click()
  //     await expect(page.getByTestId("rozopay-modal")).not.toBeVisible({ timeout: 5_000 })
  //   })

  //   test("Escape closes modal from SelectToken page", async ({ page }) => {
  //     await setupAndOpenModal(page)
  //     await clickConnectedWallet(page)

  //     await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 15_000 })
  //     await page.keyboard.press("Escape")
  //     await expect(page.getByTestId("rozopay-modal")).not.toBeVisible({ timeout: 5_000 })
  //   })

  //   test("Pay Now re-enabled after closing modal from SelectToken", async ({ page }) => {
  //     await setupAndOpenModal(page)
  //     await clickConnectedWallet(page)

  //     await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 15_000 })
  //     await page.keyboard.press("Escape")
  //     await expect(page.getByRole("button", { name: /pay now/i })).toBeEnabled({ timeout: 5_000 })
  //   })
  // })

  // // ─── Checkout mode ────────────────────────────────────────────────────────────

  // test.describe("Payment flow — Checkout mode (mocked)", () => {
  //   test.beforeEach(async ({ page }) => {
  //     await page.addInitScript(injectWalletScript)
  //     await mockRozoApi(page)
  //   })

  //   test("checkout: create payment → modal opens with connected wallet option", async ({ page }) => {
  //     await gotoMode(page, "checkout")
  //     await fillConfig(page, CFG)
  //     await page.getByRole("button", { name: /confirm/i }).click()
  //     await expect(page.getByRole("button", { name: /create payment/i })).toBeVisible({
  //       timeout: 10_000,
  //     })
  //     await page.getByRole("button", { name: /create payment/i }).click()
  //     await expect(page.getByRole("button", { name: /pay now/i })).toBeVisible({ timeout: 30_000 })
  //     await openModal(page)

  //     await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 25_000 })
  //     await expect(page.getByTestId("rozopay-option-connectedWallet")).toBeVisible()
  //   })

  //   test("checkout: select token → PayWithToken reached", async ({ page }) => {
  //     await gotoMode(page, "checkout")
  //     await fillConfig(page, CFG)
  //     await page.getByRole("button", { name: /confirm/i }).click()
  //     await expect(page.getByRole("button", { name: /create payment/i })).toBeVisible({
  //       timeout: 10_000,
  //     })
  //     await page.getByRole("button", { name: /create payment/i }).click()
  //     await expect(page.getByRole("button", { name: /pay now/i })).toBeVisible({ timeout: 30_000 })
  //     await openModal(page)

  //     await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 25_000 })
  //     await page.getByTestId("rozopay-option-connectedWallet").click()

  //     await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 20_000 })
  //     await page.locator("[data-testid^='rozopay-option-']").first().click()

  //     await expect(
  //       page.getByText(/confirm|preparing|waiting|payment|cancelled|failed/i)
  //     ).toBeVisible({ timeout: 20_000 })
  //   })
});

// ─── Non-wallet options ───────────────────────────────────────────────────────

test.describe("Payment flow — non-wallet options", () => {
  // test.beforeEach(async ({ page }) => {
  //   await page.addInitScript(injectWalletScript)
  //   await mockRozoApi(page)
  // })
  // test("'Pay with another wallet' option is present", async ({ page }) => {
  //   await setupAndOpenModal(page)
  //   // "Pay with another wallet" option ID — derived from connector list route
  //   const opt = page.getByText(/pay with another wallet/i)
  //   await expect(opt).toBeVisible({ timeout: 5_000 })
  // })
  // test("'Pay to address' option is present", async ({ page }) => {
  //   await setupAndOpenModal(page)
  //   await expect(page.getByText(/pay to address/i)).toBeVisible({ timeout: 5_000 })
  // })
});
