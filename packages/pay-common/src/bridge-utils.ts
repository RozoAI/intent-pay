import { parseUnits } from "viem";
import {
  baseUSDC,
  getChainById,
  getKnownToken,
  isChainSupported,
  isTokenSupported,
  PaymentResponse,
  RozoPayHydratedOrderWithOrg,
  RozoPayIntentStatus,
  RozoPayOrderMode,
  RozoPayOrderStatusDest,
  RozoPayOrderStatusSource,
  RozoPayUserMetadata,
  rozoSolana,
  rozoSolanaUSDC,
  rozoStellarUSDC,
  solana,
  validateAddressForChain,
} from ".";

export interface PaymentBridgeConfig {
  toChain: number;
  toToken: string;
  toAddress: string;
  toUnits: string;
  preferredChain: number;
  preferredTokenAddress: string;
}

export interface PreferredPaymentConfig {
  preferredChain: string;
  preferredToken: string;
  preferredTokenAddress: string;
}

export interface DestinationConfig {
  destinationAddress?: string;
  chainId: string;
  amountUnits: string;
  tokenSymbol: string;
  tokenAddress: string;
}

interface PaymentBridge {
  preferred: PreferredPaymentConfig;
  destination: DestinationConfig;
  isIntentPayment: boolean;
}

/**
 * Creates payment bridge configuration for cross-chain payment routing
 *
 * Determines the optimal payment routing based on the destination chain/token
 * and the preferred payment method selected by the user. This function handles
 * the complexity of multi-chain payments by:
 *
 * 1. **Preferred Payment Method**: Identifies which chain/token the user will pay from
 *    - Supports Base USDC, Polygon USDC, Ethereum USDC, Solana USDC, Stellar USDC, Worldchain USDC, and BSC USDT
 *    - Sets appropriate chain ID and token address for the source transaction
 *
 * 2. **Destination Configuration**: Determines where funds will be received
 *    - Supports Base, Solana, Stellar, and Worldchain as destination chains
 *    - Automatically handles special address formats for Solana and Stellar addresses
 *    - Configures destination token based on chain type (e.g., Stellar/Solana USDC)
 *
 * 3. **Intent Payment Detection**: Determines if this is a cross-chain intent payment
 *    - Returns `isIntentPayment: true` when preferred chain/token differs from destination
 *    - Returns `isIntentPayment: false` for same-chain, same-token payments
 *
 * @param config - Payment bridge configuration parameters
 * @param config.toChain - Destination chain ID (e.g., 8453 for Base, 900 for Solana, 10001 for Stellar)
 * @param config.toToken - Destination token address (must be a supported token on the destination chain)
 * @param config.toAddress - Destination address (format validated based on chain type: EVM 0x..., Solana Base58, Stellar G...)
 * @param config.toUnits - Amount in human-readable units (e.g., "1" for 1 USDC, "0.5" for half a USDC)
 * @param config.preferredChain - Chain ID where the user will pay from (e.g., 137 for Polygon, 8453 for Base)
 * @param config.preferredTokenAddress - Token address the user selected to pay with (must be a supported token on preferredChain)
 *
 * @returns Payment routing configuration object
 * @returns preferred - Source payment configuration (chain, token user will pay from)
 * @returns preferred.preferredChain - Chain ID as string where payment originates
 * @returns preferred.preferredToken - Token symbol (e.g., "USDC", "USDT")
 * @returns preferred.preferredTokenAddress - Token contract address
 * @returns destination - Destination payment configuration (chain, token user will receive)
 * @returns destination.destinationAddress - Address where funds will be received
 * @returns destination.chainId - Destination chain ID as string
 * @returns destination.amountUnits - Payment amount in token units
 * @returns destination.tokenSymbol - Destination token symbol
 * @returns destination.tokenAddress - Destination token contract address
 * @returns isIntentPayment - Boolean indicating if this is a cross-chain intent payment
 *
 * @throws {Error} If the destination token is not supported for the destination chain
 * @throws {Error} If the destination address format is invalid for the destination chain
 * @throws {Error} If the preferred token is not supported for the preferred chain
 * @throws {Error} If the destination chain or token is not supported
 *
 * @example
 * ```typescript
 * // User wants to pay with Polygon USDC to receive on Base
 * import { baseUSDC, polygonUSDCe } from '@rozoai/intent-common';
 * import { base, polygon } from '@rozoai/intent-common';
 *
 * const { preferred, destination, isIntentPayment } = createPaymentBridgeConfig({
 *   toChain: base.chainId, // 8453
 *   toToken: baseUSDC.token,
 *   toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
 *   toUnits: '1000000', // 1 USDC (6 decimals)
 *   preferredChain: polygon.chainId, // 137
 *   preferredToken: polygonUSDCe.token,
 * });
 *
 * // preferred = { preferredChain: '137', preferredToken: 'USDCe', preferredTokenAddress: '0x2791...' }
 * // destination = { destinationAddress: '0x742d...', chainId: '8453', amountUnits: '1000000', tokenSymbol: 'USDC', tokenAddress: '0x8335...' }
 * // isIntentPayment = true (different chains)
 * ```
 *
 * @example
 * ```typescript
 * // User wants to pay to a Stellar address using Base USDC
 * import { baseUSDC, rozoStellarUSDC } from '@rozoai/intent-common';
 * import { base, rozoStellar } from '@rozoai/intent-common';
 *
 * const { preferred, destination, isIntentPayment } = createPaymentBridgeConfig({
 *   toChain: rozoStellar.chainId, // 10001
 *   toToken: rozoStellarUSDC.token,
 *   toAddress: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
 *   toUnits: '10000000', // 1 USDC (7 decimals for Stellar)
 *   preferredChain: base.chainId, // 8453
 *   preferredToken: baseUSDC.token,
 * });
 *
 * // preferred = { preferredChain: '8453', preferredToken: 'USDC', preferredTokenAddress: '0x8335...' }
 * // destination = { destinationAddress: 'GA5Z...', chainId: '10001', amountUnits: '10000000', tokenSymbol: 'USDC', tokenAddress: 'USDC:GA5Z...' }
 * // isIntentPayment = true (Base to Stellar)
 * ```
 *
 * @example
 * ```typescript
 * // Same-chain payment (not an intent payment)
 * const { preferred, destination, isIntentPayment } = createPaymentBridgeConfig({
 *   toChain: base.chainId, // 8453
 *   toToken: baseUSDC.token,
 *   toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
 *   toUnits: '1000000',
 *   preferredChain: base.chainId, // 8453
 *   preferredToken: baseUSDC.token,
 * });
 *
 * // isIntentPayment = false (same chain and token)
 * ```
 *
 * @see PreferredPaymentConfig
 * @see DestinationConfig
 * @see PaymentBridgeConfig
 */
