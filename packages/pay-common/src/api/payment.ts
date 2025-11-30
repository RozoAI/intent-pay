import { createPaymentBridgeConfig } from "../bridge";
import { apiClient, ApiResponse } from "./base";

/**
 * Payment display information
 */
export interface PaymentDisplay {
  intent: string;
  paymentValue: string;
  currency: string;
}

/**
 * Payment destination information
 */
export interface PaymentDestination {
  destinationAddress?: string;
  chainId: string;
  amountUnits: string;
  tokenSymbol: string;
  tokenAddress?: string;
  txHash?: string | null;
}

/**
 * Payment source information
 */
export interface PaymentSource {
  sourceAddress?: string;
  [key: string]: unknown;
}

/**
 * Payment request data type
 */
export interface PaymentRequestData {
  appId: string;
  display: PaymentDisplay;
  destination: PaymentDestination;
  externalId?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Payment response data type
 */
export interface PaymentResponseData {
  id: string;
  status: "payment_unpaid" | string;
  createdAt: string;
  display: {
    intent: string;
    currency: string;
    paymentValue?: string;
  };
  source: PaymentSource | null;
  destination: {
    destinationAddress: string;
    txHash: string | null;
    chainId: string;
    amountUnits: string;
    tokenSymbol: string;
    tokenAddress: string;
  };
  metadata: {
    daimoOrderId?: string;
    intent: string;
    items: unknown[];
    payer: Record<string, unknown>;
    appId: string;
    orderDate: string;
    webhookUrl: string;
    provider: string;
    receivingAddress: string;
    memo: string | null;
    payinchainid: string;
    payintokenaddress: string;
    preferredChain: string;
    preferredToken: string;
    preferredTokenAddress: string;
    source_tx_hash?: string;
    [key: string]: unknown;
  };
  url: string;
  [key: string]: unknown;
}

/**
 * Simplified interface for creating a payment bridge
 */
export interface CreatePaymentBridgeParams {
  /** App ID for authentication */
  appId: string;
  // Destination (where funds will be received)
  /** Destination chain ID (e.g., 8453 for Base, 900 for Solana, 10001 for Stellar) */
  toChain: number;
  /** Destination token address */
  toToken: string;
  /** Destination address - Can be EVM, Solana, or Stellar address */
  toAddress: string;

  // Preferred payment method (what user will pay with)
  /** Chain ID where user will pay from (e.g., 137 for Polygon, 8453 for Base) */
  preferredChain: number;
  /** Token address user will pay with */
  preferredTokenAddress: string;

  // Payment details
  /** Amount in human-readable units (e.g., "1" for 1 USDC, "0.5" for half a USDC) */
  toUnits?: string;

  // Optional metadata
  /** Additional metadata to include */
  metadata?: Record<string, unknown>;
}

/**
 * Gets payment details by ID
 * @param paymentId - Payment ID
 * @returns Promise with payment response
 */
export const getRozoPayment = (
  paymentId: string
): Promise<ApiResponse<PaymentResponseData>> => {
  const isMugglePay = paymentId.includes("mugglepay_order");
  const endpoint = isMugglePay
    ? `payment-api/${paymentId}`
    : `payment/id/${paymentId}`;
  return apiClient.get<PaymentResponseData>(endpoint);
};

/**
 * Creates a payment bridge configuration and initiates a Rozo payment
 *
 * This function combines the payment bridge configuration logic with payment creation,
 * handling cross-chain payment routing and metadata merging. It provides a simplified
 * API that doesn't require understanding internal types like WalletPaymentOption.
 *
 * @param params - Payment bridge creation parameters
 * @returns Promise resolving to the payment response data
 * @throws Error if payment creation fails or required parameters are missing
 *
 * @example
 * ```typescript
 * // Simple same-chain payment
 * const payment = await createPaymentBridge({
 *   toChain: 8453, // Base
 *   toToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
 *   toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
 *   preferredChainId: 8453, // User pays from Base
 *   preferredToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
 *   toUnits: "1", // 1 USDC
 *   appId: "my-app-id",
 *   intent: "Pay",
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Cross-chain payment: Polygon to Base
 * const payment = await createPaymentBridge({
 *   toChain: 8453, // Base (destination)
 *   toToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
 *   toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
 *   preferredChainId: 137, // Polygon (user pays from)
 *   preferredToken: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // Polygon USDC
 *   toUnits: "1",
 *   appId: "my-app-id",
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Payment to Solana address (payout → Solana)
 * const payment = await createPaymentBridge({
 *   toChain: 900, // Solana
 *   toToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Solana USDC
 *   toAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", // Solana address
 *   preferredChainId: 8453, // User pays from Base
 *   preferredToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
 *   toUnits: "1",
 *   appId: "my-app-id",
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Payment paid in from Stellar account
 * const payment = await createPaymentBridge({
 *   toChain: 8453, // Payout on Base
 *   toToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
 *   toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // EVM address
 *   preferredChainId: 1500, // Pay in from Stellar
 *   preferredToken: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", // Stellar USDC (token format: code:issuer)
 *   toUnits: "10",
 *   appId: "my-app-id",
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Payment paying out to Stellar address (payout → Stellar)
 * const payment = await createPaymentBridge({
 *   toChain: 1500, // Stellar
 *   toToken: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", // Stellar USDC (token format: code:issuer)
 *   toAddress: "GA5ZSEPRY3STUGUUXZGHV5CDEQ2AJGEAAUUMSZK2QIPICFL2JVP4X6T4", // Stellar address
 *   preferredChainId: 8453, // User pays from Base
 *   preferredToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
 *   toUnits: "1",
 *   appId: "my-app-id",
 * });
 * ```
 */
export async function createRozoPayment(
  params: CreatePaymentBridgeParams
): Promise<PaymentResponseData> {
  const {
    toChain,
    toToken,
    toAddress,
    preferredChain,
    preferredTokenAddress,
    toUnits,
    appId,
    metadata,
  } = params;
  // Create payment bridge configuration
  const { preferred, destination, isIntentPayment } = createPaymentBridgeConfig(
    {
      toChain,
      toToken,
      toAddress,
      toUnits: toUnits ?? "0",
      // Preferred payment method (what user will pay with)
      preferredChain,
      preferredTokenAddress,
    }
  );

  // Build payment request data
  const paymentData: PaymentRequestData = {
    appId,
    display: {
      intent: "",
      paymentValue: String(toUnits ?? ""),
      currency: "USD",
    },
    destination,
    ...preferred,
    ...(metadata ?? {}),
    ...(isIntentPayment ? { intents: true } : {}),
  };

  // Create payment via API
  const response = await apiClient.post<PaymentResponseData>(
    "/payment-api",
    paymentData
  );

  if (!response?.data?.id) {
    throw new Error(response?.error?.message ?? "Payment creation failed");
  }

  return response.data;
}
