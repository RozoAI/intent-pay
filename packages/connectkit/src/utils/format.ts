import { BigIntStr, RozoPayToken } from "@rozoai/intent-common";
import { formatUnits } from "viem";

export const USD_DECIMALS = 2;

/**
 * Fallback for `token.displayDecimals` when absent. Mirrors
 * `defaultDisplayDecimals` in @rozoai/intent-common's token.ts — kept local
 * since connectkit currently pins an older published version of that
 * package where `displayDecimals` is still required (see PR #57 review).
 */
export function fallbackDisplayDecimals(decimals: number): number {
  return decimals === 18 ? 5 : decimals === 9 ? 4 : 6;
}

/**
 * Strip trailing zeros (and a trailing decimal point) from a fixed-decimal
 * numeric string without round-tripping through `Number`/`parseFloat`,
 * which rewrite small magnitudes into scientific notation (e.g. "1e-7")
 * and silently turn non-finite input into "NaN"/"Infinity".
 */
export function stripTrailingZeros(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}

export function formatTokenAmount(amount: number, decimals: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error(`formatTokenAmount: non-finite amount ${amount}`);
  }
  return stripTrailingZeros(amount.toFixed(decimals));
}


/**
 * Round a number to a given number of decimal places
 *
 * @param round - The rounding strategy to use:
 * - "up": Always rounds up to the next decimal place (ceiling)
 * - "down": Always rounds down to the previous decimal place (floor)
 * - "nearest": Rounds to the nearest decimal place (standard rounding)
 */
export function roundDecimals(
  value: number,
  decimals: number,
  round: "up" | "down" | "nearest",
): string {
  const factor = 10 ** decimals;
  const multiplied = value * factor;

  let rounded: number;
  if (round === "up") {
    rounded = Math.ceil(multiplied);
  } else if (round === "down") {
    rounded = Math.floor(multiplied);
  } else {
    rounded = Math.round(multiplied);
  }

  return (rounded / factor).toFixed(decimals);
}

/**
 * Format a number as a USD amount
 *
 * @param usd - The USD amount to format
 * @param round - The rounding strategy to use ("up", "down", or "nearest")
 * @returns The formatted USD amount
 */
export function formatUsd(
  usd: number,
  round: "up" | "down" | "nearest" = "down",
  fiatISO = "USD",
  decimals: number = USD_DECIMALS,
): string {
  const currency = fiatISO.toUpperCase();
  const value = Number(roundDecimals(usd, decimals, round));

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: decimals,
    }).format(value);
  }
}

/**
 * Round a USD amount to `USD_DECIMALS` precision
 */
export function roundUsd(usd: number, round: "up" | "down" | "nearest" = "down"): string {
  return roundDecimals(usd, USD_DECIMALS, round);
}

/**
 * Round a token amount to `displayDecimals` precision
 */
export function roundTokenAmount(
  amount: bigint | BigIntStr,
  token: RozoPayToken,
  round: "up" | "down" | "nearest" = "down",
): string {
  // Convert to BigInt, handling various input types
  let amountBigInt: bigint;
  if (typeof amount === "bigint") {
    amountBigInt = amount;
  } else if (typeof amount === "string") {
    // Handle scientific notation or regular string numbers
    if (amount.includes("e") || amount.includes("E")) {
      // Convert scientific notation to regular number, then to BigInt
      amountBigInt = BigInt(Math.floor(Number(amount)));
    } else {
      amountBigInt = BigInt(amount);
    }
  } else if (typeof amount === "number") {
    // Handle plain numbers (shouldn't happen per type, but defensive)
    amountBigInt = BigInt(Math.floor(amount));
  } else {
    throw new Error(`Invalid amount type: ${typeof amount}`);
  }

  const formattedAmount = formatUnits(amountBigInt, token.decimals);

  const displayDecimals = token.displayDecimals ?? fallbackDisplayDecimals(token.decimals);
  return stripTrailingZeros(roundDecimals(Number(formattedAmount), displayDecimals, round));
}

/** Strip trailing zeros from a decimal token amount string. e.g. "0.01600" → "0.016" */
export function trimTokenAmount(amount: string): string {
  return stripTrailingZeros(amount);
}

/**
 * Round a token amount in units to `displayDecimals` precision
 */
export function roundTokenAmountUnits(
  amountUnits: number,
  token: RozoPayToken,
  round: "up" | "down" | "nearest" = "down",
): string {
  // Use token.displayDecimals for full precision, strip trailing zeros
  const displayDecimals = token.displayDecimals ?? fallbackDisplayDecimals(token.decimals);
  return stripTrailingZeros(roundDecimals(amountUnits, displayDecimals, round));
}

/**
 * Convert a USD amount to a token amount with `displayDecimals` precision
 *
 * @param usd - The USD amount to convert
 * @param token - The token to convert to
 * @param round - The rounding strategy to use ("up", "down", or "nearest")
 * @returns The token amount
 */
export function usdToRoundedTokenAmount(
  usd: number,
  token: RozoPayToken,
  round: "up" | "down" | "nearest" = "down",
): string {
  return roundTokenAmountUnits(usd / token.usd, token, round);
}

/**
 * Convert a token amount to a USD amount with `USD_DECIMALS` precision
 *
 * @param amount - The token amount to convert
 * @param token - The token to convert from
 * @param round - The rounding strategy to use ("up", "down", or "nearest")
 * @returns The formatted USD amount
 */
export function tokenAmountToRoundedUsd(
  amount: bigint | BigIntStr,
  token: RozoPayToken,
  round: "up" | "down" | "nearest" = "nearest",
): string {
  const amountUnits = formatUnits(BigInt(amount), token.decimals);
  return roundUsd(Number(amountUnits) * token.usd, round);
}