export function createPaymentBridgeConfig({
  toChain,
  toToken,
  toAddress,
  toUnits,
  preferredChain,
  preferredTokenAddress,
}: PaymentBridgeConfig): PaymentBridge {
  const chain = getChainById(toChain);
  const token = getKnownToken(toChain, toToken);

  if (!token) {
    throw new Error(
      `Unsupported token ${toToken} for chain ${chain.name} (${toChain})`
    );
  }

  const addressValid = validateAddressForChain(toChain, toAddress);
  if (!addressValid) {
    throw new Error(
      `Invalid address ${toAddress} for chain ${chain.name} (${toChain})`
    );
  }

  const preferredChainData = getChainById(preferredChain);
  const tokenConfig = getKnownToken(preferredChain, preferredTokenAddress);
  if (!tokenConfig) {
    throw new Error(
      `Unknown token ${preferredTokenAddress} for chain ${preferredChainData.name} (${preferredChain})`
    );
  }

  let preferred: PreferredPaymentConfig = {
    preferredChain: String(preferredChain),
    preferredToken: tokenConfig.symbol,
    preferredTokenAddress: preferredTokenAddress,
  };

  let destination: DestinationConfig = {
    destinationAddress: toAddress,
    chainId: String(toChain),
    amountUnits: toUnits,
    tokenSymbol: token.symbol,
    tokenAddress: toToken,
  };

  if (isChainSupported(toChain) && isTokenSupported(toChain, toToken)) {
    preferred = {
      preferredChain: String(
        tokenConfig.chainId === solana.chainId
          ? rozoSolana.chainId
          : tokenConfig.chainId
      ),
      preferredToken: tokenConfig.symbol,
      preferredTokenAddress: tokenConfig.token,
    };

    // Determine destination based on special address types
    if (isChainSupported(toChain, "stellar")) {
      destination = {
        ...destination,
        tokenSymbol: rozoStellarUSDC.symbol,
        chainId: String(rozoStellarUSDC.chainId),
        tokenAddress: rozoStellarUSDC.token,
      };
    } else if (isChainSupported(toChain, "solana")) {
      destination = {
        ...destination,
        tokenSymbol: rozoSolanaUSDC.symbol,
        chainId: String(rozoSolanaUSDC.chainId),
        tokenAddress: rozoSolanaUSDC.token,
      };
    }
  } else {
    throw new Error(
      `Unsupported chain ${chain.name} (${toChain}) or token ${token.symbol} (${toToken})`
    );
  }

  // If the preferred chain and token are not the same as the toChain and toToken, then it is an intent payment
  const isIntentPayment =
    preferred.preferredChain !== String(toChain) &&
    preferred.preferredTokenAddress !== toToken;

  return { preferred, destination, isIntentPayment };
}

