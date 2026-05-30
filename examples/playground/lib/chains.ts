import {
  getChainById,
  supportedPayoutTokens,
  type Token,
} from "@rozoai/intent-common";

export interface ChainOption {
  chainId: number;
  name: string;
  type: "evm" | "solana" | "stellar";
}

export interface TokenOption {
  token: string;
  symbol: string;
}

export function getSupportedChains(): ChainOption[] {
  const chainIds = Array.from(supportedPayoutTokens.keys());
  return chainIds
    .map((id) => {
      const chain = getChainById(id);
      if (!chain) return null;
      return {
        chainId: id,
        name: chain.name,
        type: chain.type as "evm" | "solana" | "stellar",
      };
    })
    .filter((c): c is ChainOption => c !== null);
}

export function getTokensForChain(chainId: number): TokenOption[] {
  const tokens: Token[] = supportedPayoutTokens.get(chainId) ?? [];
  return tokens.map((t) => ({
    token: t.token,
    symbol: t.symbol,
  }));
}
