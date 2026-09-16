import { describe, expect, it } from "vitest";

import { shouldRecoverEvmWalletConnectTx } from "../src/payment/shouldRecoverEvmWalletConnectTx";

describe("shouldRecoverEvmWalletConnectTx", () => {
  it("keeps tx-hash recovery for consumer-supplied EVM WalletConnect", () => {
    expect(shouldRecoverEvmWalletConnectTx("walletConnect", "pay_123")).toBe(true);
  });

  it("does not recover for default non-WalletConnect connectors", () => {
    expect(shouldRecoverEvmWalletConnectTx("injected", "pay_123")).toBe(false);
    expect(shouldRecoverEvmWalletConnectTx("coinbaseWalletSDK", "pay_123")).toBe(false);
    expect(shouldRecoverEvmWalletConnectTx("walletConnect", undefined)).toBe(false);
  });
});
