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
  rozoSolanaUSDC,
  rozoStellarUSDC,
  validateAddressForChain,
} from ".";
import type { PaymentResponseData } from "./api/payment";

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
      preferredChain: String(tokenConfig.chainId),
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
 * Transforms a payment API response into a fully hydrated order object
 *
 * Converts the payment response data from the RozoAI payment API into a complete
 * `RozoPayHydratedOrderWithOrg` object that contains all the information needed
 * to display order status, track payments, and handle cross-chain transactions.
 *
 * This function performs several key transformations:
 *
 * 1. **Token Resolution**: Identifies the correct token based on chain and address
 *    - Uses `getKnownToken()` to resolve token metadata (decimals, symbol, logo, etc.)
 *    - Handles special cases for Stellar tokens using issuer public key
 *
 * 2. **Order Structure**: Creates a complete order with all required fields
 *    - Generates random order ID for internal tracking
 *    - Sets up intent, handoff, and contract addresses
 *    - Configures bridge token options and destination amounts
 *
 * 3. **Status Initialization**: Sets initial payment statuses
 *    - Source status: WAITING_PAYMENT (awaiting user transaction)
 *    - Destination status: PENDING (not yet received)
 *    - Intent status: UNPAID (payment not initiated)
 *
 * 4. **Metadata Merge**: Combines various metadata sources
 *    - Merges order metadata, user metadata, and custom metadata
 *    - Preserves external ID and organization information
 *
 * @param order - Payment response data from the RozoAI payment API
 * @param order.metadata - Payment metadata including chain, token, and routing info
 * @param order.destination - Destination configuration (chain, token, amount, address)
 * @param order.source - Source transaction info (if payment has been initiated)
 * @param order.orgId - Organization ID for the payment
 * @param order.externalId - External reference ID (if provided by merchant)
 *
 * @returns Complete hydrated order object with all payment tracking information
 * @returns id - Unique order identifier (random BigInt)
 * @returns mode - Order mode (HYDRATED)
 * @returns sourceStatus - Source transaction status
 * @returns destStatus - Destination transaction status
 * @returns intentStatus - Overall payment intent status
 * @returns metadata - Merged metadata from all sources
 * @returns org - Organization information
 *
 * @example
 * ```typescript
 * const paymentResponse = await getRozoPayment(paymentId);
 *
 * const hydratedOrder = formatPaymentResponseDataToHydratedOrder(
 *   paymentResponse.data,
 *   'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
 * );
 *
 * console.log(hydratedOrder.sourceStatus); // 'WAITING_PAYMENT'
 * console.log(hydratedOrder.destFinalCallTokenAmount.token.symbol); // 'USDC'
 * console.log(hydratedOrder.usdValue); // 10.00
 * ```
 *
 * @note The generated order ID is random and intended for client-side tracking only.
 *       Use `externalId` or the API payment ID for server-side reference.
 *
 * @note The function sets a 5-minute expiration timestamp from the current time.
 *
 * @see PaymentResponseData
 * @see RozoPayHydratedOrderWithOrg
 * @see getKnownToken
 */
