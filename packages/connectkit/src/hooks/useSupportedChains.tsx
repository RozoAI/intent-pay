import { supportedChains, Token } from "@rozoai/intent-common";
import { sourcePaymentTokens } from "../utils/token";

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
    tokens: sourcePaymentTokens,
  };
}
