import { describe, expect, it, vi } from "vitest";
import {
  ERC20_TRANSFER_GAS_FALLBACK,
  feeToUsd,
  fetchNativeUsdPrice,
  findErc20GasShortfall,
  formatNoGasMessage,
  InsufficientNativeGasError,
  isInsufficientNativeGasError,
  noGasTelemetry,
  walletMaySponsorGas,
  type Erc20GasPrecheckDeps,
} from "../src/payment/erc20GasPrecheck";

const GWEI = 1_000_000_000n;
const ETH_PARAMS = {
  chainId: 1,
  chainName: "Ethereum",
  nativeSymbol: "ETH",
  nativeDecimals: 18,
  tokenSymbol: "USDC",
};

function deps(over: Partial<Erc20GasPrecheckDeps> = {}): Erc20GasPrecheckDeps {
  return {
    getNativeBalance: async () => 0n,
    getGasPrice: async () => 2n * GWEI,
    estimateTransferGas: async () => 50_000n,
    getPayerCode: async () => undefined,
    ...over,
  };
}

describe("findErc20GasShortfall", () => {
  it("flags an EOA with zero native balance (the 2026-10-07 Ethereum case)", async () => {
    const s = await findErc20GasShortfall(deps(), ETH_PARAMS);
    expect(s).not.toBeNull();
    expect(s!.nativeBalance).toBe(0n);
    expect(s!.requiredFee).toBe(50_000n * 2n * GWEI);
  });

  it("passes when the balance covers estimateGas x gasPrice", async () => {
    const s = await findErc20GasShortfall(
      deps({ getNativeBalance: async () => 50_000n * 2n * GWEI }),
      ETH_PARAMS,
    );
    expect(s).toBeNull();
  });

  it("skips estimateGas when the balance already covers the fallback gas", async () => {
    const estimate = vi.fn(async () => 50_000n);
    const s = await findErc20GasShortfall(
      deps({
        getNativeBalance: async () => ERC20_TRANSFER_GAS_FALLBACK * 2n * GWEI,
        estimateTransferGas: estimate,
      }),
      ETH_PARAMS,
    );
    expect(s).toBeNull();
    expect(estimate).not.toHaveBeenCalled();
  });

  it("does not false-block on L2s where a tiny balance covers the tiny fee", async () => {
    // Base: ~0.005 gwei gas price, 0.000001 ETH balance.
    const s = await findErc20GasShortfall(
      deps({
        getGasPrice: async () => 5_000_000n,
        getNativeBalance: async () => 1_000_000_000_000n,
      }),
      { ...ETH_PARAMS, chainId: 8453, chainName: "Base" },
    );
    expect(s).toBeNull();
  });

  it("falls back to a fixed gas limit when estimateGas throws", async () => {
    const s = await findErc20GasShortfall(
      deps({
        estimateTransferGas: async () => {
          throw new Error("execution reverted");
        },
      }),
      ETH_PARAMS,
    );
    expect(s!.requiredFee).toBe(ERC20_TRANSFER_GAS_FALLBACK * 2n * GWEI);
  });

  it("fails open when balance or gas price cannot be read", async () => {
    expect(
      await findErc20GasShortfall(
        deps({
          getNativeBalance: async () => {
            throw new Error("rpc down");
          },
        }),
        ETH_PARAMS,
      ),
    ).toBeNull();
    expect(
      await findErc20GasShortfall(
        deps({
          getGasPrice: async () => {
            throw new Error("rpc down");
          },
        }),
        ETH_PARAMS,
      ),
    ).toBeNull();
  });

  it("never blocks contract accounts (Safe, smart wallets, EIP-7702)", async () => {
    expect(
      await findErc20GasShortfall(deps({ getPayerCode: async () => "0x6080" }), ETH_PARAMS),
    ).toBeNull();
    expect(
      await findErc20GasShortfall(
        deps({ getPayerCode: async () => "0xef0100" + "ab".repeat(20) }),
        ETH_PARAMS,
      ),
    ).toBeNull();
    // "0x" means a plain EOA: still checked.
    expect(
      await findErc20GasShortfall(deps({ getPayerCode: async () => "0x" }), ETH_PARAMS),
    ).not.toBeNull();
  });

  it("does not block when the chain reports a zero gas price", async () => {
    expect(
      await findErc20GasShortfall(deps({ getGasPrice: async () => 0n }), ETH_PARAMS),
    ).toBeNull();
  });
});

