/**
 * Resolves the on-chain outcome of a Stellar transaction whose wallet
 * submission result is unknown (WalletConnect `stellar_signAndSubmitXDR`
 * returned "pending", an unexpected/missing status, or a non-rejection error
 * after the request may already have reached the wallet).
 *
 * The transaction hash does not depend on signatures, so the caller computes
 * it from the XDR it sent. Horizon is the evidence:
 * - found and successful -> "success" (the payment is on chain)
 * - found and failed     -> "failed"  (definite failure, sequence consumed)
 * - not found, and Horizon has ingested a ledger that closed after the tx's
 *   timebounds max_time -> "expired" (the tx can never be included)
 * - anything else within the polling budget -> "unknown" (we could not prove
 *   either way; the user must check the wallet before paying again)
 *
 * "expired" is decided from the ledger close time Horizon reports, not the
 * local clock, so a skewed device clock can only make us give up as
 * "unknown", never declare a broadcast transaction failed.
 */

export type StellarTxLookupResult =
  | { found: false }
  | { found: true; successful: boolean };

export type StellarSubmissionOutcome =
  | { kind: "success"; txHash: string }
  | { kind: "failed"; txHash: string }
  | { kind: "expired"; txHash: string }
  | { kind: "unknown"; txHash: string };

export type ResolveStellarSubmissionOutcomeOptions = {
  /** Hex hash of the (inner) transaction that was handed to the wallet. */
  txHash: string;
  /** Timebounds max_time in unix seconds. 0 / undefined = no upper bound. */
  maxTime?: number;
  /** Look up a tx by hash. Resolve `{ found: false }` only for a 404. */
  lookupTx: (txHash: string) => Promise<StellarTxLookupResult>;
  /** Close time (unix seconds) of the latest ledger Horizon has ingested. */
  latestLedgerCloseTime: () => Promise<number>;
  signal?: AbortSignal;
  intervalMs?: number;
  /** Extra local time allowed past max_time for ledger close + ingestion. */
  maxTimeGraceMs?: number;
  /** Polling budget when the tx has no max_time. */
  noMaxTimeBudgetMs?: number;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

const abortError = () => {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
};

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError());
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

export async function resolveStellarSubmissionOutcome(
  options: ResolveStellarSubmissionOutcomeOptions,
): Promise<StellarSubmissionOutcome> {
  const {
    txHash,
    lookupTx,
    latestLedgerCloseTime,
    signal,
    intervalMs = 2_000,
    maxTimeGraceMs = 120_000,
    noMaxTimeBudgetMs = 60_000,
    now = Date.now,
    sleep = defaultSleep,
  } = options;
  const maxTime =
    options.maxTime && Number.isFinite(options.maxTime) && options.maxTime > 0
      ? options.maxTime
      : undefined;

  const startedAt = now();
  const deadline =
    maxTime !== undefined
      ? Math.max(maxTime * 1000, startedAt) + maxTimeGraceMs
      : startedAt + noMaxTimeBudgetMs;

  for (;;) {
    if (signal?.aborted) throw abortError();
    try {
      // Read the ledger close time BEFORE the tx lookup: Horizon ingests a
      // ledger and its transactions atomically, so a not-found lookup made
      // after seeing ledger L proves the tx is not in any ledger up to L.
      // A ledger query failure only removes the evidence for "expired"; it
      // must not stop us from reading success/failure from the tx lookup.
      let closeTime: number | undefined;
      if (maxTime !== undefined) {
        try {
          closeTime = await latestLedgerCloseTime();
        } catch (error) {
          if (signal?.aborted) throw error;
        }
      }
      const lookup = await lookupTx(txHash);
      if (lookup.found) {
        return { kind: lookup.successful ? "success" : "failed", txHash };
      }
      if (
        maxTime !== undefined &&
        closeTime !== undefined &&
        Number.isFinite(closeTime) &&
        closeTime > maxTime
      ) {
        return { kind: "expired", txHash };
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      // Transient Horizon error: keep polling within the budget.
    }

    if (now() >= deadline) return { kind: "unknown", txHash };
    await sleep(intervalMs, signal);
  }
}
