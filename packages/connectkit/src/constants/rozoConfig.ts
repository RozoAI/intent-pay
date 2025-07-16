import { stellar } from "@rozoai/intent-common";
import { Asset } from "@stellar/stellar-sdk";

export const ROZO_API_URL =
  "https://rozoai-api-proxy.xyuhje.easypanel.host/api";

/**
 * STELLAR CONSTANTS
 */
export const DEFAULT_STELLAR_RPC_URL = "https://horizon.stellar.org";

// --- Define the Assets for the Swap ---
export const STELLAR_NATIVE_ASSET = Asset.native();
export const STELLAR_USDC_ASSET_CODE = "USDC";
export const STELLAR_USDC_ISSUER_PK =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"; // Mainnet USDC Issuer

// --- ⭐️ Updated Static Token Information to match JSON structure ---
export const STELLAR_XLM_TOKEN_INFO = {
  chainId: stellar.chainId,
  token: "native",
  name: "Stellar Lumens",
  symbol: "XLM",
  decimals: 7,
  logoSourceURI: "https://invoice.rozo.ai//tokens/stellar.svg", // Placeholder
  logoURI: "https://invoice.rozo.ai/tokens/stellar.svg", // Placeholder
  usd: 0.1, // Default/fallback price
  priceFromUsd: 10,
  displayDecimals: 4,
  fiatSymbol: "$",
  maxAcceptUsd: 100000,
  maxSendUsd: 100000,
};

export const STELLAR_USDC_TOKEN_INFO = {
  chainId: stellar.chainId, // Placeholder for Stellar Mainnet
  token: STELLAR_USDC_ISSUER_PK,
  name: "USD Coin",
  symbol: "USDC",
  decimals: 7,
  logoSourceURI: "https://invoice.rozo.ai/tokens/usdc.png",
  logoURI: "https://invoice.rozo.ai/tokens/usdc.png",
  usd: 1,
  priceFromUsd: 1,
  displayDecimals: 2,
  fiatSymbol: "$",
  maxAcceptUsd: 100000,
  maxSendUsd: 0,
};