describe("walletMaySponsorGas", () => {
  it("detects EIP-5792 paymaster / auxiliary funds capabilities", () => {
    expect(walletMaySponsorGas(undefined)).toBe(false);
    expect(walletMaySponsorGas({ dataSuffix: {} })).toBe(false);
    expect(walletMaySponsorGas({ paymasterService: { supported: true } })).toBe(true);
    expect(walletMaySponsorGas({ auxiliaryFunds: { supported: true } })).toBe(true);
    expect(walletMaySponsorGas({ paymasterService: { supported: false } })).toBe(false);
  });
});

describe("message and telemetry", () => {
  const shortfall = {
    ...ETH_PARAMS,
    nativeBalance: 0n,
    requiredFee: 100_000_000_000_000n, // 0.0001 ETH
    gasEstimateUsd: 0.2555,
  };

  it("explains the missing gas with a USD estimate and alternatives", () => {
    expect(formatNoGasMessage(shortfall)).toBe(
      "Your wallet has no ETH to pay the network fee (about $0.26 needed). Add a little ETH, or pay with USDC on Base / BNB / Polygon instead.",
    );
  });

  it("falls back to native units without a price and drops the current chain from alternatives", () => {
    const msg = formatNoGasMessage({
      ...shortfall,
      chainId: 8453,
      nativeBalance: 1n,
      gasEstimateUsd: null,
    });
    expect(msg).toContain("doesn't have enough ETH");
    expect(msg).toContain("about 0.00010 ETH needed");
    expect(msg).toContain("USDC on BNB / Polygon instead");
  });

  it("carries the shortfall on a recognisable error", () => {
    const err = new InsufficientNativeGasError(shortfall);
    expect(isInsufficientNativeGasError(err)).toBe(true);
    expect(isInsufficientNativeGasError(new Error("x"))).toBe(false);
    expect(err.message).toBe(formatNoGasMessage(shortfall));
  });

  it("emits amounts only, never addresses", () => {
    const t = noGasTelemetry(shortfall);
    expect(t).toEqual({
      chain: 1,
      chain_name: "Ethereum",
      token: "USDC",
      native_symbol: "ETH",
      native_balance: "0",
      gas_estimate_native: "0.0001",
      gas_estimate_usd: 0.2555,
    });
    expect(JSON.stringify(t)).not.toMatch(/0x[0-9a-fA-F]{6,}/);
  });
});

describe("price helpers", () => {
  it("reads the USD price and tolerates failures", async () => {
    const ok = async () => ({
      data: { data: [{ symbol: "ETH", prices: [{ currency: "usd", value: "2555.76" }] }] },
    });
    expect(await fetchNativeUsdPrice("ETH", ok)).toBe(2555.76);
    expect(
      await fetchNativeUsdPrice("ETH", async () => {
        throw new Error("down");
      }),
    ).toBeNull();
    expect(await fetchNativeUsdPrice("ETH", async () => ({ data: null }))).toBeNull();
    expect(
      await fetchNativeUsdPrice("ETH", () => new Promise(() => {}), 10),
    ).toBeNull();
  });

  it("converts the fee to USD", () => {
    expect(feeToUsd(10n ** 18n, 18, 2000)).toBe(2000);
    expect(feeToUsd(10n ** 18n, 18, null)).toBeNull();
  });
});
