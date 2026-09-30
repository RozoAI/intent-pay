/**
 * @deprecated Use `getFee` from `@rozoai/intent-common` with `CreateNewPaymentParams`
 * instead. This file exists only for backward compatibility during the transition
 * from `GetFeeParams` to `CreateNewPaymentParams`. It will be removed in a future
 * release.
 *
 * `GetFeeParams` is preserved here so consumers pinning an older version of this
 * package can upgrade without a breaking build failure. New code should import
 * `getFee` and `CreateNewPaymentParams` from the root of this package.
 */

import { rozoSolana, solana } from "../chain";
import { apiClient, ApiResponse } from "./base";
import { FeeType } from "./types";
import type { FeeResponseData } from "./payment";

/**
 * @deprecated Use `CreateNewPaymentParams` instead. This interface is a legacy
 * shape that predates the unified payment payload. It will be removed in a
 * future release.
 */
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

/**
 * @deprecated Use `getFee` (the default export from `@rozoai/intent-common`)
 * which accepts `CreateNewPaymentParams`. This wrapper preserves the old
 * request body shape (token symbols, separate source/destination amounts)
 * and posts directly to the dry-run endpoint, so existing consumers can
 * upgrade without a breaking change. It will be removed in a future release.
 */
export const getFeeLegacy = async (
  params: GetFeeParams,
): Promise<ApiResponse<FeeResponseData>> => {
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

  const result = await apiClient.post<
    FeeResponseData | { error: { code: string; message: string } }
  >("payment-api/payments", body, { params: { dryrun: "true" } });

  if (result.error) {
    return { data: null, error: result.error, status: result.status };
  }

  if (result.data && "error" in result.data) {
    const errData = result.data as { error: { code: string; message: string } };
    return {
      data: null,
      error: new Error(errData.error?.message ?? "Fee calculation failed"),
      status: result.status,
    };
  }

  return { data: result.data as FeeResponseData, error: null, status: result.status };
};