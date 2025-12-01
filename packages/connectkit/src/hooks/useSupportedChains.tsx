import { supportedChains, supportedTokens, Token } from "@rozoai/intent-common";

/**
 * React hook: Returns currently supported wallet payment chains and tokens.
 *
 * All other chains and tokens from @rozoai/intent-common are included by default.
 *
 * ### Output:
 * - **Chains**: Includes all default chains.
 * - **Tokens**: Includes all default tokens.
 *
 * @param {string} appId  - Current Rozo appId.
 * @param {number[]} [preferredChains=[]] - Preferred chain IDs.
 * @returns {{
 *   chains: Array<{ chainId: number; [k: string]: any }>;
 *   tokens: Token[];
 * }} Object containing supported chain objects and tokens for wallet UI and payment logic.
 *
 * @example
 * // Usage: retrieve chains and tokens to render for this app/session
 * const { chains, tokens } = useSupportedChains("your_appId", [8453, 56]);
 *
 * // Output: all chains/tokens except Worldchain
 */
export function useSupportedChains(
  appId: string,
  preferredChains: number[] = []
): {
  chains: Array<{ chainId: number; [k: string]: any }>;
  tokens: Token[];
} {
  return {
    /**
     * Array of chain objects for wallet payment UI.
     */
    chains: supportedChains.filter(Boolean),
    /**
     * Array of supported tokens for payment widget.
     */
    tokens: Array.from(supportedTokens.values()).flat().filter(Boolean),
  };
}
