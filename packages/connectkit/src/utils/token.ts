import { isNativeToken, supportedTokens, Token, TokenSymbol } from "@rozoai/intent-common";

export { isNativeToken };

/**
 * Converts preferredSymbol array to preferredTokens array.
 * Explicit preferredSymbol values are respected as given (USDC, USDT, EURC,
 * or native ETH/BNB/POL/SOL/XLM). When neither preferredSymbol nor
 * preferredTokens is provided, defaults to stablecoins plus native tokens
 * so native options aren't silently filtered out of the default request.
 * Finds tokens matching the symbols across supported chains (Base, Polygon, Ethereum, Solana, Stellar).
 */
export function convertPreferredSymbolsToTokens(
  symbols: TokenSymbol[] | undefined,
  existingPreferredTokens: Token[] | undefined,
): Token[] | undefined {
  // If preferredTokens is explicitly provided, it takes precedence
  // Even if it's an empty array, we respect it (means "no preferred tokens")
  if (existingPreferredTokens !== undefined) {
    return existingPreferredTokens.filter((v) => !!v);
  }

  const nativeSymbols = [
    TokenSymbol.ETH,
    TokenSymbol.BNB,
    TokenSymbol.POL,
    TokenSymbol.SOL,
    TokenSymbol.XLM,
  ];

  // If no preferredSymbol provided, default to stablecoins plus native tokens
  const symbolsToUse =
    symbols && symbols.length > 0
      ? symbols
      : [TokenSymbol.USDC, TokenSymbol.USDT, ...nativeSymbols];

  // Validate that only allowed symbols are used
  const allowedSymbols = [
    TokenSymbol.USDC,
    TokenSymbol.USDT,
    TokenSymbol.EURC,
    ...nativeSymbols,
  ];
  const validSymbols = symbolsToUse.filter((s) => allowedSymbols.includes(s));
  const invalidSymbols = symbolsToUse.filter(
    (s) => !allowedSymbols.includes(s),
  );

  if (invalidSymbols.length > 0) {
    console.warn(
      `[RozoPay] Invalid preferredSymbol values: ${invalidSymbols.join(
        ", ",
      )}. Allowed: ${allowedSymbols.join(", ")}.`,
    );
  }

  if (validSymbols.length === 0) {
    return undefined;
  }

  // Filter supportedTokens by the provided symbols
  const tokens: Token[] = [];
  const symbolSet = new Set(validSymbols);

  // Iterate through all supported tokens (organized by chain)
  for (const chainTokens of supportedTokens.values()) {
    for (const token of chainTokens) {
      if (symbolSet.has(token.symbol as TokenSymbol)) {
        tokens.push(token);
      }
    }
  }

  return tokens.length > 0 ? tokens : undefined;
}
