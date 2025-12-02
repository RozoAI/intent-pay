import { getChainName } from "./chain";
import { getKnownToken } from "./token";

/**
 * Contract an Ethereum address to a shorter string.
 *
 * Example:
 * 0x1234567890123456789012345678901234567890
 * becomes
 * 0x1234…7890
 */
export function getAddressContraction(address: string, length = 4): string {
  return address.slice(0, 2 + length) + "…" + address.slice(-length);
}

/** Convert a JS Date object to a UNIX timestamp. */
export function dateToUnix(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

/** Convert a UNIX timestamp to a JS Date object. */
export function unixToDate(unix: number): Date {
  return new Date(unix * 1000);
}

export function generateEVMDeepLink({
  amountUnits,
  chainId,
  recipientAddress,
  tokenAddress,
}: {
  tokenAddress: string;
  chainId: number;
  recipientAddress: string;
  amountUnits: string;
}): string {
  return `ethereum:${tokenAddress}@${chainId}/transfer?address=${recipientAddress}&uint256=${amountUnits}`;
}

export function generateIntentTitle({
  toChainId,
  toTokenAddress,
  preferredChainId,
  preferredTokenAddress,
}: {
  toChainId: number;
  toTokenAddress: string;
  preferredChainId: number;
  preferredTokenAddress: string;
}): string {
  const toChainName = getChainName(toChainId);
  const preferredChainName = getChainName(preferredChainId);
  const toToken = getKnownToken(toChainId, toTokenAddress);
  const preferredToken = getKnownToken(preferredChainId, preferredTokenAddress);

  if (!toToken || !preferredToken) {
    return "Pay";
  }

  if (toToken.chainId === preferredToken.chainId) {
    return `Pay with ${preferredToken.symbol} (${preferredChainName})`;
  }

  return `Pay with ${preferredToken.symbol} (${preferredChainName}) to ${toToken.symbol} (${toChainName})`;
}
