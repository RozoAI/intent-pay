import {
  CreateNewPaymentParams,
  FeeType,
  getFee,
  rozoStellar,
  rozoStellarEURC,
  rozoStellarUSDC,
} from "@rozoai/intent-common";
import { formatUnits, parseUnits } from "viem";
import { DEFAULT_ROZO_APP_ID } from "../constants/rozoConfig";

/**
 * Module-level cache for getFee results, keyed by a stable JSON representation
 * of the request params. Resolved entries expire after TTL_MS so the same
 * token+chain+amount combo skips a second network call only while the quote
 * is still fresh — even if the component unmounts and remounts (e.g. cancel → retry
 * with the same token).
 *
 * In-flight requests are also deduplicated: if two callers ask for the same key
 * simultaneously, only one network request is made and both callers receive the
 * same resolved value.
 */

type FeeResult = Awaited<ReturnType<typeof getFee>>;

type CacheEntry =
  | { status: "resolved"; value: FeeResult; expiresAt: number }
  | { status: "pending"; promise: Promise<FeeResult> };

/** Resolved fee quotes are time-sensitive (rate/gas drift), so expire after 60s. */
const TTL_MS = 60_000;

const cache = new Map<string, CacheEntry>();

export function getCachedFee(
  params: CreateNewPaymentParams,
): Promise<FeeResult> {
  const key = JSON.stringify(params);

  const existing = cache.get(key);

  if (existing) {
    if (existing.status === "resolved") {
      if (Date.now() < existing.expiresAt) {
        return Promise.resolve(existing.value);
      }
      cache.delete(key);
    } else {
      // Another caller is already in-flight for the same params — share the promise
      return existing.promise;
    }
  }

  const promise = getFee(params)
    .then((result) => {
      // Only cache successful responses; errors should be retryable
      if (!result.error) {
        cache.set(key, {
          status: "resolved",
          value: result,
          expiresAt: Date.now() + TTL_MS,
        });
      } else {
        // Remove the pending entry so a subsequent call can retry
        cache.delete(key);
      }
      return result;
    })
    .catch((e: unknown) => {
      // Rejection poisons the pending entry forever — delete it so a retry
      // can make a fresh request (e.g. after a bad token/address resolves).
      cache.delete(key);
      throw e;
    });

  cache.set(key, { status: "pending", promise });
  return promise;
}

/** Exposed for testing or explicit invalidation if needed. */
export function clearFeeCache(): void {
  cache.clear();
}

/**
 * Resolve the appId for fee-quote calls: prefer `order.metadata.appId` (set by
 * Checkout / payId flows) over the prop-based `payParams.appId` (Bridge/Deposit).
 * Validates the metadata value is a non-empty string before trusting it.
 */
export function resolveOrderAppId(
  order: { metadata?: unknown } | undefined | null,
  payParamsAppId?: string,
): string | undefined {
  const metaAppId = (order?.metadata as { appId?: unknown } | undefined)?.appId;
  return typeof metaAppId === "string" && metaAppId.length > 0
    ? metaAppId
    : payParamsAppId;
}

/**
 * Builds the CreateNewPaymentParams payload shared by every fee-quote call
 * site (PayWithToken, PayWithSolanaToken, PayWithStellarToken,
 * WaitingDepositAddress). Centralizing this means a new field on
 * CreateNewPaymentParams (or a change to how appId/intent are resolved)
 * only needs to be wired here once instead of at every call site.
 */
export function buildFeeQuoteParams(params: {
  order: { metadata?: unknown; destFinalCallTokenAmount?: { amount: string; token: { decimals: number } } } | undefined | null;
  payParams?: {
    appId?: string;
    feeType?: CreateNewPaymentParams["feeType"];
    toAddress?: string;
    intent?: string;
  } | null;
  /** Destination chain/token — normally the order's destFinalCallTokenAmount.token. */
  destChainId: number;
  destTokenAddress: string;
  /** Destination address — normally getCanonicalDestination(order).finalDestinationAddress. */
  destAddress: string;
  /** Source (what the payer sends) chain/token. */
  sourceChainId: number;
  sourceTokenAddress: string;
  /** Amount in destination units (atomic). */
  toUnits: string;
  /** Fee in USD for the selected wallet option — used for ExactOut adjustment. */
  feeUsd?: number;
}): CreateNewPaymentParams {
  const {
    order,
    payParams,
    destChainId,
    destTokenAddress,
    destAddress,
    sourceChainId,
    sourceTokenAddress,
    toUnits,
  } = params;

  // Stellar Direct Settlement: same derivation as buildCreatePaymentPayload
  // (createPaymentPayload.ts). When both source and destination are Stellar
  // with the same supported token (USDC or EURC), force intent to
  // "stellar_direct" so getFee quotes the zero-fee direct-settlement path
  // instead of the bridge/hub route.
  const isStellarSameToken =
    destChainId === rozoStellar.chainId &&
    sourceChainId === rozoStellar.chainId &&
    destTokenAddress.toLowerCase() === sourceTokenAddress.toLowerCase();
  const isSupportedStellarToken =
    destTokenAddress.toLowerCase() === rozoStellarUSDC.token.toLowerCase() ||
    destTokenAddress.toLowerCase() === rozoStellarEURC.token.toLowerCase();
  const isStellarDirect = isStellarSameToken && isSupportedStellarToken;
  const intent = isStellarDirect ? "stellar_direct" : payParams?.intent;

  // Apply ExactOut adjustment to match buildCreatePaymentPayload behavior.
  // For ExactOut, the API expects the destination amount MINUS the fee.
  // feeUsd is the fee for the selected wallet option (in USD).
  let adjustedToUnits = toUnits;
  if (params.feeUsd != null && payParams?.feeType !== FeeType.ExactIn) {
    // Need to know the destination token decimals to parse/adjust.
    // The order carries the destination token info.
    const destToken = order?.destFinalCallTokenAmount?.token;
    if (destToken) {
      const feeAtomic = parseUnits(params.feeUsd.toFixed(destToken.decimals), destToken.decimals);
      const amountAtomic = parseUnits(toUnits, destToken.decimals);
      const adjustedAtomic = amountAtomic - feeAtomic;
      const safeAtomic = adjustedAtomic < 0n ? 0n : adjustedAtomic;
      adjustedToUnits = formatUnits(safeAtomic, destToken.decimals);
    }
  }

  return {
    appId: resolveOrderAppId(order, payParams?.appId) ?? DEFAULT_ROZO_APP_ID,
    feeType: payParams?.feeType ?? FeeType.ExactIn,
    toChain: destChainId,
    toToken: destTokenAddress,
    toAddress: destAddress || payParams?.toAddress || "",
    preferredChain: sourceChainId,
    preferredTokenAddress: sourceTokenAddress,
    toUnits: adjustedToUnits,
    ...(intent ? { intent } : {}),
  };
}
