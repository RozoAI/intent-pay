import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  base,
  ExternalPaymentOptions,
  polygon,
  rozoSolana,
  rozoStellar,
  solana,
} from "@rozoai/intent-common";
import { describe, expect, it } from "vitest";
import { getDeeplinkChainFamily, resolveDeeplinkChainFamily } from "../src/wallets/deeplinkChain";
import { trustCoinId, walletConfigs } from "../src/wallets/walletConfigs";

const trust = walletConfigs["com.trustwallet.app"];
const invoiceUrl = "https://invoice.rozo.ai/checkout?id=abc&appId=app1";

describe("Trust Wallet deeplink", () => {
  it("opens Solana orders on SLIP-44 coin 501", () => {
    expect(trustCoinId("solana")).toBe(501);
    expect(trust.getRozoPayDeeplink!({ payId: "abc", appId: "app1", chainFamily: "solana" })).toBe(
      `trust://open_url?coin_id=501&url=${invoiceUrl}`,
    );
  });

  it("keeps coin 60 for EVM, Stellar and unknown chain (unchanged default)", () => {
    for (const chainFamily of ["evm", "stellar", undefined] as const) {
      expect(trust.getRozoPayDeeplink!({ payId: "abc", appId: "app1", chainFamily })).toBe(
        `trust://open_url?coin_id=60&url=${invoiceUrl}`,
      );
    }
  });

  it("keeps customDeeplink untouched apart from coin_id", () => {
    expect(
      trust.getRozoPayDeeplink!({
        payId: "",
        customDeeplink: "https://x.y/z?a=1",
        chainFamily: "solana",
      }),
    ).toBe("trust://open_url?coin_id=501&url=https://x.y/z?a=1");
  });

  it("other wallets ignore chainFamily (no documented chain parameter)", () => {
    for (const [id, cfg] of Object.entries(walletConfigs)) {
      if (id === "com.trustwallet.app" || !cfg.getRozoPayDeeplink) continue;
      if (id === "app.phantom" || id === "solflare") continue; // read window.location
      const params = { payId: "abc", appId: "app1" };
      expect(cfg.getRozoPayDeeplink({ ...params, chainFamily: "solana" })).toBe(
        cfg.getRozoPayDeeplink(params),
      );
    }
  });
});

describe("resolveDeeplinkChainFamily", () => {
  it("maps native and Rozo chain ids to families", () => {
    expect(getDeeplinkChainFamily(solana.chainId)).toBe("solana");
    expect(getDeeplinkChainFamily(rozoSolana.chainId)).toBe("solana");
    expect(getDeeplinkChainFamily(rozoStellar.chainId)).toBe("stellar");
    expect(getDeeplinkChainFamily(base.chainId)).toBe("evm");
    expect(getDeeplinkChainFamily(null)).toBeUndefined();
    expect(getDeeplinkChainFamily(NaN)).toBeUndefined();
  });

  it("returns undefined when nothing pins a chain", () => {
    expect(resolveDeeplinkChainFamily({})).toBeUndefined();
  });

  it("uses single-family preferredChains", () => {
    expect(resolveDeeplinkChainFamily({ preferredChains: [rozoSolana.chainId] })).toBe("solana");
    expect(
      resolveDeeplinkChainFamily({
        preferredChains: [rozoSolana.chainId],
        orderPreferredChainId: base.chainId,
      }),
    ).toBe("solana");
    expect(resolveDeeplinkChainFamily({ preferredChains: [base.chainId, polygon.chainId] })).toBe(
      "evm",
    );
  });

  it("uses wallet-family paymentOptions", () => {
    expect(
      resolveDeeplinkChainFamily({
        paymentOptions: [ExternalPaymentOptions.Solana, ExternalPaymentOptions.Coinbase],
      }),
    ).toBe("solana");
  });

  it("falls back to the order's chain only when it is allowed", () => {
    expect(resolveDeeplinkChainFamily({ orderPreferredChainId: rozoSolana.chainId })).toBe(
      "solana",
    );
    expect(
      resolveDeeplinkChainFamily({
        preferredChains: [base.chainId, rozoSolana.chainId],
        orderPreferredChainId: rozoSolana.chainId,
      }),
    ).toBe("solana");
    expect(
      resolveDeeplinkChainFamily({
        preferredChains: [base.chainId, rozoSolana.chainId],
        orderPreferredChainId: rozoStellar.chainId,
      }),
    ).toBeUndefined();
  });
});

describe("deeplink call sites pass the order's chain family", () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

  it("MobileConnectors and openInWalletBrowser forward chainFamily", () => {
    expect(read("../src/components/Pages/MobileConnectors/index.tsx")).toMatch(
      /getRozoPayDeeplink\(\{[\s\S]*?chainFamily: paymentState\.walletDeeplinkChainFamily,[\s\S]*?\}\)/,
    );
    expect(read("../src/hooks/usePaymentState.ts")).toMatch(
      /getRozoPayDeeplink\(\{[\s\S]*?chainFamily: walletDeeplinkChainFamily,[\s\S]*?\}\)/,
    );
  });
});
