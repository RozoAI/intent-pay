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

export function generateSolanaDeepLink({
  amountUnits,
  recipientAddress,
  tokenAddress,
  memo,
}: {
  tokenAddress: string;
  recipientAddress: string;
  amountUnits: string;
  memo?: string | null;
}): string {
  const params = [
    amountUnits ? `amount=${encodeURIComponent(amountUnits)}` : null,
    tokenAddress ? `spl-token=${encodeURIComponent(tokenAddress)}` : null,
    memo ? `memo=${encodeURIComponent(memo)}` : null,
  ]
    .filter(Boolean)
    .join("&");

  return `solana:${encodeURIComponent(recipientAddress)}${params ? "?" + params : ""}`;
}

/**
 * SEP-0007 `web+stellar:pay` URI for Stellar Classic (G-address + memo)
 * deposits. Wallets (Lobstr, Freighter) prefill destination, amount, asset
 * and memo from it when scanning the deposit QR.
 *
 * `tokenAddress` is `CODE:ISSUER`, a bare issuer G-address (USDC on the
 * native Stellar chain), or the native placeholder for XLM.
 */
export function generateStellarDeepLink({
  amount,
  destination,
  memo,
  tokenAddress,
  tokenSymbol,
}: {
  destination: string;
  amount?: string | null;
  tokenAddress: string;
  tokenSymbol: string;
  memo?: string | null;
}): string {
  const params = [`destination=${encodeURIComponent(destination)}`];
  if (amount) params.push(`amount=${encodeURIComponent(amount)}`);
  if (tokenAddress.includes(":")) {
    const [code, issuer] = tokenAddress.split(":");
    params.push(`asset_code=${encodeURIComponent(code)}`);
    params.push(`asset_issuer=${encodeURIComponent(issuer)}`);
  } else if (tokenSymbol === "XLM") {
    // Native XLM: SEP-0007 signals native by omitting asset fields entirely.
    // A bare asset_code with no issuer is not a valid asset and wallets
    // may reject or mis-parse it.
  } else {
    params.push(`asset_code=${encodeURIComponent(tokenSymbol)}`);
    params.push(`asset_issuer=${encodeURIComponent(tokenAddress)}`);
  }
  if (memo) {
    // Always MEMO_TEXT: the wallet path (payWithStellarToken) attaches memos
    // via Memo.text, so the QR must agree or the XDR memo types mismatch.
    params.push(`memo=${encodeURIComponent(memo)}`);
    params.push(`memo_type=MEMO_TEXT`);
  }
  return `web+stellar:pay?${params.join("&")}`;
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

  return `Pay to ${toToken.symbol} (${toChainName})`;
}
