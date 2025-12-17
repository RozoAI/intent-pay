import { ApiVersion } from "./base";

/**
 * FeeType, Fee calculation type:
 * - exactIn (default): Fee deducted from input, recipient receives amount - fee
 * - exactOut: Fee added to input, recipient receives exact amount
 */
export enum FeeType {
  ExactIn = "exactIn",
  ExactOut = "exactOut",
}

/**
 * PaymentStatus, Payment status
 */
export enum PaymentStatus {
  PaymentBounced = "payment_bounced",
  PaymentCompleted = "payment_completed",
  PaymentExpired = "payment_expired",
  PaymentPayinCompleted = "payment_payin_completed",
  PaymentPayoutCompleted = "payment_payout_completed",
  PaymentRefunded = "payment_refunded",
  PaymentStarted = "payment_started",
  PaymentUnpaid = "payment_unpaid",
}

/**
 * PaymentErrorCode, Error code (only present when status is payment_bounced)
 */
export enum PaymentErrorCode {
  AmountTooHigh = "amountTooHigh",
  AmountTooLow = "amountTooLow",
  ChainUnavailable = "chainUnavailable",
  InsufficientLiquidity = "insufficientLiquidity",
  InvalidRecipient = "invalidRecipient",
  MissingTrustline = "missingTrustline",
  NetworkError = "networkError",
  ProviderError = "providerError",
  ServiceMaintenance = "serviceMaintenance",
}

/**
 * DestinationRequest
 */
export interface DestinationRequest {
  /**
   * Receive amount (required for type=exactOut).
   * For exactIn, this field is omitted in request and calculated in response.
   */
  amount?: string;
  chainId: number;
  /**
   * Final recipient's wallet address
   */
  receiverAddress: string;
  /**
   * Memo for Stellar/Solana destinations
   */
  receiverMemo?: string;
  /**
   * Override default token address
   */
  tokenAddress?: string;
  tokenSymbol: string;
  [property: string]: any;
}

/**
 * DisplayInfo
 */
export interface DisplayInfo {
  /**
   * Display currency
   */
  currency: string;
  /**
   * Detailed description
   */
  description?: string;
  /**
   * Short title
   */
  title: string;
  [property: string]: any;
}

/**
 * SourceRequest
 */
export interface SourceRequest {
  /**
   * Pay-in amount (required for type=exactIn).
   * For exactOut, this field is omitted in request and calculated in response.
   */
  amount?: string;
  chainId: number;
  /**
   * Override default token address
   */
  tokenAddress?: string;
  tokenSymbol: string;
  [property: string]: any;
}

/**
 * PaymentRequest
 */
export interface CreatePaymentRequest {
  /**
   * Your application ID
   */
  appId: string;
  destination: DestinationRequest;
  display: DisplayInfo;
  /**
   * Custom metadata (max 4 KB recommended)
   */
  metadata?: { [key: string]: any };
  /**
   * Your order reference ID (for idempotency)
   */
  orderId?: string;
  source: SourceRequest;
  type?: FeeType;
  /**
   * Secret for HMAC-SHA256 signature verification.
   * If not provided, a unique secret is auto-generated.
   * The secret is returned in the response for you to store and use for verification.
   */
  webhookSecret?: string;
  /**
   * URL to receive payment status updates
   */
  webhookUrl?: string;
  [property: string]: any;
}

/**
 * DestinationResponse
 */
export interface DestinationResponse {
  /**
   * Amount to be sent to recipient
   */
  amount?: string;
  chainId?: number;
  /**
   * Withdrawal confirmation time
   */
  confirmedAt?: Date;
  /**
   * Final recipient's wallet
   */
  receiverAddress?: string;
  /**
   * Memo for Stellar/Solana
   */
  receiverMemo?: string;
  /**
   * Token contract address
   */
  tokenAddress?: string;
  tokenSymbol?: string;
  /**
   * Withdrawal transaction hash
   */
  txHash?: string;
  [property: string]: any;
}

/**
 * SourceResponse
 */
export interface SourceResponse {
  /**
   * Amount payer must send
   */
  amount?: string;
  /**
   * Actual amount received
   */
  amountReceived?: string;
  chainId?: number;
  /**
   * Deposit confirmation time
   */
  confirmedAt?: Date;
  /**
   * Fee amount
   */
  fee?: string;
  /**
   * Deposit address (where payer sends funds)
   */
  receiverAddress?: string;
  /**
   * Memo for Stellar/Solana deposits
   */
  receiverMemo?: string;
  /**
   * Payer's wallet address (populated after deposit)
   */
  senderAddress?: string;
  /**
   * Token contract address
   */
  tokenAddress?: string;
  tokenSymbol?: string;
  /**
   * Deposit transaction hash
   */
  txHash?: string;
  [property: string]: any;
}

/**
 * PaymentResponse
 */
export interface PaymentResponse {
  /**
   * Your application ID
   */
  appId: string;
  /**
   * ISO 8601 timestamp
   */
  createdAt: Date;
  destination: DestinationResponse;
  display: DisplayInfo;
  errorCode: PaymentErrorCode | null;
  /**
   * ISO 8601 timestamp (when payment expires)
   */
  expiresAt: Date;
  /**
   * Payment ID
   */
  id: string;
  metadata: { [key: string]: any } | null;
  /**
   * Your order reference ID
   */
  orderId: string | null;
  source: SourceResponse;
  status: PaymentStatus;
  type: FeeType;
  /**
   * ISO 8601 timestamp
   */
  updatedAt: Date;
  /**
   * Secret for webhook signature verification.
   * Only present when webhookUrl was provided in the request.
   * Store this securely to verify incoming webhook signatures.
   */
  webhookSecret: string | null;
  [property: string]: any;
}

/**
 * Parameters for creating a new payment using the new backend interface
 */
export interface CreateNewPaymentParams {
  /** App ID for authentication */
  appId: string;
  // Destination (where funds will be received)
  /** Destination chain ID (e.g., 8453 for Base, 900 for Solana, 1500 for Stellar) */
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

  // Optional fields
  /** Additional metadata to include */
  metadata?: Record<string, unknown>;
  /** Display title for the payment */
  title?: string;
  /** Display description for the payment */
  description?: string;
  /** Order reference ID (for idempotency) */
  orderId?: string;
  /** Fee calculation type (exactIn or exactOut) */
  feeType?: FeeType;
  /** Webhook URL to receive payment status updates */
  webhookUrl?: string;
  /** Secret for HMAC-SHA256 signature verification */
  webhookSecret?: string;
  /** Memo for Stellar/Solana destinations */
  receiverMemo?: string;
  /** API version to use (v2 or v4). Defaults to v4 */
  apiVersion?: ApiVersion;
}
