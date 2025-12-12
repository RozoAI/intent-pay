import { createPaymentBridgeConfig } from "../bridge-utils";
import { getChainById } from "../chain";
import { getKnownToken } from "../token";
import { apiClient, ApiResponse, ApiVersion, setApiConfig } from "./base";
import {
  CreateNewPaymentParams,
  CreatePaymentRequest,
  FeeType,
  PaymentResponse,
} from "./types";

/**
 * Creates a payment using the new backend interface
 *
 * This function creates a payment using the new backend API structure with
 * separate source and destination objects, enum-based chain IDs and token symbols.
 *
 * @param params - Payment creation parameters
 * @returns Promise resolving to the payment response data
 * @throws Error if payment creation fails or required parameters are missing
 *
 * @example
 * ```typescript
 * // Simple same-chain payment
 * const payment = await createPayment({
 *   toChain: 8453, // Base
 *   toToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
 *   toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
 *   preferredChain: 8453, // User pays from Base
 *   preferredTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
 *   toUnits: "1", // 1 USDC
 *   appId: "my-app-id",
 *   title: "Payment",
 * });
 * ```
 */
export async function createPayment(
  params: CreateNewPaymentParams
): Promise<PaymentResponse> {
  const {
    toChain,
    toToken,
    toAddress,
    preferredChain,
    preferredTokenAddress,
    toUnits,
    appId,
    metadata,
    title,
    description,
    orderId,
    feeType,
    webhookUrl,
    webhookSecret,
    receiverMemo,
    apiVersion,
  } = params;

  // Set API version if provided
  if (apiVersion) {
    setApiConfig({ version: apiVersion });
  }

  // Create payment bridge configuration
  const { preferred, destination } = createPaymentBridgeConfig({
    toChain,
    toToken,
    toAddress,
    toUnits: toUnits ?? "0",
    // Preferred payment method (what user will pay with)
    preferredChain,
    preferredTokenAddress,
  });

  const sourceChain = getChainById(Number(preferred.preferredChain));
  const sourceToken = getKnownToken(
    Number(preferred.preferredChain),
    preferred.preferredTokenAddress
  );

  const destinationChain = getChainById(Number(destination.chainId));
  const destinationToken = getKnownToken(
    Number(destination.chainId),
    destination.tokenAddress
  );
  const destinationAddress = destination.destinationAddress ?? toAddress;

  if (!sourceToken || !destinationToken) {
    throw new Error("Source or destination token not found");
  }

  // Build payment request data matching new backend interface
  const paymentData: CreatePaymentRequest = {
    appId,
    type: feeType ?? FeeType.ExactIn,
    ...(orderId ? { orderId } : {}),
    source: {
      chainId: sourceChain.chainId,
      tokenSymbol: sourceToken.symbol,
      amount: destination.amountUnits, // Use same amount for source
      ...(preferred.preferredTokenAddress
        ? { tokenAddress: preferred.preferredTokenAddress }
        : {}),
    },
    destination: {
      chainId: destinationChain.chainId,
      receiverAddress: destinationAddress,
      tokenSymbol: destinationToken.symbol,
      amount: destination.amountUnits,
      ...(destination.tokenAddress
        ? { tokenAddress: destination.tokenAddress }
        : {}),
      ...(receiverMemo ? { receiverMemo } : {}),
    },
    display: {
      currency: "USD",
      title: title ?? "Pay",
      ...(description ? { description } : {}),
    },
    metadata: {
      ...(metadata ?? {}),
      appId,
    },
    ...(webhookUrl ? { webhookUrl } : {}),
    ...(webhookSecret ? { webhookSecret } : {}),
  };

  if (apiVersion === "v1") {
    paymentData.display.intent = title ?? "Pay";
    paymentData.destination.amountUnits = destination.amountUnits;
    paymentData.destination.destinationAddress = destinationAddress;
    paymentData.preferredToken = sourceToken.symbol;
    paymentData.preferredChain = preferred.preferredChain;
    paymentData.preferredTokenAddress = preferred.preferredTokenAddress;
  }

  // Create payment via API
  const response = await apiClient.post<PaymentResponse>(
    "/payment-api",
    paymentData
  );

  if (!response?.data?.id) {
    throw new Error(response?.error?.message ?? "Payment creation failed");
  }

  return response.data;
}

/**
 * Gets payment details by ID using the new backend API
 * @param paymentId - Payment ID
 * @param apiVersion - Optional API version to use (v2 or v4). Defaults to v4
 * @returns Promise with payment response
 */
export const getPayment = (
  paymentId: string,
  apiVersion?: ApiVersion
): Promise<ApiResponse<PaymentResponse>> => {
  // Set API version if provided
  if (apiVersion) {
    setApiConfig({ version: apiVersion });
  }

  if (apiVersion === "v1") {
    const isMugglePay = paymentId.includes("mugglepay_order");
    const endpoint = isMugglePay
      ? `/payment-api/${paymentId}`
      : `/payment/id/${paymentId}`;
    return apiClient.get<PaymentResponse>(endpoint);
  }

  return apiClient.get<PaymentResponse>(`/payment-api/payments/${paymentId}`);
};

/**
 * Updates the Pay In TxHash for a payment.
 *
 * Only available on v2 (not supported on v1).
 *
 * @param paymentId - The payment ID to update (e.g., "pay_abc123")
 * @param txHash - The transaction hash to associate with the payment
 * @param apiVersion - Optional API version ("v2" or "v4"), defaults to "v4" if not specified
 * @returns Promise with updated payment response
 *
 * Example usage:
 *   await updatePaymentPayInTxHash("pay_abc123", "0x1234567890abcdef...");
 */
export const updatePaymentPayInTxHash = async (
  paymentId: string,
  txHash: string,
  apiVersion?: ApiVersion
): Promise<ApiResponse<PaymentResponse>> => {
  // Set API version if provided
  if (apiVersion) {
    setApiConfig({ version: apiVersion });
  }

  // Only support v2/v4 (not v1)
  if (apiVersion === "v1") {
    throw new Error(
      "updatePaymentPayInTxHash is only available on API version v2 or later."
    );
  }

  const endpoint = `/payment-api/payments/${paymentId}/payin`;
  const payload = {
    txHash,
  };

  return apiClient.post<PaymentResponse>(endpoint, payload);
};

/**
 * Updates the contact email associated with a payment.
 *
 * Allows an admin or integrator to associate or update the email for a given payment so support staff can contact the user.
 *
 * Only available on v2/v4 API (not v1).
 *
 * @param paymentId - The payment ID to update (e.g., "pay_abc123")
 * @param email - The contact email to associate with the payment
 * @param apiVersion - Optional API version ("v2" or "v4"), defaults to "v4" if not specified
 * @returns Promise with updated payment response
 *
 * Example usage:
 *   await updatePaymentEmail("pay_abc123", "user@example.com")
 */
export const updatePaymentEmail = async (
  paymentId: string,
  email: string,
  apiVersion?: ApiVersion
): Promise<ApiResponse<PaymentResponse>> => {
  // Set API version if provided
  if (apiVersion) {
    setApiConfig({ version: apiVersion });
  }

  // Only support v2/v4 (not v1)
  if (apiVersion === "v1") {
    throw new Error(
      "updatePaymentEmail is only available on API version v2 or later."
    );
  }

  const endpoint = `/payment-api/payments/${paymentId}/email`;
  const payload = {
    email,
  };

  return apiClient.post<PaymentResponse>(endpoint, payload);
};
