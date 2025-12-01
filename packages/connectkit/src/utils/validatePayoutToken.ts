import {
  getChainName,
  supportedPayoutTokens,
  Token,
} from "@rozoai/intent-common";

export type ValidationError = {
  type: "unsupported_chain" | "unsupported_token";
  chainId: number;
  tokenAddress: string;
  message: string;
};

/**
 * Validates if a chain and token combination is supported for payouts
 * based on the supportedPayoutTokens map.
 *
 * @param chainId - The destination chain ID
 * @param tokenAddress - The token address (or identifier for non-EVM chains)
 * @returns ValidationError if invalid, null if valid
 */
export function validatePayoutToken(
  chainId: number,
  tokenAddress: string
): ValidationError | null {
  // Check if chain is supported
  const tokensForChain = supportedPayoutTokens.get(chainId);

  if (!tokensForChain || tokensForChain.length === 0) {
    return {
      type: "unsupported_chain",
      chainId,
      tokenAddress,
      message: `Chain ID ${chainId} is not supported for payouts. Supported chains: ${Array.from(
        supportedPayoutTokens.keys()
      ).join(", ")}`,
    };
  }

  // Normalize token addresses for comparison
  const normalizedInput = tokenAddress.toLowerCase();

  // Check if token is supported on this chain
  const isTokenSupported = tokensForChain.some((token: Token) => {
    const normalizedToken = token.token.toLowerCase();
    return normalizedToken === normalizedInput;
  });

  if (!isTokenSupported) {
    const supportedTokensList = tokensForChain
      .map((t: Token) => `${t.symbol} (${t.token})`)
      .join(", ");

    return {
      type: "unsupported_token",
      chainId,
      tokenAddress,
      message: `Token ${tokenAddress} is not supported on chain ${chainId}. Supported tokens: ${supportedTokensList}`,
    };
  }

  return null;
}

/**
 * Gets user-friendly error message for validation errors
 */
export function getValidationErrorMessage(error: ValidationError): string {
  if (error.type === "unsupported_chain") {
    return `The destination chain (ID: ${error.chainId}) is not currently supported for payouts. Please use one of the supported chains.`;
  }

  return `The token you're trying to receive is not supported on this chain. Please choose a supported token.`;
}

/**
 * Gets detailed error message with supported options
 */
export function getDetailedValidationError(error: ValidationError): {
  title: string;
  message: string;
} {
  if (error.type === "unsupported_chain") {
    const supportedChains = Array.from(supportedPayoutTokens.keys());
    const chainsList = supportedChains
      .map((id) => getChainName(id) || `Chain ${id}`)
      .join(", ");

    return {
      title: "Unsupported Chain",
      message: `Chain ID ${error.chainId} is not supported for payouts. Supported chains: ${chainsList}`,
    };
  }

  // unsupported_token
  const tokensForChain = supportedPayoutTokens.get(error.chainId);
  const supportedTokens = tokensForChain
    ? tokensForChain.map((t) => t.symbol).join(", ")
    : "None";

  return {
    title: "Unsupported Token",
    message: `The token is not supported on this chain. Supported tokens: ${supportedTokens}`,
  };
}