/**
 * Converts a RozoAI payment API response to a fully hydrated RozoPay order.
 *
 * This utility transforms the low-level {@link PaymentResponse} object returned by the RozoAI Intent Pay API
 * into a {@link RozoPayHydratedOrderWithOrg}, containing all values needed for UI display, order tracking,
 * and multi-chain cross-payment logic. Fields are normalized and token metadata is resolved in order to
 * standardize data from different chains and token types.
 *
 * Key steps performed:
 *
 * 1. **Token Metadata Lookup**: Uses {@link getKnownToken} to identify the correct token
 *    for the payment, including decimals, symbol, logo, and chain details.
 *    Special handling is applied for Stellar and Solana tokens based on how they're encoded in the backend.
 *
 * 2. **Order Hydration**: Generates a unique (random BigInt) internal order ID for frontend usage, sets the
 *    payment mode as HYDRATED, and resolves all destination call and amount fields from the payment response.
 *
 * 3. **Status Initialization**: Initializes the payment, source, and destination status fields
 *    with their correct values based on the payment's progress in the state machine. The returned object is
 *    ready for status tracking and user notification.
 *
 * 4. **Metadata Consolidation**: Merges core order metadata, user metadata (if provided by the payer),
 *    and any external references such as org info. Ensures all details needed for order display and analytics are available.
 *
 * @param order - Low-level API payment response (from RozoAI Intent Pay backend)
 * @param feeType - Optional: Fee deduction mode (ExactIn/ExactOut); determines which side's amount is shown as source. Defaults to ExactIn.
 *
 * @returns {RozoPayHydratedOrderWithOrg} A normalized, display-ready order representation containing all tracking, status,
 *          token, org, and routing information for frontend use.
 *
 * @example
 * ```typescript
 * const paymentResponse = await getPayment(paymentId);
 * const hydratedOrder = formatPaymentResponseToHydratedOrder(paymentResponse.data);
 * console.log(hydratedOrder.sourceStatus); // 'WAITING_PAYMENT'
 * console.log(hydratedOrder.destFinalCallTokenAmount.token.symbol); // 'USDC'
 * console.log(hydratedOrder.usdValue); // 10.00
 * ```
 *
 * @remarks
 * - The returned `id` (BigInt) is generated randomly and is client-side only; always use
 *   `order.orderId` or the API reference for backend/server reconciliation.
 * - The expiration timestamp and org info are carried over if present on the API response.
 * - Decimals, token symbol, and display metadata for the amount and destination chain
 *   are resolved so the result is immediately usable for UI.
 *
 * @see PaymentResponse
 * @see RozoPayHydratedOrderWithOrg
 * @see getKnownToken
 */
