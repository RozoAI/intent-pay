import { getChainById } from "../chain";
import { ApiResponse } from "./base";

/**
 * Fee response data type (success case)
 */
export interface FeeResponseData {
  appId: string;
  amount: number;
  currency: string;
  fee: number;
  feePercentage: string;
  minimumFee: string;
  amount_out: number;
}

/**
 * Fee error response data type
 */
export interface FeeErrorData {
  error: string;
  message: string;
  received: number;
  maxAllowed: number;
}

/**
 * Fee request parameters
 */
export interface GetFeeParams {
  appId: string;
  amount: number;
  toChain: number;
  currency?: string;
}

/**
 * Gets fee calculation for a payment amount
 * @param params - Fee calculation parameters (amount is required)
 * @returns Promise with fee response or error
 */
export const getFee = async (
  params: GetFeeParams
): Promise<ApiResponse<FeeResponseData>> => {
  const { amount, appId, currency = "USDC", toChain } = params;

  try {
    const chain = getChainById(toChain);
    const toChainName = chain.name.toLowerCase();

    const queryParams = new URLSearchParams({
      amount: amount.toString(),
      appId,
      currency,
      tochain: toChainName,
    });

    const response = await fetch(
      `https://intentapi.rozo.ai/getFee?${queryParams.toString()}`
    );

    const data = (await response.json()) as FeeResponseData | FeeErrorData;

    // Check if response contains an error
    if (!response.ok || "error" in data) {
      const errorData = data as FeeErrorData;
      return {
        data: null,
        error: new Error(errorData.message || errorData.error),
        status: response.status,
      };
    }

    return {
      data: data as FeeResponseData,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
      status: null,
    };
  }
};
