import {
  getChainExplorerTxUrl,
  getPayment,
  RozoPayHydratedOrderWithOrg,
  RozoPayOrder,
  RozoPayOrderWithOrg,
} from "@rozoai/intent-common";
import { useEffect, useState } from "react";
import { PayLogFn } from "../provider/PayContext";

const POLL_DELAY = 1000;

export interface UsePayoutPollingOptions {
  /** Whether polling is enabled */
  enabled: boolean | undefined;
  /** The Rozo payment ID to poll for */
  rozoPaymentId: string | undefined;
  /** The order object (for logging purposes) */
  order:
    | RozoPayOrder
    | RozoPayOrderWithOrg
    | RozoPayHydratedOrderWithOrg
    | null
    | undefined;
  /** Whether the payment is done */
  done: boolean | undefined;
  /** Whether to show processing payout */
  showProcessingPayout: boolean | undefined;
  /** Logging function */
  log: PayLogFn;
  /** Function to trigger resize */
  triggerResize: () => void;
}

export interface UsePayoutPollingResult {
  /** Whether payout is currently loading */
  payoutLoading: boolean;
  /** The payout transaction hash */
  payoutTxHash: string | undefined;
  /** The URL to view the payout transaction */
  payoutTxHashUrl: string | undefined;
}

/**
 * Hook to poll for payout transaction hash.
 * Polls the payment API until a payout transaction hash is found.
 *
 * @param options - Configuration options for payout polling
 * @returns Payout polling state and results
 */
export const usePayoutPolling = (
  options: UsePayoutPollingOptions
): UsePayoutPollingResult => {
  const {
    enabled,
    rozoPaymentId,
    order,
    done,
    showProcessingPayout,
    log,
    triggerResize,
  } = options;

  const [payoutLoading, setPayoutLoading] = useState<boolean>(false);
  const [payoutTxHash, setPayoutTxHash] = useState<string | undefined>(
    undefined
  );
  const [payoutTxHashUrl, setPayoutTxHashUrl] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    // Only start polling if all conditions are met and polling is enabled
    if (
      !enabled ||
      !order ||
      !done ||
      !rozoPaymentId ||
      !showProcessingPayout ||
      !("externalId" in order)
    ) {
      return;
    }

    triggerResize();
    log("[CONFIRMATION] Starting payout polling for order:", order.externalId);
    setPayoutLoading(true);

    let isActive = true;
    let timeoutId: NodeJS.Timeout;

    const pollPayout = async () => {
      if (!isActive || !rozoPaymentId) return;

      try {
        log("[CONFIRMATION] Polling for payout transaction:", rozoPaymentId);
        const response = await getPayment(rozoPaymentId, "v2");
        log("[CONFIRMATION] Payout polling response:", response.data);

        if (
          isActive &&
          response.data &&
          response.data.destination.txHash &&
          typeof response.data.destination.txHash === "string"
        ) {
          const url = getChainExplorerTxUrl(
            Number(response.data.destination.chainId),
            response.data.destination.txHash
          );
          log(
            "[CONFIRMATION] Found payout transaction:",
            response.data.destination.txHash,
            "URL:",
            url
          );
          setPayoutTxHash(response.data.destination.txHash);
          setPayoutTxHashUrl(url);
          setPayoutLoading(false);
          triggerResize();
          return;
        }

        // Schedule next poll
        if (isActive) {
          timeoutId = setTimeout(pollPayout, POLL_DELAY);
        }
      } catch (error) {
        console.error("[CONFIRMATION] Payout polling error:", error);
        if (isActive) {
          timeoutId = setTimeout(pollPayout, POLL_DELAY);
        }
      }
    };

    // Start polling
    timeoutId = setTimeout(pollPayout, 0);

    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, order, done, rozoPaymentId, showProcessingPayout]);

  return {
    payoutLoading,
    payoutTxHash,
    payoutTxHashUrl,
  };
};
