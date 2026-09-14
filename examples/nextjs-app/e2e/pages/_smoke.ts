import { test, expect, type Page } from "@playwright/test";
import {
  collectErrors,
  expectHydrated,
  expectNoEmptyHref,
  installMockEvmWallet,
  type HydratedOptions,
} from "@rozoai/fe-gate";

/** Errors from third parties we tolerate on every page. Keep this list short and owned. */
const THIRD_PARTY_HOST = String.raw`(?:posthog|us\.i\.posthog\.com|us-assets\.i\.posthog\.com|walletconnect|relay\.walletconnect\.org|pulse\.walletconnect\.org|api\.web3modal\.org|explorer-api\.walletconnect\.com)`;

export const ALLOW: NonNullable<HydratedOptions["allowErrors"]> = [
  new RegExp(THIRD_PARTY_HOST, "i"),
  new RegExp(
    `(?:net::ERR_|Failed to load resource|Failed to fetch).*${THIRD_PARTY_HOST}|${THIRD_PARTY_HOST}.*(?:net::ERR_|Failed to load resource|Failed to fetch)`,
    "i",
  ),
];

export interface SmokeOptions extends HydratedOptions {
  /** Skip the empty-href scan (only for pages that intentionally render placeholder anchors). */
  skipHrefScan?: boolean;
  /** Extra assertions after hydration. */
  extra?: (page: Page) => Promise<void>;
  /** Compare against committed screenshot baseline. Default: only when FE_GATE_VISUAL=1. */
  screenshot?: boolean;
}

/** One call per route: hydrates, asserts no hydration/console errors, real hrefs, screenshot baseline. */
export function smokeRoute(path: string, opts: SmokeOptions = {}) {
  test(`${path} hydrates without errors`, async ({ page }, testInfo) => {
    const box = collectErrors(page);
    await installMockEvmWallet(page);
    await page.goto(path);
    await expectHydrated(page, box, { allowErrors: ALLOW, ...opts });
    if (!opts.skipHrefScan) await expectNoEmptyHref(page);
    if (opts.extra) await opts.extra(page);
    if (opts.screenshot ?? !!process.env.FE_GATE_VISUAL) {
      await expect(page).toHaveScreenshot(
        `${testInfo.project.name}${path.replace(/\W+/g, "_")}.png`,
        { fullPage: false, mask: [page.locator("[data-gate-mask]")] },
      );
    }
  });
}
