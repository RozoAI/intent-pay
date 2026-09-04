import { getPayment } from "@rozoai/intent-common";
import { useEffect, useState } from "react";
import { PayLogFn } from "../provider/PayContext";
import {
  beginRequestScope,
  cancelRequestScope,
  isAbortError,
} from "../utils/paymentRequestScope";

const POLL_DELAY = 1000;

export interface UsePayinPollingOptions {
  /** Whether polling is enabled (true only after the Pusher fallback fires) */
  enabled: boolean | undefined;
  /** The Rozo payment ID (deposit externalId) to poll for */
  rozoPaymentId: string | undefined;
  /** Logging function */
  log: PayLogFn;
}

export interface UsePayinPollingResult {
  /** The payin (source) transaction hash, once detected */
  payinTxHash: string | undefined;
}

/**
 * Polls getPayment until the source (payin) transaction hash appears.
 * Used as a fallback in WaitingDepositAddress when Pusher misses the payin
 * event. Detection parity with the Pusher path: fires on source.txHash.
 */
export const usePayinPolling = (
  options: UsePayinPollingOptions,
): UsePayinPollingResult => {
  const { enabled, rozoPaymentId, log } = options;

  const [payinTxHash, setPayinTxHash] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !rozoPaymentId) {
      // Clear any stale hash so a later deposit can't observe a prior one.
      setPayinTxHash(undefined);
      return;
    }

    log("[WAITING_DEPOSIT] Starting payin polling for:", rozoPaymentId);

    // Unique scope key per payment ID so an unrelated beginRequestScope
    // (e.g. from setPayParams / generatePreviewOrder) doesn't kill this poll.
    const scopeKey = `payin-polling-${rozoPaymentId}`;
    let request = beginRequestScope(scopeKey);
    let isActive = true;
    let timeoutId: NodeJS.Timeout;

    const pollPayin = async () => {
      if (!isActive || !rozoPaymentId) return;

      try {
        const response = await getPayment(rozoPaymentId, "v2", {
          signal: request.signal,
        });
        const sourceTxHash = response?.data?.source?.txHash;

        if (
          isActive &&
          typeof sourceTxHash === "string" &&
          sourceTxHash.length > 0
        ) {
          log("[WAITING_DEPOSIT] Found payin transaction:", sourceTxHash);
          setPayinTxHash(sourceTxHash);
          return; // stop polling
        }

        if (isActive) {
          timeoutId = setTimeout(pollPayin, POLL_DELAY);
        }
      } catch (error) {
        if (!isActive) return;
        // Abort from our own scope → component unmounted or scope intentionally
        // cancelled. Don't reschedule.
        if (isAbortError(error) && request.signal.aborted) return;
        // Abort from external scope (shouldn't happen with unique key, but
        // defensive): re-begin and retry.
        if (isAbortError(error)) {
          log("[WAITING_DEPOSIT] External abort, resuming poll");
          request = beginRequestScope(scopeKey);
          timeoutId = setTimeout(pollPayin, POLL_DELAY);
          return;
        }
        console.error("[WAITING_DEPOSIT] Payin polling error:", error);
        timeoutId = setTimeout(pollPayin, POLL_DELAY);
      }
    };

    timeoutId = setTimeout(pollPayin, 0);

    return () => {
      isActive = false;
      cancelRequestScope(scopeKey);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rozoPaymentId]);

  return { payinTxHash };
};
