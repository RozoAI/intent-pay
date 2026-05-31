import {
  Arbitrum,
  Base,
  BinanceSmartChain,
  Ethereum,
  HyperEVM,
  Optimism,
  Polygon,
  Solana,
  Stellar,
} from "@/components/Chains";
import {
  getChainById,
  supportedPayoutTokens,
  TokenLogo,
  type Token,
} from "@rozoai/intent-common";
import type { ComponentType, SVGProps } from "react";

type LogoComponent = ComponentType<
  Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
    width?: number | string;
    height?: number | string;
  }
>;

const CHAIN_LOGO_MAP: Record<number, LogoComponent> = {
  42161: Arbitrum,
  8453: Base,
  56: BinanceSmartChain,
  1: Ethereum,
  999: HyperEVM,
  10: Optimism,
  137: Polygon,
  900: Solana,
  501: Solana,
  1500: Stellar,
  10001: Stellar,
};

const TOKEN_LOGO_MAP: Record<string, string> = {
  ETH: TokenLogo.ETH,
  WETH: TokenLogo.WETH,
  USDC: TokenLogo.USDC,
  EURC: TokenLogo.EURC,
  USDT: TokenLogo.USDT,
  DAI: TokenLogo.DAI,
  POL: TokenLogo.POL,
  AVAX: TokenLogo.AVAX,
  BNB: TokenLogo.BNB,
  SOL: TokenLogo.SOL,
  WLD: TokenLogo.WLD,
  USDB: TokenLogo.USDB,
  BLAST: TokenLogo.BLAST,
  WBTC: TokenLogo.WBTC,
  MNT: TokenLogo.MNT,
  CELO: TokenLogo.CELO,
  cUSD: TokenLogo.cUSD,
  XLM: TokenLogo.XLM,
  HYPE: TokenLogo.HYPE,
};

export interface ChainOption {
  chainId: number;
  name: string;
  type: "evm" | "solana" | "stellar";
  LogoComponent?: LogoComponent;
}

export interface TokenOption {
  token: string;
  symbol: string;
  logoUrl?: string;
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
        LogoComponent: CHAIN_LOGO_MAP[id],
      };
    })
    .filter((c): c is ChainOption => c !== null);
}

export function getTokensForChain(chainId: number): TokenOption[] {
  const tokens: Token[] = supportedPayoutTokens.get(chainId) ?? [];
  return tokens.map((t) => ({
    token: t.token,
    symbol: t.symbol,
    logoUrl: TOKEN_LOGO_MAP[t.symbol],
  }));
}
