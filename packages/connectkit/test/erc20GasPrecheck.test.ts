import { describe, expect, it, vi } from "vitest";
import {
  ERC20_TRANSFER_GAS_FALLBACK,
  feeToUsd,
  fetchNativeUsdPrice,
  findErc20GasShortfall,
  formatNoGasMessage,
  formatWalletNoGasMessage,
  isInsufficientFundsError,
  InsufficientNativeGasError,
  isInsufficientNativeGasError,
  MIN_TX_GAS,
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

  it("uses the 21k intrinsic-gas lower bound when estimateGas throws", async () => {
    const failing = async () => {
      throw new Error("rpc hiccup");
    };
    const s = await findErc20GasShortfall(deps({ estimateTransferGas: failing }), ETH_PARAMS);
    expect(s!.requiredFee).toBe(MIN_TX_GAS * 2n * GWEI);
    // Balance that covers 60k gas but not the 65k fast-path: must NOT block
    // just because the estimate failed.
    expect(
      await findErc20GasShortfall(
        deps({
          estimateTransferGas: failing,
          getNativeBalance: async () => 60_000n * 2n * GWEI,
        }),
        ETH_PARAMS,
      ),
    ).toBeNull();
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

describe("isInsufficientFundsError", () => {
  // Shape from the 2026-10-07 Ethereum USDT case: viem nests the real error
  // four `cause` levels below the surface error.
  const nested = () => {
    const rpc = Object.assign(new Error("RPC submit: Insufficient funds to pay for gas fees and value for a transaction"), {
      name: "InternalRpcError",
    });
    const funds = Object.assign(
      new Error(
        "The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account.",
      ),
      { name: "InsufficientFundsError", cause: rpc },
    );
    const exec = Object.assign(new Error("transaction execution failed"), {
      name: "TransactionExecutionError",
      cause: funds,
    });
    const reverted = Object.assign(new Error("The contract function \"transfer\" reverted"), {
      name: "ContractFunctionRevertedError",
      cause: exec,
    });
    return Object.assign(new Error("ContractFunctionExecutionError"), {
      name: "ContractFunctionExecutionError",
      cause: reverted,
    });
  };

  it("detects the nested viem insufficient-funds chain", () => {
    expect(isInsufficientFundsError(nested())).toBe(true);
  });

  it("detects a bare InsufficientFundsError and an RPC message", () => {
    expect(isInsufficientFundsError(Object.assign(new Error("x"), { name: "InsufficientFundsError" }))).toBe(true);
    expect(
      isInsufficientFundsError(new Error("RPC submit: Insufficient funds to pay for gas fees")),
    ).toBe(true);
  });

  it("does not misfire on unrelated or empty errors", () => {
    expect(isInsufficientFundsError(undefined)).toBe(false);
    expect(isInsufficientFundsError(new Error("User rejected the request"))).toBe(false);
    expect(
      isInsufficientFundsError(
        Object.assign(new Error("estimateGas failed"), { name: "ContractFunctionExecutionError" }),
      ),
    ).toBe(false);
  });

  it("builds a wallet-side no-gas message", () => {
    expect(formatWalletNoGasMessage("ETH", "USDT")).toBe(
      "Your wallet doesn't have enough ETH to pay the network fee for this USDT transfer. Add a little ETH, then try again.",
    );
  });
});

describe("debug trace", () => {
  const collect = () => {
    const lines: string[] = [];
    return { lines, debug: (m: string) => lines.push(m) };
  };

  it("traces the block decision with amounts", async () => {
    const { lines, debug } = collect();
    await findErc20GasShortfall(deps({ debug }), ETH_PARAMS);
    expect(lines.some((l) => l.includes("BLOCK"))).toBe(true);
    expect(lines.some((l) => l.includes("balance=0"))).toBe(true);
  });

  it("traces each fail-open skip reason", async () => {
    const contract = collect();
    await findErc20GasShortfall(deps({ getPayerCode: async () => "0x6080", debug: contract.debug }), ETH_PARAMS);
    expect(contract.lines.some((l) => l.includes("contract account"))).toBe(true);

    const rpc = collect();
    await findErc20GasShortfall(
      deps({
        getNativeBalance: async () => {
          throw new Error("rpc down");
        },
        debug: rpc.debug,
      }),
      ETH_PARAMS,
    );
    expect(rpc.lines.some((l) => l.includes("RPC read failed"))).toBe(true);
  });

  it("traces the fast-path pass without calling estimateGas", async () => {
    const { lines, debug } = collect();
    const estimate = vi.fn(async () => 50_000n);
    await findErc20GasShortfall(
      deps({
        getNativeBalance: async () => ERC20_TRANSFER_GAS_FALLBACK * 2n * GWEI,
        estimateTransferGas: estimate,
        debug,
      }),
      ETH_PARAMS,
    );
    expect(estimate).not.toHaveBeenCalled();
    expect(lines.some((l) => l.includes("estimateGas skipped"))).toBe(true);
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
      "Your wallet has no ETH to pay the network fee (about $0.26 needed). Add a little ETH, or pay with USDC on Base / BNB / Polygon from a wallet that holds a few cents of that chain's gas coin.",
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
    expect(msg).toContain("USDC on BNB / Polygon from a wallet");
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