export function formatResponseToHydratedOrder(
  order: PaymentResponseData
): RozoPayHydratedOrderWithOrg {
  const destAddress = order.metadata.receivingAddress as `0x${string}`;

  const requiredChain = order.metadata.preferredChain || baseUSDC.chainId;

  const token = getKnownToken(
    Number(requiredChain),
    Number(requiredChain) === rozoStellarUSDC.chainId
      ? rozoStellarUSDC.token
      : order.metadata.preferredTokenAddress
  );

  return {
    id: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
    mode: RozoPayOrderMode.HYDRATED,
    intentAddr: destAddress,
    // @TODO: use correct destination token
    // bridgeTokenOutOptions: [
    //   {
    //     token: {
    //       chainId: baseUSDC.chainId,
    //       token: baseUSDC.token,
    //       symbol: baseUSDC.symbol,
    //       usd: 1,
    //       priceFromUsd: 1,
    //       decimals: baseUSDC.decimals,
    //       displayDecimals: 2,
    //       logoSourceURI: baseUSDC.logoSourceURI,
    //       logoURI: baseUSDC.logoURI,
    //       maxAcceptUsd: 100000,
    //       maxSendUsd: 0,
    //     },
    //     amount: parseUnits(
    //       order.destination.amountUnits,
    //       baseUSDC.decimals
    //     ).toString() as `${bigint}`,
    //     usd: Number(order.destination.amountUnits),
    //   },
    // ],
    // selectedBridgeTokenOutAddr: null,
    // selectedBridgeTokenOutAmount: null,
    destFinalCallTokenAmount: {
      token: {
        chainId: token ? token.chainId : baseUSDC.chainId,
        token: token ? token.token : baseUSDC.token,
        symbol: token ? token.symbol : baseUSDC.symbol,
        usd: 1,
        priceFromUsd: 1,
        decimals: token ? token.decimals : baseUSDC.decimals,
        displayDecimals: 2,
        logoSourceURI: token ? token.logoSourceURI : baseUSDC.logoSourceURI,
        logoURI: token ? token.logoURI : baseUSDC.logoURI,
        maxAcceptUsd: 100000,
        maxSendUsd: 0,
      },
      amount: parseUnits(
        order.destination.amountUnits,
        token ? token.decimals : baseUSDC.decimals
      ).toString() as `${bigint}`,
      usd: Number(order.destination.amountUnits),
    },
    usdValue: Number(order.destination.amountUnits),
    destFinalCall: {
      to: destAddress,
      value: BigInt("0"),
      data: "0x",
    },
    refundAddr: (order.source?.sourceAddress as `0x${string}`) || null,
    nonce: order.nonce as unknown as bigint,
    sourceFulfillerAddr: null,
    sourceTokenAmount: null,
    sourceInitiateTxHash: null,
    // sourceStartTxHash: null,
    sourceStatus: RozoPayOrderStatusSource.WAITING_PAYMENT,
    destStatus: RozoPayOrderStatusDest.PENDING,
    intentStatus: RozoPayIntentStatus.UNPAID,
    destFastFinishTxHash: null,
    destClaimTxHash: null,
    redirectUri: null,
    createdAt: Math.floor(Date.now() / 1000),
    lastUpdatedAt: Math.floor(Date.now() / 1000),
    orgId: order.orgId as string,
    metadata: {
      ...(order?.metadata ?? {}),
      ...(order.userMetadata ?? {}),
      ...(order.metadata ?? {}),
    } as any,
    externalId: order.externalId as string | null,
    userMetadata: order.userMetadata as RozoPayUserMetadata | null,
    expirationTs: order.expiresAt
      ? BigInt(
          Math.floor(
            new Date(String(order.expiresAt)).getTime() / 1000
          ).toString()
        )
      : BigInt(Math.floor(Date.now() / 1000 + 5 * 60).toString()),
    org: {
      orgId: order.orgId as string,
      name: "",
    },
  };
}

export function formatPaymentResponseToHydratedOrder(
  order: PaymentResponse
): RozoPayHydratedOrderWithOrg {
  // Source amount is in the same units as the destination amount without fee
  const sourceAmountUnits = order.source?.amount ?? "0";

  return formatResponseToHydratedOrder({
    id: order.id,
    expiresAt: new Date(order.expiresAt).toISOString(),
    updatedAt: new Date(order.updatedAt).toISOString(),
    createdAt: new Date(order.createdAt).toISOString(),
    status: RozoPayOrderMode.HYDRATED,
    display: order.display,
    metadata: {
      ...order.metadata,
      receivingAddress: order.source?.receiverAddress,
      memo: order.source?.receiverMemo ?? null,
    } as any,
    destination: {
      destinationAddress: order.destination?.receiverAddress ?? "",
      chainId: String(order.destination?.chainId ?? ""),
      amountUnits: sourceAmountUnits,
      tokenSymbol: order.destination?.tokenSymbol ?? "",
      tokenAddress: order.destination?.tokenAddress ?? "",
      txHash: order.destination?.txHash ?? null,
    },
    source: {
      sourceAddress: order.source?.senderAddress ?? undefined,
      chainId: String(order.source?.chainId ?? ""),
      amountUnits: sourceAmountUnits,
      tokenSymbol: order.source?.tokenSymbol ?? "",
      tokenAddress: order.source?.tokenAddress ?? "",
    },
    url: order.url,
    externalId: order.externalId,
    userMetadata: order.userMetadata,
    nonce: order.nonce,
    orgId: order.orgId,
  });
}
