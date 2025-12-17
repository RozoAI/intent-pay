import { supportedChains, supportedTokens, Token } from "@rozoai/intent-common";

export function useSupportedChains(): {
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
