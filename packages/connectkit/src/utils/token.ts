import { supportedTokens, Token, TokenSymbol } from "@rozoai/intent-common";

/**
 * Converts preferredSymbol array to preferredTokens array.
 * Only USDC, USDT, and EURC symbols are allowed.
 * Finds tokens matching the symbols across supported chains (Base, Polygon, Ethereum, Solana, Stellar).
 */
export function convertPreferredSymbolsToTokens(
  symbols: TokenSymbol[] | undefined,
  existingPreferredTokens: Token[] | undefined
): Token[] | undefined {
  // If preferredTokens is explicitly provided, it takes precedence
  // Even if it's an empty array, we respect it (means "no preferred tokens")
  if (existingPreferredTokens !== undefined) {
    return existingPreferredTokens;
  }

  // If no preferredSymbol provided, default to USDC and USDT
  const symbolsToUse =
    symbols && symbols.length > 0
      ? symbols
      : [TokenSymbol.USDC, TokenSymbol.USDT];

  // Validate that only allowed symbols are used
  const allowedSymbols = [TokenSymbol.USDC, TokenSymbol.USDT, TokenSymbol.EURC];
  const validSymbols = symbolsToUse.filter((s) => allowedSymbols.includes(s));
  const invalidSymbols = symbolsToUse.filter(
    (s) => !allowedSymbols.includes(s)
  );

  if (invalidSymbols.length > 0) {
    console.warn(
      `[RozoPay] Invalid preferredSymbol values: ${invalidSymbols.join(
        ", "
      )}. Only USDC, USDT, and EURC are allowed.`
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
