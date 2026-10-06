import {
  arbitrum,
  base,
  bsc,
  ethereum,
  getChainNativeToken,
  getKnownToken,
  isNativeToken,
  normalizeTokenAddress,
  polygon,
  rozoSolana,
  rozoStellar,
  solana,
  solanaSOL,
  stellar,
  stellarXLM,
  supportedTokens,
  Token,
  TokenSymbol,
} from "@rozoai/intent-common";
import { zeroAddress } from "viem";

export { isNativeToken };

// Natives are payment SOURCES only, so they stay out of supportedTokens: that
// map feeds getKnownToken/isTokenSupported (destination validation) and the
// proxy builds stablecoin deposit rows from it. Expose every native here
// instead — EVM via the chain registry, SOL/XLM as explicit source entries.
const evmNativeSourceTokens = [arbitrum, base, bsc, ethereum, polygon].map((chain) =>
  getChainNativeToken(chain.chainId),
);
export const sourcePaymentTokens = [
  ...Array.from(supportedTokens.values()).flat(),
  ...evmNativeSourceTokens,
  solanaSOL,
  stellarXLM,
];

/** Compare proxy source identities without changing destination or quoted addresses. */
export function normalizeSourceTokenAddress(chainId: number, address: string): string {
  if (
    (chainId === solana.chainId || chainId === rozoSolana.chainId) &&
    (address === "native" || address === "11111111111111111111111111111112" || address === solanaSOL.token)
  ) {
    return solanaSOL.token;
  }
  if (
    (chainId === stellar.chainId || chainId === rozoStellar.chainId) &&
    (address === "XLM" || address === stellarXLM.token)
  ) {
    return stellarXLM.token;
  }
  if (
    evmNativeSourceTokens.some((token) => token.chainId === chainId) &&
    address.startsWith("0x") &&
    isNativeToken(address)
  ) {
    return zeroAddress;
  }
  return normalizeTokenAddress(chainId, address) ?? address;
}

export function sourceTokenChainId(chainId: number): number {
  if (chainId === solana.chainId) return rozoSolana.chainId;
  if (chainId === stellar.chainId) return rozoStellar.chainId;
  return chainId;
}

/** A quoted source may use the proxy sentinel, unlike known payout tokens. */
export function getSourcePaymentToken(chainId: number, address: string): Token | undefined {
  return (
    getKnownToken(chainId, address) ??
    sourcePaymentTokens.find(
      (token) =>
        sourceTokenChainId(token.chainId) === sourceTokenChainId(chainId) &&
        normalizeSourceTokenAddress(token.chainId, token.token) ===
          normalizeSourceTokenAddress(chainId, address),
    )
  );
}

/**
 * Converts preferredSymbol array to preferredTokens array.
 *
 * Explicit preferredSymbol values are respected as given: stablecoins
 * (USDC, USDT, USDT0, EURC) or native (ETH/BNB/POL/SOL/XLM). When neither
 * preferredSymbol nor preferredTokens is provided, defaults to stablecoins
 * plus native tokens so native options aren't silently filtered out of the
 * default request. Matches tokens across supported chains (Base, Polygon,
 * Ethereum, Solana, Stellar) via sourcePaymentTokens, which includes the
 * source-only EVM natives kept outside supportedTokens.
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
      : [TokenSymbol.USDC, TokenSymbol.USDT, TokenSymbol.USDT0, ...nativeSymbols];

  // Validate that only allowed symbols are used
  const allowedSymbols = [
    TokenSymbol.USDC,
    TokenSymbol.USDT,
    TokenSymbol.USDT0,
    TokenSymbol.EURC,
    ...nativeSymbols,
  ];
  const validSymbols = symbolsToUse.filter((s) => allowedSymbols.includes(s));
  const invalidSymbols = symbolsToUse.filter((s) => !allowedSymbols.includes(s));

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
  for (const token of sourcePaymentTokens) {
    if (symbolSet.has(token.symbol as TokenSymbol)) {
      tokens.push(token);
    }
  }

  return tokens.length > 0 ? tokens : undefined;
}

/** Resolve the canonical Stellar asset, never trust a wallet option's issuer or symbol. */
export function getStellarPaymentAsset(tokenAddress: string): { code: string; issuer: string } {
  const token = getKnownToken(rozoStellar.chainId, tokenAddress);
  const [code, issuer] = token?.token.split(":") ?? [];
  if (!token || !code || !issuer || code !== token.symbol) {
    throw new Error("Unsupported Stellar token");
  }
  return { code, issuer };
}
