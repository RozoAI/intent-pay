import { apiClient, ApiResponse } from "./base";

export interface TokenPrice {
  currency: string;
  value: string;
  lastUpdatedAt: string;
}

export interface TokenPriceEntry {
  symbol: string;
  prices: TokenPrice[];
  source: string;
  stale: boolean;
  error: string | null;
}

export interface TokenPriceMeta {
  quoteBufferBps: number;
  priceMaxAgeMin: number;
}

export interface TokenPriceResponse {
  data: TokenPriceEntry[];
  meta: TokenPriceMeta;
}

export interface GetTokenPricesParams {
  symbols?: string[];
}

export const getTokenPrices = async (
  params: GetTokenPricesParams = {},
): Promise<ApiResponse<TokenPriceResponse>> => {
  const { symbols } = params;
  const query = symbols && symbols.length > 0 ? { symbols: symbols.join(",") } : undefined;
  return apiClient.get<TokenPriceResponse>("token-prices/tokens/by-symbol", {
    params: query,
  });
};
