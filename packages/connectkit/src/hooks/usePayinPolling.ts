import { getPayment } from "@rozoai/intent-common";
import { useEffect, useState } from "react";
import { PayLogFn } from "../provider/PayContext";

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
      return;
    }

    log("[WAITING_DEPOSIT] Starting payin polling for:", rozoPaymentId);

    let isActive = true;
    let timeoutId: NodeJS.Timeout;

    const pollPayin = async () => {
      if (!isActive || !rozoPaymentId) return;

      try {
        const response = await getPayment(rozoPaymentId, "v2");
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
        console.error("[WAITING_DEPOSIT] Payin polling error:", error);
        if (isActive) {
          timeoutId = setTimeout(pollPayin, POLL_DELAY);
        }
      }
    };

    timeoutId = setTimeout(pollPayin, 0);

    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rozoPaymentId]);

  return { payinTxHash };
};
