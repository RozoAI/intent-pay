import {
  getChainNativeToken,
  getKnownToken,
  normalizeTokenAddress,
  rozoSolana,
  rozoStellar,
  solana,
  stellar,
} from "@rozoai/intent-common";

/**
 * A source the payer is likely to use again, e.g. the chain and token of
 * their last successful payment. Ordering hint only: options matching it are
 * listed first, nothing is ever hidden or preselected.
 */
export type SuggestedSource = {
  chainId: number;
  /** Token symbol, e.g. "USDC", or "Native" for the chain's native asset. Case-insensitive. */
  symbol?: string;
};

// Solana and Stellar each have a native and a Rozo chain ID; either one in
// `suggestedSource.chainId` must match options that carry the other.
const CHAIN_ALIASES: number[][] = [
  [solana.chainId, rozoSolana.chainId],
  [stellar.chainId, rozoStellar.chainId],
];

function sameChain(a: number, b: number): boolean {
  if (a === b) return true;
  return CHAIN_ALIASES.some((ids) => ids.includes(a) && ids.includes(b));
}

/**
 * Sort key for an option paying with `token` on `chainId`:
 * 0 = same chain and symbol, 1 = same chain, 2 = anything else (or no
 * suggestion). Lower sorts first.
 */
export function suggestedSourceRank(
  chainId: number,
  tokenAddress: string,
  suggested: SuggestedSource | undefined,
): number {
  if (!suggested || !sameChain(chainId, suggested.chainId)) return 2;
  if (!suggested.symbol) return 1;
  if (suggested.symbol.toUpperCase() === "NATIVE") {
    try {
      const native = getChainNativeToken(chainId);
      return normalizeTokenAddress(chainId, tokenAddress) ===
        normalizeTokenAddress(chainId, native.token) ? 0 : 1;
    } catch {
      // Unknown chains have no registered native asset; retain chain-only ranking.
      return 1;
    }
  }
  const symbol = getKnownToken(chainId, tokenAddress)?.symbol;
  return symbol && symbol.toUpperCase() === suggested.symbol.toUpperCase() ? 0 : 1;
}
