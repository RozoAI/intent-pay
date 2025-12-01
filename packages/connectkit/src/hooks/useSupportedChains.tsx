import {
  bsc,
  bscUSDT,
  supportedChains,
  supportedTokens,
  Token,
  worldchain,
  worldchainUSDC,
} from "@rozoai/intent-common";
import { useMemo } from "react";

// Filter out BSC and Worldchain from base lists (they have special conditional rules)
const baseSupportedChains = supportedChains.filter(
  (chain) =>
    chain.chainId !== bsc.chainId && chain.chainId !== worldchain.chainId
);
const baseSupportedTokens = Array.from(supportedTokens.values())
  .flat()
  .filter(
    (token) =>
      token.chainId !== bsc.chainId && token.chainId !== worldchain.chainId
  );

/**
 * React hook to retrieve supported wallet payment chains and tokens.
 *
 * Returns the list of currently active chains and tokens in wallet payment options,
 * with dynamic logic for including BSC/Worldchain based on appId or preferences.
 *
 * CURRENTLY SUPPORTED CHAINS/TOKENS:
 * - All chains/tokens from supportedChains and supportedTokens (from @rozoai/intent-common)
 *   - Includes: Arbitrum, Avalanche, Base, Ethereum, Gnosis, Optimism, Polygon, Solana, Stellar
 * - BSC (56) - USDT (only for MugglePay apps - appId includes "MP")
 * - Worldchain (480) - USDC (only for World apps or if in preferredChains)
 *
 * @param {string} appId - The Rozo appId; can affect which chains are enabled.
 * @param {number[]} [preferredChains=[]] - Preferred chain IDs (may enable Worldchain).
 * @returns {{
 *   chains: Array<{ chainId: number; [k: string]: any }>;
 *   tokens: Token[];
 * }} An object with arrays of supported chains and supported token addresses.
 *
 * @example
 * const { chains, tokens } = useSupportedChains("MP_demo", [8453, 56]);
 */
export function useSupportedChains(
  appId: string,
  preferredChains: number[] = []
): {
  chains: Array<{ chainId: number; [k: string]: any }>;
  tokens: Token[];
} {
  const showBSCUSDT = useMemo(() => appId.includes("MP"), [appId]);
  const showWorldchainUSDC = useMemo(
    () =>
      appId?.toLowerCase().includes("world") ||
      preferredChains?.includes(worldchain.chainId),
    [appId, preferredChains]
  );

  return {
    /**
     * Array of chain objects for use in wallet payment options UI.
     * Includes all supported chains from pay-common, plus BSC and Worldchain if indicated by appId/preferences.
     */
    chains: [
      ...baseSupportedChains,
      ...(showBSCUSDT ? [bsc] : []),
      ...(showWorldchainUSDC ? [worldchain] : []),
    ].filter(Boolean),
    /**
     * Array of supported payment token addresses.
     * Includes all supported tokens from pay-common, plus BSC USDT and Worldchain USDC if enabled.
     */
    tokens: [
      ...baseSupportedTokens,
      ...(showBSCUSDT ? [bscUSDT] : []),
      ...(showWorldchainUSDC ? [worldchainUSDC] : []),
    ].filter(Boolean),
  };
}
