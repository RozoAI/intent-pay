import { getTokenPrices } from "@rozoai/intent-common";
import { formatUnits } from "viem";

/**
 * Pre-flight check for ERC20 payments on EVM chains: does the payer hold
 * enough native coin (ETH / BNB / POL / ...) to pay the network fee?
 *
 * Without this, a wallet holding USDC but zero ETH gets an opaque wallet
 * rejection and the SDK shows "Retry Payment" with no reason, so the payer
 * retries forever (real case: 2026-10-07, 8 retries, USDC 10.83 / ETH 0 on
 * Ethereum).
 *
 * Design rules:
 * - Fail open. Any RPC error, any smart-contract account (Safe, smart
 *   wallets, EIP-7702 delegated EOAs) and any wallet that advertises gas
 *   sponsorship skips the check. A false block costs a real payment; a
 *   missed block only costs the old behaviour.
 * - Lenient fee: estimateGas x eth_gasPrice (current price, not maxFeePerGas
 *   worst case). Only block when the balance cannot cover even that.
 */

/** A plain ERC20 transfer costs ~35k-65k gas. A balance covering this much
 * gas is treated as sufficient without calling estimateGas. */
export const ERC20_TRANSFER_GAS_FALLBACK = 65_000n;

/** Intrinsic gas of any EVM transaction: a proven lower bound, used when
 * estimateGas fails so an RPC hiccup can never manufacture a shortfall. */
export const MIN_TX_GAS = 21_000n;

export interface NativeGasShortfall {
  chainId: number;
  chainName: string;
  nativeSymbol: string;
  nativeDecimals: number;
  tokenSymbol: string;
  /** Atomic units of the native coin held by the payer. */
  nativeBalance: bigint;
  /** Atomic units of the native coin the transfer is estimated to cost. */
  requiredFee: bigint;
  /** USD value of requiredFee, or null when no price was available. */
  gasEstimateUsd: number | null;
}

export class InsufficientNativeGasError extends Error {
  readonly shortfall: NativeGasShortfall;
  constructor(shortfall: NativeGasShortfall) {
    super(formatNoGasMessage(shortfall));
    this.name = "InsufficientNativeGasError";
    this.shortfall = shortfall;
  }
}

export function isInsufficientNativeGasError(e: unknown): e is InsufficientNativeGasError {
  return (
    e instanceof InsufficientNativeGasError ||
    ((e as { name?: string } | null)?.name === "InsufficientNativeGasError" &&
      (e as { shortfall?: unknown }).shortfall != null)
  );
}

/** Wallet capabilities (EIP-5792) that mean someone else may pay gas. */
export function walletMaySponsorGas(chainCapabilities: unknown): boolean {
  if (!chainCapabilities || typeof chainCapabilities !== "object") return false;
  const caps = chainCapabilities as Record<string, { supported?: boolean } | undefined>;
  return !!(caps.paymasterService?.supported || caps.auxiliaryFunds?.supported);
}

export interface Erc20GasPrecheckDeps {
  getNativeBalance: () => Promise<bigint>;
  getGasPrice: () => Promise<bigint>;
  /** Gas units for the exact transfer call. May throw; fallback is used. */
  estimateTransferGas: () => Promise<bigint>;
  /** Bytecode at the payer address ("0x" / undefined for a plain EOA). */
  getPayerCode: () => Promise<string | undefined>;
}

export interface Erc20GasPrecheckParams {
  chainId: number;
  chainName: string;
  nativeSymbol: string;
  nativeDecimals: number;
  tokenSymbol: string;
}

/**
 * Returns a shortfall when the payer provably cannot cover the network fee,
 * otherwise null (including every case where we are unsure).
 */
