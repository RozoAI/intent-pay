import { describe, expect, it } from "vitest";

import { classifyWalletFailure } from "./walletFailure";
import {
  FAILURE_COPY_LANGUAGES,
  failedStateCopy,
  matchFailureCopyLanguage,
  readBrowserLanguages,
  resolveFailureCopyLanguage,
} from "./walletFailureCopy";

const rpcUnavailable = classifyWalletFailure(
  Object.assign(
    new Error("RPC 0x89 Infura eth_sendRawTransaction: RPC endpoint not found or unavailable."),
    {
      code: -32603,
    },
  ),
);
const walletInternal = classifyWalletFailure(
  Object.assign(new Error("Unexpected error"), { code: -32603 }),
);
const rejected = classifyWalletFailure(
  Object.assign(new Error("User rejected the request."), { code: 4001 }),
);
const other = classifyWalletFailure(new Error("boom"));

describe("resolveFailureCopyLanguage", () => {
  it("host did not pass a language, browser is Russian: Russian", () => {
    expect(resolveFailureCopyLanguage(undefined, ["ru-RU", "en-US"])).toBe("ru");
  });

  it("host explicitly passed English, browser is Russian: English", () => {
    expect(resolveFailureCopyLanguage("en-US", ["ru-RU"])).toBe("en");
  });

  it("host did not pass a language, browser language is not covered: English", () => {
    expect(resolveFailureCopyLanguage(undefined, ["de-DE"])).toBe("en");
  });

  it("no navigator: English, no throw", () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    try {
      Object.defineProperty(globalThis, "navigator", { value: undefined, configurable: true });
      expect(readBrowserLanguages()).toEqual([]);
      expect(resolveFailureCopyLanguage(undefined, readBrowserLanguages())).toBe("en");
    } finally {
      if (saved) Object.defineProperty(globalThis, "navigator", saved);
    }
    expect(resolveFailureCopyLanguage(undefined, undefined)).toBe("en");
  });

  it("an explicit host language we do not cover yields English, not the browser's", () => {
    expect(resolveFailureCopyLanguage("fr-FR", ["ru-RU"])).toBe("en");
  });

  it("an explicit covered host language wins", () => {
    expect(resolveFailureCopyLanguage("ru-RU", ["en-US"])).toBe("ru");
    expect(resolveFailureCopyLanguage("zh-CN", ["en-US"])).toBe("zh");
  });

  it("walks the browser list until a covered language", () => {
    expect(resolveFailureCopyLanguage(undefined, ["de-DE", "ko-KR"])).toBe("ko");
  });
});

describe("matchFailureCopyLanguage", () => {
  it("maps regional and script variants", () => {
    expect(matchFailureCopyLanguage("zh-CN")).toBe("zh");
    expect(matchFailureCopyLanguage("zh-Hans-SG")).toBe("zh");
    expect(matchFailureCopyLanguage("zh-TW")).toBe("zh-TW");
    expect(matchFailureCopyLanguage("zh-HK")).toBe("zh-TW");
    expect(matchFailureCopyLanguage("zh-Hant")).toBe("zh-TW");
    expect(matchFailureCopyLanguage("pt-BR")).toBe("pt-BR");
    expect(matchFailureCopyLanguage("pt-PT")).toBe("pt-BR");
    expect(matchFailureCopyLanguage("es-419")).toBe("es");
    expect(matchFailureCopyLanguage("in-ID")).toBe("id");
    expect(matchFailureCopyLanguage("ms_MY")).toBe("ms");
    expect(matchFailureCopyLanguage("fr-FR")).toBeNull();
    expect(matchFailureCopyLanguage("")).toBeNull();
    expect(matchFailureCopyLanguage(undefined)).toBeNull();
  });
});

describe("failedStateCopy", () => {
  it("English rpc-unavailable copy names the wallet and network", () => {
    const c = failedStateCopy(rpcUnavailable, {
      language: "en",
      walletName: "MetaMask",
      networkName: "Polygon",
    });
    expect(c.title).toBe("Wallet Network Unavailable");
    expect(c.body).toBe(
      "MetaMask could not reach the Polygon network, so this page did not receive a transaction. This is a problem with the wallet's network connection, not with your funds. If your wallet shows a transaction as sent, wait for it to confirm before paying again. Otherwise, pay from another wallet or an exchange, or choose a different network.",
    );
    expect(c.payFromAnotherWallet).toBe("Pay from another wallet or exchange");
    expect(c.retryPayment).toBe("Retry Payment");
  });

  it("Russian copy for the 2026-11-09 case", () => {
    const c = failedStateCopy(rpcUnavailable, {
      language: "ru",
      walletName: "MetaMask",
      networkName: "Polygon",
    });
    expect(c.title).toBe("Сеть кошелька недоступна");
    expect(c.body).toContain("Кошелёк MetaMask не смог подключиться к сети Polygon");
    expect(c.payFromAnotherWallet).toBe("Оплатить с другого кошелька или биржи");
    expect(c.retryPayment).toBe("Повторить платёж");
  });

  it("user rejection: no body, cancelled title", () => {
    const c = failedStateCopy(rejected, {
      language: "en",
      walletName: "MetaMask",
      networkName: "Base",
    });
    expect(c.body).toBeNull();
    expect(c.title).toBe("Payment Cancelled");
  });

  it("generic wallet_internal keeps the 'Wallet Could Not Send' copy", () => {
    const c = failedStateCopy(walletInternal, {
      language: "en",
      walletName: "Phantom",
      networkName: "Base",
    });
    expect(c.title).toBe("Wallet Could Not Send");
    expect(c.body).toContain("Phantom returned an internal error");
  });

  it("every language covers every string, names the wallet, never promises nothing was sent", () => {
    for (const language of FAILURE_COPY_LANGUAGES) {
      for (const failure of [rpcUnavailable, walletInternal, other, rejected, null]) {
        const named = failedStateCopy(failure, {
          language,
          walletName: "MetaMask",
          networkName: "Polygon",
        });
        const unnamed = failedStateCopy(failure, {
          language,
          walletName: "  ",
          networkName: "Polygon",
        });
        for (const c of [named, unnamed]) {
          expect(c.title.length).toBeGreaterThan(0);
          expect(c.payFromAnotherWallet.length).toBeGreaterThan(0);
          expect(c.retryPayment.length).toBeGreaterThan(0);
          for (const text of [c.title, c.body ?? "", c.payFromAnotherWallet, c.retryPayment]) {
            // House style: no em/en dashes as connective punctuation.
            expect(text).not.toMatch(/[–—]/);
            expect(text).not.toContain("undefined");
            expect(text).not.toContain("null");
          }
        }
        if (failure && failure.kind !== "user_rejected") {
          expect(named.body).toContain("MetaMask");
          expect(unnamed.body).not.toContain("MetaMask");
        } else {
          expect(named.body).toBeNull();
        }
        if (failure?.rpcUnavailable) expect(named.body).toContain("Polygon");
      }
    }
  });

  it("falls back to English for an unknown language key", () => {
    const c = failedStateCopy(other, {
      language: "xx" as never,
      walletName: null,
      networkName: "Base",
    });
    expect(c.body).toContain("Your wallet did not complete");
  });
});
