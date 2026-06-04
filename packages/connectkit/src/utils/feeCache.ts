import { getFee, GetFeeParams } from "@rozoai/intent-common";

/**
 * Module-level cache for getFee results, keyed by a stable JSON representation
 * of the request params. Lives for the lifetime of the page/module, so the same
 * token+chain+amount combo never triggers a second network call within a single
 * user session — even if the component unmounts and remounts (e.g. cancel → retry
 * with the same token).
 *
 * In-flight requests are also deduplicated: if two callers ask for the same key
 * simultaneously, only one network request is made and both callers receive the
 * same resolved value.
 */

type FeeResult = Awaited<ReturnType<typeof getFee>>;

type CacheEntry =
  | { status: "resolved"; value: FeeResult }
  | { status: "pending"; promise: Promise<FeeResult> };

const cache = new Map<string, CacheEntry>();

export function getCachedFee(params: GetFeeParams): Promise<FeeResult> {
  const key = JSON.stringify({
    appId: params.appId ?? null,
    type: params.type,
    sourceChainId: params.sourceChainId,
    sourceTokenSymbol: params.sourceTokenSymbol,
    amount: params.amount,
    destChainId: params.destChainId,
    destReceiverAddress: params.destReceiverAddress,
    destTokenSymbol: params.destTokenSymbol,
  });

  const existing = cache.get(key);

  if (existing) {
    if (existing.status === "resolved") {
      return Promise.resolve(existing.value);
    }
    // Another caller is already in-flight for the same params — share the promise
    return existing.promise;
  }

  const promise = getFee(params).then((result) => {
    // Only cache successful responses; errors should be retryable
    if (!result.error) {
      cache.set(key, { status: "resolved", value: result });
    } else {
      // Remove the pending entry so a subsequent call can retry
      cache.delete(key);
    }
    return result;
  });

  cache.set(key, { status: "pending", promise });
  return promise;
}

/** Exposed for testing or explicit invalidation if needed. */
export function clearFeeCache(): void {
  cache.clear();
}