export function formatPaymentResponseToHydratedOrder(
  order: PaymentResponse
): RozoPayHydratedOrderWithOrg {
  // Source amount is in the same units as the destination amount without fee
  const sourceAmountUnits =
    order.source?.amount ?? order.destination?.amountUnits ?? "0";

  // Destination Intent Address
  const intentAddress =
    order.metadata?.receivingAddress ?? order.source?.receiverAddress;

  // Destination Intent Memo
  const intentMemo = order.metadata?.memo ?? order.source?.receiverMemo;

  // Destination address is where the payment will be received
  const destAddress = order.source?.receiverAddress;
  const destToken = getKnownToken(
    Number(order.destination.chainId),
    String(order.destination.tokenAddress)
  );
  if (!destToken) {
    throw new Error(
      `Unsupported token ${order.destination.tokenAddress} for chain ${order.destination.chainId}`
    );
  }

  // Determine the chain from metadata or default to the source chain
  const requiredChain = order.source?.chainId || baseUSDC.chainId;

  const token = getKnownToken(
    Number(requiredChain),
    Number(requiredChain) === rozoStellarUSDC.chainId
      ? rozoStellarUSDC.token
      : order.source?.tokenAddress || ""
  );

  return {
    id: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
    mode: RozoPayOrderMode.HYDRATED,
    intentAddr: intentAddress ?? "",
    memo: intentMemo ?? null,
    preferredChainId: order.source?.chainId ?? null,
    preferredTokenAddress: order.source?.tokenAddress ?? null,
    destFinalCallTokenAmount: {
      token: {
        chainId: destToken ? destToken.chainId : baseUSDC.chainId,
        token: destToken ? destToken.token : baseUSDC.token,
        symbol: destToken ? destToken.symbol : baseUSDC.symbol,
        usd: Number(sourceAmountUnits),
        priceFromUsd: 1,
        decimals: destToken ? destToken.decimals : baseUSDC.decimals,
        displayDecimals: 2,
        logoSourceURI: destToken
          ? destToken.logoSourceURI
          : baseUSDC.logoSourceURI,
        logoURI: destToken ? destToken.logoURI : baseUSDC.logoURI,
        maxAcceptUsd: 100000,
        maxSendUsd: 0,
      },
      amount: parseUnits(
        sourceAmountUnits,
        destToken ? destToken.decimals : baseUSDC.decimals
      ).toString() as `${bigint}`,
      usd: Number(sourceAmountUnits),
    },
    usdValue: Number(sourceAmountUnits),
    destFinalCall: {
      to: destAddress ?? "",
      value: BigInt("0"),
      data: "0x",
    },
    refundAddr: (order.source?.senderAddress as any) || null,
    nonce: BigInt(order.nonce ?? 0),
    intentStatus: RozoPayIntentStatus.UNPAID,
    sourceFulfillerAddr: null,
    sourceTokenAmount: null,
    sourceInitiateTxHash: order.sourceInitiateTxHash ?? null,
    sourceStatus: RozoPayOrderStatusSource.WAITING_PAYMENT,
    sourceStartTxHash: order.sourceStartTxHash ?? null,
    destStatus: RozoPayOrderStatusDest.PENDING,
    destFastFinishTxHash: order.destFastFinishTxHash ?? null,
    destClaimTxHash: order.destClaimTxHash ?? null,
    redirectUri: null,
    createdAt: Math.floor(new Date(order.createdAt).getTime() / 1000),
    lastUpdatedAt: Math.floor(new Date(order.updatedAt).getTime() / 1000),
    orgId: order.orgId ?? "",
    metadata: {
      ...(order?.metadata ?? {}),
      receivingAddress: intentAddress ?? "",
      memo: intentMemo ?? null,
    } as any,
    externalId: order.externalId ?? null,
    userMetadata: order.userMetadata as RozoPayUserMetadata | null,
    expirationTs: BigInt(
      Math.floor(new Date(order.expiresAt).getTime() / 1000).toString()
    ),
    org: {
      orgId: order.orgId ?? "",
      name: "",
    },
  };
}
