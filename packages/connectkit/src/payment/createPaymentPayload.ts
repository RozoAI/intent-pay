import {
  ApiVersion,
  baseEURC,
  baseUSDC,
  CreateNewPaymentParams,
  FeeType,
  generateIntentTitle,
  getKnownToken,
  getOrderDestChainId,
  mergedMetadata,
  RozoPayHydratedOrderWithOrg,
  RozoPayOrderWithOrg,
  rozoSolana,
  rozoStellar,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { formatUnits } from "viem";
import { DEFAULT_ROZO_APP_ID } from "../constants/rozoConfig";
import { PayParams } from "./paymentFsm";

type OrderLike = RozoPayHydratedOrderWithOrg | RozoPayOrderWithOrg;

export type CreatePaymentContext = {
  /** Original pay params from the button. */
  payParams: PayParams;
  /** Existing order, if any (used to derive amount/metadata in hydrate flows). */
  order?: OrderLike;
  /** Wallet option the user selected (required for wallet payments). */
  walletOption?: WalletPaymentOption;
  /** Explicit API version (defaults to v2). */
  apiVersion?: ApiVersion;
  /** Override for fee type – falls back to payParams.feeType or ExactIn. */
  feeTypeOverride?: FeeType;
  /**
   * Whether to merge metadata from an existing order into the payment payload.
   * - true: include order metadata (hydrate existing order)
   * - false: only include metadata from payParams (standalone Rozo payment)
   */
  includeOrderMetadata?: boolean;
};

/**
 * Resolve the final destination address from PayParams, handling EVM, Solana
 * and Stellar destinations in a single place.
 */
export function resolveDestinationAddress(payParams: PayParams): string {
  if (payParams.toSolanaAddress && payParams.toSolanaAddress.trim() !== "") {
    return payParams.toSolanaAddress;
  }
  if (payParams.toStellarAddress && payParams.toStellarAddress.trim() !== "") {
    return payParams.toStellarAddress;
  }
  return payParams.toAddress ?? "";
}

/**
 * Build a CreateNewPaymentParams payload in a single, canonical place.
 *
 * This helper encapsulates:
 * - Destination token/amount resolution from either payParams or an existing order
 * - Preferred payment method (wallet option vs default Base chain)
 * - Address normalization across EVM/Solana/Stellar
 * - FeeType handling (ExactIn / ExactOut)
 */
export function buildCreatePaymentPayload(
  ctx: CreatePaymentContext
): CreateNewPaymentParams {
  const {
    payParams,
    order,
    walletOption,
    apiVersion = "v2",
    feeTypeOverride,
    includeOrderMetadata = false,
  } = ctx;

  const appId = payParams.appId ?? DEFAULT_ROZO_APP_ID;
  const feeType = feeTypeOverride ?? payParams.feeType ?? FeeType.ExactIn;

  // --------------------------------------------------
  // Destination token / amount
  // --------------------------------------------------
  let toChain: number;
  let toTokenAddress: string;
  let rawAmountUnitsStr: string;
  let tokenDecimals: number;

  if (order) {
    toChain = getOrderDestChainId(order);
    toTokenAddress = order.destFinalCallTokenAmount.token.token;

    const token = getKnownToken(toChain, toTokenAddress);
    if (!token) {
      throw new Error(
        `Token not found for chain ${toChain} and token ${toTokenAddress}`
      );
    }

    tokenDecimals = token.decimals;
    rawAmountUnitsStr = formatUnits(
      BigInt(order.destFinalCallTokenAmount.amount),
      tokenDecimals
    );
  } else {
    toChain = payParams.toChain;
    toTokenAddress = payParams.toToken;
    const token = getKnownToken(toChain, toTokenAddress);
    tokenDecimals = token?.decimals ?? 18;
    rawAmountUnitsStr = payParams.toUnits ?? "0";
  }

  const rawAmountNumber = Number(rawAmountUnitsStr);

  // --------------------------------------------------
  // Preferred payment method (what user will pay with)
  // --------------------------------------------------
  let preferredChain: number;
  let preferredTokenAddress: string;

  if (walletOption) {
    preferredChain = walletOption.required.token.chainId;
    preferredTokenAddress = walletOption.required.token.token;

    // Special-case: Solana wallet should pay into Rozo Solana bridge chain
    if (preferredChain === rozoSolana.chainId) {
      preferredChain = rozoSolana.chainId;
    }
  } else {
    // When no explicit wallet option is given, default preferred chain/token
    // based on whether destination token is USD or non-USD (EURC etc.)
    const destToken = getKnownToken(toChain, toTokenAddress);
    const isNonUSDToken = destToken?.fiatISO !== "USD";

    preferredChain = isNonUSDToken ? baseEURC.chainId : baseUSDC.chainId;
    preferredTokenAddress = isNonUSDToken ? baseEURC.token : baseUSDC.token;
  }

  // --------------------------------------------------
  // Fee handling
  // --------------------------------------------------
  const feeUsd = walletOption?.fees.usd ?? 0;
  const calculatedToUnits =
    feeType === FeeType.ExactIn
      ? rawAmountNumber
      : rawAmountNumber - Number(feeUsd);

  // Clamp to zero to avoid negative amounts when fees exceed amount
  const safeToUnits = Math.max(calculatedToUnits, 0);

  // --------------------------------------------------
  // Address & metadata
  // --------------------------------------------------
  const toAddress = resolveDestinationAddress(payParams);

  const isAbleToIncludeReceiverMemo = [
    rozoSolana.chainId,
    rozoStellar.chainId,
  ].includes(toChain);

  const title =
    payParams.metadata?.intent ??
    payParams.intent ??
    generateIntentTitle({
      toChainId: toChain,
      toTokenAddress: toTokenAddress,
      preferredChainId: preferredChain,
      preferredTokenAddress,
    });

  const orderMetadata =
    includeOrderMetadata && order
      ? {
          ...(order.metadata ?? {}),
          ...((order as any).userMetadata ?? {}),
        }
      : {};

  const payload: CreateNewPaymentParams = {
    apiVersion,
    title,
    feeType,
    appId,
    toChain,
    toToken: toTokenAddress,
    toAddress,
    preferredChain,
    preferredTokenAddress,
    toUnits: safeToUnits.toFixed(2),
    ...(isAbleToIncludeReceiverMemo && payParams.receiverMemo
      ? { receiverMemo: payParams.receiverMemo }
      : {}),
    description: payParams.metadata?.description ?? "",
    metadata: mergedMetadata({
      ...orderMetadata,
      ...(payParams.metadata ?? {}),
    }),
  };

  return payload;
}