export async function findErc20GasShortfall(
  deps: Erc20GasPrecheckDeps,
  params: Erc20GasPrecheckParams,
): Promise<Omit<NativeGasShortfall, "gasEstimateUsd"> | null> {
  let nativeBalance: bigint;
  let gasPrice: bigint;
  let code: string | undefined;
  try {
    [nativeBalance, gasPrice, code] = await Promise.all([
      deps.getNativeBalance(),
      deps.getGasPrice(),
      deps.getPayerCode(),
    ]);
  } catch {
    return null;
  }

  // Contract accounts (Safe, smart wallets, EIP-7702 delegations) may have
  // gas paid by a signer, bundler or paymaster: their own balance proves
  // nothing.
  if (code && code !== "0x") return null;
  if (gasPrice <= 0n) return null;

  // Cheap exit before the extra RPC round trip: if the balance already
  // covers the fallback gas, it covers any realistic transfer.
  if (nativeBalance >= ERC20_TRANSFER_GAS_FALLBACK * gasPrice) return null;

  let gas: bigint;
  try {
    gas = await deps.estimateTransferGas();
    if (gas < MIN_TX_GAS) gas = MIN_TX_GAS;
  } catch {
    // Unknown cost: only block if the balance cannot even cover a bare
    // transaction.
    gas = MIN_TX_GAS;
  }

  const requiredFee = gas * gasPrice;
  if (nativeBalance >= requiredFee) return null;

  return { ...params, nativeBalance, requiredFee };
}

const ALTERNATIVE_CHAINS: { chainId: number; label: string }[] = [
  { chainId: 8453, label: "Base" },
  { chainId: 56, label: "BNB" },
  { chainId: 137, label: "Polygon" },
];

function formatUsd(usd: number): string {
  if (usd < 0.01) return "less than $0.01";
  return `$${usd.toFixed(2)}`;
}

function formatNative(atomic: bigint, decimals: number, symbol: string): string {
  const n = Number(formatUnits(atomic, decimals));
  const shown = n === 0 ? "0" : n < 0.000001 ? "<0.000001" : n.toPrecision(2);
  return `${shown} ${symbol}`;
}

export function formatNoGasMessage(s: NativeGasShortfall): string {
  const sym = s.nativeSymbol;
  const has = s.nativeBalance === 0n ? `has no ${sym}` : `doesn't have enough ${sym}`;
  const needed =
    s.gasEstimateUsd != null
      ? `about ${formatUsd(s.gasEstimateUsd)} needed`
      : `about ${formatNative(s.requiredFee, s.nativeDecimals, sym)} needed`;
  const alternatives = ALTERNATIVE_CHAINS.filter((c) => c.chainId !== s.chainId)
    .map((c) => c.label)
    .join(" / ");
  return `Your wallet ${has} to pay the network fee (${needed}). Add a little ${sym}, or pay with USDC on ${alternatives} instead.`;
}

/** Telemetry payload: amounts only, never addresses. */
export function noGasTelemetry(s: NativeGasShortfall) {
  return {
    chain: s.chainId,
    chain_name: s.chainName,
    token: s.tokenSymbol,
    native_symbol: s.nativeSymbol,
    native_balance: formatUnits(s.nativeBalance, s.nativeDecimals),
    gas_estimate_native: formatUnits(s.requiredFee, s.nativeDecimals),
    gas_estimate_usd: s.gasEstimateUsd != null ? Number(s.gasEstimateUsd.toFixed(4)) : null,
  };
}

type PriceFetcher = (params: { symbols: string[] }) => Promise<{
  data: { data: { symbol: string; prices: { currency: string; value: string }[] }[] } | null;
}>;

/**
 * Best-effort USD price of a native coin, only fetched once a shortfall is
 * found (never on the happy path). Returns null on error/timeout.
 */
export async function fetchNativeUsdPrice(
  symbol: string,
  fetchPrices: PriceFetcher = getTokenPrices as unknown as PriceFetcher,
  timeoutMs = 2500,
): Promise<number | null> {
  try {
    const res = await Promise.race([
      fetchPrices({ symbols: [symbol] }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    const entry = res?.data?.data?.find((d) => d.symbol.toUpperCase() === symbol.toUpperCase());
    const usd = Number(entry?.prices.find((p) => p.currency.toLowerCase() === "usd")?.value);
    return Number.isFinite(usd) && usd > 0 ? usd : null;
  } catch {
    return null;
  }
}

export function feeToUsd(requiredFee: bigint, decimals: number, usdPrice: number | null): number | null {
  if (usdPrice == null) return null;
  const usd = Number(formatUnits(requiredFee, decimals)) * usdPrice;
  return Number.isFinite(usd) ? usd : null;
}
