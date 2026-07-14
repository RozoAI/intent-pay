import { BigIntStr, RozoPayToken, type Token } from "@rozoai/intent-common";
import { formatUnits, parseUnits } from "viem";

export const USD_DECIMALS = 2;

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
): string {
  const currency = fiatISO.toUpperCase();
  const value = Number(roundUsd(usd, round));

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
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

  // Use the token's own displayDecimals so small-quantity, high-unit-value
  // tokens render meaningfully: forcing 2 dp shows e.g. 0.00089 ETH as
  // "0.00". Stablecoins keep displayDecimals=2 → "1.00"; natives use 5.
  return roundDecimals(Number(formattedAmount), token.displayDecimals ?? USD_DECIMALS, round);
}

/**
 * Round a token amount in units to `displayDecimals` precision
 */
export function roundTokenAmountUnits(
  amountUnits: number,
  token: RozoPayToken,
  round: "up" | "down" | "nearest" = "down",
): string {
  return roundDecimals(amountUnits, token.displayDecimals ?? USD_DECIMALS, round);
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

/**
 * Build a Stellar SEP-0007 `pay` URI that opens a Stellar wallet with the
 * destination, amount, asset, and optional memo pre-filled.
 *
 * Native XLM uses asset_code=XLM with no asset_issuer. Custom assets use the
 * token address (issuer) and token symbol parsed from the Rozo token object.
 */
export function generateStellarDeepLink({
  amountUnits,
  recipientAddress,
  token,
  memo,
}: {
  amountUnits: string;
  recipientAddress: string;
  token: Token;
  memo?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("destination", recipientAddress);
  params.set("amount", amountUnits);

  const tokenAddress = token.token;
  let assetCode = token.symbol;
  let assetIssuer: string | undefined;

  if (tokenAddress.toLowerCase() !== "xlm") {
    const parts = tokenAddress.split(":");
    if (parts.length === 2) {
      assetCode = parts[0];
      assetIssuer = parts[1];
    } else {
      assetIssuer = tokenAddress;
    }
  }

  params.set("asset_code", assetCode);
  if (assetIssuer) {
    params.set("asset_issuer", assetIssuer);
  }
  if (memo) {
    params.set("memo", memo);
  }

  return `stellar:pay?${params.toString()}`;
}

/**
 * Convert a `RozoPayTokenAmount.amount` value to a full-precision, human-readable
 * decimal string suitable for sending to the backend (checkout/create-payment
 * payloads, on-chain transfer amounts, etc).
 *
 * `amount` is documented as `BigIntStr` (integer base units, e.g. lamports/wei)
 * but some endpoints (e.g. Solana tRPC payment options) have been observed to
 * return an already-human-readable decimal string instead (e.g. "0.012985327").
 * `BigInt()` throws on decimal strings, so this detects the shape first:
 * - Contains a "." → already a decimal token amount, pass through as-is.
 * - Otherwise → integer base units, convert via `formatUnits`.
 */
export function tokenBaseAmountToDecimalString(
  amount: bigint | string,
  decimals: number,
): string {
  if (typeof amount === "string" && amount.includes(".")) {
    return amount;
  }
  return formatUnits(BigInt(amount), decimals);
}

/**
 * Inverse of `tokenBaseAmountToDecimalString`: convert a
 * `RozoPayTokenAmount.amount` value to an integer base-units bigint, suitable
 * for on-chain transfer instructions (e.g. lamports for SOL, raw SPL/ERC20
 * transfer amounts).
 *
 * Same shape ambiguity as above — detects a decimal string (already
 * human-readable) and converts it up to base units via `parseUnits`;
 * otherwise assumes the string is already an integer base-units amount.
 */
/**
 * Strip trailing zeros from a non-native token amount string for display.
 * "0.0200" → "0.02", "1.5000" → "1.5", "1.0" → "1"
 * Only for display — never use for calculations or on-chain amounts.
 */
export function trimTokenAmount(amount: string): string {
  return String(parseFloat(amount));
}

export function tokenAmountToBaseUnits(amount: bigint | BigIntStr, decimals: number): bigint {
  if (typeof amount === "string" && amount.includes(".")) {
    return parseUnits(amount, decimals);
  }
  return BigInt(amount);
}
