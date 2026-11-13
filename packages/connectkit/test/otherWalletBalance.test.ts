import { baseUSDC, rozoSolanaUSDC, Token, WalletPaymentOption } from "@rozoai/intent-common";
import { describe, expect, it, vi } from "vitest";
import {
  getOtherWalletBalances,
  getOtherWalletFamilies,
  refreshWithOtherWallets,
} from "../src/utils/otherWalletBalance";

const asPayToken = (t: Token) => ({ ...t, usd: 1, priceFromUsd: 1, displayDecimals: 2 }) as any;

function option(t: Token, balance: number, required: number): WalletPaymentOption {
  const amt = (n: number) => ({
    token: asPayToken(t),
    amount: String(Math.round(n * 10 ** t.decimals)) as any,
    usd: n,
  });
  return {
    balance: amt(balance),
    required: amt(required),
    minimumRequired: amt(required),
    fees: amt(0),
    disabledReason: balance < required ? "Balance too low: $10.27" : undefined,
  };
}

const base = {
  connected: { evm: true, solana: true, stellar: false },
  isDepositFlow: false,
};

describe("getOtherWalletBalances", () => {
  it("reports an insufficient Solana balance while the list is EVM-only", () => {
    const res = getOtherWalletBalances({
      ...base,
      mode: "evm",
      options: { evm: [], solana: [option(rozoSolanaUSDC, 10.27, 10.61)], stellar: null },
    });
    expect(res).toEqual([
      {
        family: "solana",
        label: "Solana",
        symbol: "USDC",
        balance: "10.27",
        required: "10.61",
        sufficient: false,
      },
    ]);
  });

  it("prefers a payable wallet and labels EVM by chain name", () => {
    const res = getOtherWalletBalances({
      ...base,
      mode: "solana",
      options: { evm: [option(baseUSDC, 50, 10.61)], solana: [], stellar: null },
    });
    expect(res[0]).toMatchObject({ family: "evm", label: "Base", sufficient: true });
  });

  it("ignores the current family, disconnected or disallowed families, zero balances, and mode all", () => {
    const solana = [option(rozoSolanaUSDC, 10.27, 10.61)];
    expect(
      getOtherWalletBalances({
        ...base,
        mode: "solana",
        options: { evm: [], solana, stellar: [] },
      }),
    ).toEqual([]);
    expect(
      getOtherWalletBalances({
        ...base,
        connected: { evm: true, solana: false, stellar: false },
        mode: "evm",
        options: { evm: [], solana, stellar: [] },
      }),
    ).toEqual([]);
    expect(
      getOtherWalletBalances({
        ...base,
        mode: "evm",
        paymentOptions: ["Ethereum"],
        options: { evm: [], solana, stellar: [] },
      }),
    ).toEqual([]);
    expect(
      getOtherWalletBalances({
        ...base,
        mode: "evm",
        options: { evm: [], solana: [option(rozoSolanaUSDC, 0, 10.61)], stellar: [] },
      }),
    ).toEqual([]);
    expect(
      getOtherWalletBalances({ ...base, mode: "all", options: { evm: [], solana, stellar: [] } }),
    ).toEqual([]);
  });

  it("omits the required amount in the deposit flow", () => {
    const res = getOtherWalletBalances({
      ...base,
      isDepositFlow: true,
      mode: "evm",
      options: { evm: [], solana: [option(rozoSolanaUSDC, 5, 0)], stellar: [] },
    });
    expect(res[0].required).toBeUndefined();
  });
});

describe("Refresh balance also refetches other connected wallets", () => {
  it("lists only connected, allowed families other than the listed mode", () => {
    const connected = { evm: true, solana: true, stellar: true };
    expect(getOtherWalletFamilies({ mode: "evm", connected })).toEqual(["solana", "stellar"]);
    expect(
      getOtherWalletFamilies({ mode: "evm", connected: { ...connected, stellar: false } }),
    ).toEqual(["solana"]);
    expect(
      getOtherWalletFamilies({ mode: "evm", connected, paymentOptions: ["Ethereum", "Solana"] }),
    ).toEqual(["solana"]);
    expect(getOtherWalletFamilies({ mode: "all", connected })).toEqual([]);
  });

  it("refetches the Solana wallet when the list is EVM-only (top-up mid-session)", async () => {
    const current = vi.fn(async () => {});
    const refreshers = {
      evm: vi.fn(async () => {}),
      solana: vi.fn(async () => {}),
      stellar: vi.fn(async () => {}),
    };
    await refreshWithOtherWallets(
      current,
      getOtherWalletFamilies({
        mode: "evm",
        connected: { evm: true, solana: true, stellar: false },
      }),
      refreshers,
    );
    expect(current).toHaveBeenCalledTimes(1);
    expect(refreshers.solana).toHaveBeenCalledTimes(1);
    expect(refreshers.evm).not.toHaveBeenCalled();
    expect(refreshers.stellar).not.toHaveBeenCalled();
  });
});
