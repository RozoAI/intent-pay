import { rozoSolana, rozoStellar, solana, stellar } from "../chain";
import { apiClient, ApiResponse } from "./base";
import { FeeType } from "./types";

export interface FeeResponseData {
  status: string;
  type: string;
  source: {
    chainId: string;
    tokenSymbol: string;
    amount: string;
    fee: string;
  };
  destination: {
    chainId: string;
    tokenSymbol: string;
    amount: string;
  };
  feeInfo: {
    feePercentage: string;
    minimumFee: string;
  };
}

export interface FeeErrorData {
  error: {
    code: string;
    message: string;
  };
  requestId?: string;
  data?: {
    errorCode: string;
    maxAmount?: number;
  };
}

export interface GetFeeParams {
  appId?: string;
  type: FeeType;
  sourceChainId: string;
  sourceTokenSymbol: string;
  amount: string;
  destChainId: string;
  destReceiverAddress: string;
  destTokenSymbol: string;
}

export const getFee = async (params: GetFeeParams): Promise<ApiResponse<FeeResponseData>> => {
  const {
    appId,
    type,
    sourceChainId,
    sourceTokenSymbol,
    amount,
    destChainId,
    destReceiverAddress,
    destTokenSymbol,
  } = params;

  const isExactOut = type === FeeType.ExactOut;
  const body = {
    ...(appId ? { appId } : {}),
    type,
    source: {
      chainId:
        Number(sourceChainId) === solana.chainId
          ? String(rozoSolana.chainId)
          : Number(sourceChainId) === stellar.chainId
            ? String(rozoStellar.chainId)
            : sourceChainId,
      tokenSymbol: sourceTokenSymbol,
      ...(type === FeeType.ExactIn || type === FeeType.AnyAmount ? { amount } : {}),
    },
    destination: {
      chainId: destChainId,
      receiverAddress: destReceiverAddress,
      tokenSymbol: destTokenSymbol,
      ...(isExactOut ? { amount } : {}),
    },
  };

  const result = await apiClient.post<FeeResponseData | FeeErrorData>(
    "payment-api/payments",
    body,
    { params: { dryrun: "true" } },
  );

  if (result.error) {
    return { data: null, error: result.error, status: result.status };
  }

  if (result.data && "error" in result.data) {
    const errData = result.data as FeeErrorData;
    return {
      data: null,
      error: new Error(errData.error?.message ?? "Fee calculation failed"),
      status: result.status,
    };
  }

  return { data: result.data as FeeResponseData, error: null, status: result.status };
};
