import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePayContext } from "../../../hooks/usePayContext";

import { Link, ModalBody, ModalContent, ModalH1, PageContent } from "../../Common/Modal/styles";

import {
  assert,
  getAddressContraction,
  getChainExplorerTxUrl,
  getOrderDestChainId,
  getPayment,
  normalizeTokenAddress,
  PaymentStatus,
  rozoSolana,
  rozoStellar,
  updatePaymentPayInTxHash,
} from "@rozoai/intent-common";
import { motion } from "framer-motion";
import { BadgeCheckIcon, ExternalLinkIcon, LoadingCircleIcon, Ring } from "../../../assets/icons";
import defaultTheme from "../../../constants/defaultTheme";
import { ROUTES } from "../../../constants/routes";
import { ROZO_INVOICE_URL } from "../../../constants/rozoConfig";
import { usePayoutPolling } from "../../../hooks/usePayoutPolling";
import { usePusherPayout } from "../../../hooks/usePusherPayout";
import { useRozoPay } from "../../../hooks/useRozoPay";
import {
  beginRequestScope,
  cancelRequestScope,
} from "../../../utils/paymentRequestScope";
import { useSupportedChains } from "../../../hooks/useSupportedChains";
import { ROZO_EVENTS } from "../../../lib/analytics/events";
import { useAnalytics } from "../../../provider/AnalyticsProvider";
import styled from "../../../styles/styled";
import Button from "../../Common/Button";
import PoweredByFooter from "../../Common/PoweredByFooter";

const Confirmation: React.FC = () => {
  const {
    confirmationMessage,
    onSuccess,
    debugMode,
    paymentState: paymentStateContext,
    triggerResize,
    ...context
  } = usePayContext();
  const { order, paymentState, setPaymentCompleted, setPaymentPayoutCompleted } = useRozoPay();

  const { capture } = useAnalytics();

  // Server-confirmed payin, keyed by (paymentId, txHash) so a confirmation
  // for one payment can never satisfy the gate for another. A wallet-returned
  // tx hash is only a claim that a transaction was submitted; the API is the
  // only party that verifies it landed on-chain for this order. Nothing below
  // may show "Payment Completed", emit onPaymentCompleted, or fire onSuccess
  // until this is set for the current key.
  const [payinConfirmed, setPayinConfirmed] = useState<{
    key: string;
    txHash: string;
    confirmedAt?: string;
    payoutTxHash?: string;
    sameTxPayout: boolean;
  } | null>(null);
  // Set when the gate stops waiting (payment expired or hard timeout) without
  // a confirmation. Still not "done" — the UI switches to an actionable state.
  const [payinTimedOut, setPayinTimedOut] = useState<string | null>(null);

  // Track if completion events have been sent to prevent duplicate calls
  const paymentCompletedSent = useRef<string | null>(null);
  const payoutCompletedSent = useRef<string | null>(null);

  // Local state for Pusher payout transaction hash
  const [pusherPayoutTxHash, setPusherPayoutTxHash] = useState<string | undefined>(undefined);

  // Track Pusher initialization and data activity for timeout logic
  const [pusherEnabled, setPusherEnabled] = useState<boolean>(true);
  const [pollingEnabled, setPollingEnabled] = useState<boolean>(false);
  const pusherInitializedTimeRef = useRef<number | null>(null);
  const pusherDataReceivedRef = useRef<boolean>(false);
  const pusherUnsubscribeRef = useRef<(() => void) | null>(null);
  const payoutCompletedRef = useRef<boolean>(false);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const pusherEnabledRef = useRef<boolean>(true);
  const prevRozoPaymentIdRef = useRef<string | undefined>(undefined);

  // Whether this is a non-merchant (rozo) payment — stellar, solana, or evm with a user-submitted txHash
  const { tokens: supportedTokens } = useSupportedChains();

  // stellar_direct optimization: when settlementMode is "stellar_direct" and
  // source txHash === destination txHash, the same Stellar transaction settles
  // both deposit and payout. Skip Pusher/polling entirely — the payout txHash
  // is known as soon as the pay-in txHash is confirmed.
  const isStellarDirectSameTx = useMemo(() => {
    if (!order) return false;

    const meta = (order as any).metadata as Record<string, unknown> | undefined;
    if (meta?.settlementMode !== "stellar_direct") return false;

    const sourceTx =
      (order as any).sourceStartTxHash ?? (meta?.payinTransactionHash as string | undefined);

    const destTx =
      (order as any).payoutTransactionHash ??
      (order as any).destFastFinishTxHash ??
      (order as any).destClaimTxHash;

    return !!sourceTx && !!destTx && sourceTx === destTx;
  }, [order]);

  // showProcessingPayout: true only when the merchant explicitly opts in AND
  // the API tells us this is not a merchant payment (isMerchant = false).
  // Merchant payments always resolve immediately — no payout waiting step.
  const showProcessingPayout = useMemo(() => {
    const { payParams, tokenMode } = paymentStateContext;

    // Skip payout waiting when stellar_direct settles source and dest in same tx
    if (isStellarDirectSameTx) return false;

    // If the API says this is a merchant payment, always suppress payout step
    if (order && "metadata" in order && order.metadata != null) {
      const meta = order.metadata as any;
      if (meta.isMerchant === true) {
        return false;
      }
    }

    if (payParams && (tokenMode === "stellar" || tokenMode === "solana" || tokenMode === "evm")) {
      return payParams.showProcessingPayout;
    }

    return false;
  }, [order, paymentStateContext, isStellarDirectSameTx]);

  // Compute Pusher payout URL at render time to avoid stale closure issues
  // (the onPayoutCompleted callback may have stale `order` reference)
  const computedPusherPayoutTxHashUrl = useMemo(() => {
    if (pusherPayoutTxHash && order) {
      const destChainId = getOrderDestChainId(order);
      return getChainExplorerTxUrl(destChainId, pusherPayoutTxHash);
    }
    return undefined;
  }, [pusherPayoutTxHash, order]);

  const rozoPaymentId = useMemo(() => {
    const id = order?.externalId || paymentStateContext.rozoPaymentId;
    return id;
  }, [order?.externalId, paymentStateContext.rozoPaymentId]);

  // Debug: Log when rozoPaymentId changes
  useEffect(() => {
    if (rozoPaymentId) {
      context.log("[CONFIRMATION] rozoPaymentId available:", rozoPaymentId);
    } else {
      context.log("[CONFIRMATION] rozoPaymentId not available yet", {
        orderExternalId: order?.externalId,
        contextRozoPaymentId: paymentStateContext.rozoPaymentId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rozoPaymentId, order?.externalId, paymentStateContext.rozoPaymentId]);

  const isRozoPayment = useMemo(() => {
    const { tokenMode } = paymentStateContext;
    return (
      tokenMode === "stellar" ||
      tokenMode === "solana" ||
      (["evm", "all"].includes(tokenMode) &&
        !!order &&
        supportedTokens.some(
          (token) =>
            normalizeTokenAddress(token.chainId, token.token) ===
            normalizeTokenAddress(
              order.destFinalCallTokenAmount?.token.chainId,
              order.destFinalCallTokenAmount?.token.token,
            ),
        ))
    );
  }, [order, paymentStateContext, supportedTokens]);

  // Only payments the API knows about can be gated. A rozo-destination EVM
  // order with no payment id keeps the legacy behaviour (done on txHash).
  const payinGateActive = isRozoPayment && !!rozoPaymentId;
  const payinGateKey =
    payinGateActive && paymentStateContext.txHash
      ? `${rozoPaymentId}:${paymentStateContext.txHash}`
      : null;

  // Payin truth gate: report the wallet's tx hash to the API, then poll the
  // payment until the API says the deposit is confirmed. Restarts safely on
  // re-run (StrictMode double-mount, key change): the report is idempotent
  // server-side and the poll is read-only. The UI stays on "Confirming..."
  // throughout. Bounded by the payment's expiresAt (+ grace) or 15 minutes.
  useEffect(() => {
    if (!payinGateKey || !rozoPaymentId) return;
    const { txHash, senderAddress } = paymentStateContext;
    if (!txHash) return;
    if (payinConfirmed?.key === payinGateKey) return;

    let active = true;
    // Isolated scope: the shared "payment-flow" scope is cancelled by
    // unrelated unmounts (e.g. WaitingDepositAddress cleanup on route change),
    // which aborted the in-flight payin report. Same pattern as
    // usePayinPolling / usePayoutPolling.
    const scopeKey = `payin-gate-${payinGateKey}`;
    const request = beginRequestScope(scopeKey);
    let timeoutId: NodeJS.Timeout | undefined;
    const startedAt = Date.now();
    const HARD_CAP_MS = 15 * 60_000;
    const EXPIRY_GRACE_MS = 2 * 60_000;
    let deadline = startedAt + HARD_CAP_MS;
    setPayinTimedOut(null);

    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          if (timeoutId) clearTimeout(timeoutId);
          request.signal.removeEventListener("abort", onAbort);
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        };
        timeoutId = setTimeout(() => {
          request.signal.removeEventListener("abort", onAbort);
          resolve();
        }, ms);
        if (request.signal.aborted) {
          onAbort();
          return;
        }
        request.signal.addEventListener("abort", onAbort, { once: true });
      });

    const reportPayin = async () => {
      // Three attempts. A failure here is not fatal for the payment itself
      // (the API's on-chain scan will still find a real deposit), but it must
      // never be silent: it is exactly how a wallet-returned hash that never
      // landed goes unnoticed. apiClient resolves HTTP failures as
      // { data: null, error }, so check the response, not just for a throw.
      for (let attempt = 1; attempt <= 3 && active; attempt++) {
        try {
          const res = await updatePaymentPayInTxHash({
            paymentId: rozoPaymentId,
            txHash,
            senderAddress: senderAddress || undefined,
            apiVersion: "v2",
            signal: request.signal,
          });
          if (res && !res.error && res.data) {
            context.log("[CONFIRMATION] Payin tx hash reported:", { rozoPaymentId, txHash });
            return true;
          }
          context.log(`[CONFIRMATION] Payin report attempt ${attempt} rejected:`, res?.error);
        } catch (error) {
          if ((error as Error)?.name === "AbortError") return false;
          context.log(`[CONFIRMATION] Payin report attempt ${attempt} failed:`, error);
        }
        if (attempt < 3 && active) await sleep(1000 * attempt);
      }
      if (active) {
        capture(ROZO_EVENTS.PAYMENT_FAILED, {
          payment_id: rozoPaymentId,
          tx_hash: txHash,
          error_message: "payin_report_failed",
        });
      }
      return false;
    };

    const pollUntilConfirmed = async () => {
      while (active) {
        try {
          // apiClient's fetch has no timeout; race it against the remaining
          // deadline (capped at 20s) so a stalled connection cannot outlive
          // the bound below.
          const remaining = Math.max(deadline - Date.now(), 0);
          let raceTimer: NodeJS.Timeout | undefined;
          let response: Awaited<ReturnType<typeof getPayment>>;
          try {
            response = await Promise.race([
              getPayment(rozoPaymentId, "v2", { signal: request.signal }),
              new Promise<never>((_, reject) => {
                raceTimer = setTimeout(
                  () => reject(new Error("getPayment timed out")),
                  Math.min(remaining, 20_000) + 1,
                );
              }),
            ]);
          } finally {
            if (raceTimer) clearTimeout(raceTimer);
          }
          const payment = response.data;
          if (!active) return;
          if (payment) {
            const expiresAt = payment.expiresAt ? new Date(payment.expiresAt).getTime() : NaN;
            if (Number.isFinite(expiresAt)) {
              deadline = Math.min(startedAt + HARD_CAP_MS, expiresAt + EXPIRY_GRACE_MS);
            }
            const confirmedAt = payment.source?.confirmedAt;
            const status = payment.status;
            const confirmed =
              !!confirmedAt ||
              status === PaymentStatus.PaymentPayinCompleted ||
              status === PaymentStatus.PaymentCompleted ||
              status === PaymentStatus.PaymentPayoutCompleted;
            if (confirmed) {
              const sourceTxHash = payment.source?.txHash || txHash;
              const payoutTxHash = payment.destination?.txHash || undefined;
              const sameTxPayout =
                (payment.metadata as any)?.settlementMode === "stellar_direct" &&
                !!payoutTxHash &&
                payoutTxHash === sourceTxHash;
              context.log("[CONFIRMATION] Payin confirmed by API:", { status, confirmedAt, sameTxPayout });
              setPayinConfirmed({
                key: payinGateKey,
                txHash: sourceTxHash,
                confirmedAt: confirmedAt ? String(confirmedAt) : undefined,
                payoutTxHash,
                sameTxPayout,
              });
              return;
            }
            if (
              status === PaymentStatus.PaymentBounced ||
              status === PaymentStatus.PaymentExpired ||
              status === PaymentStatus.PaymentRefunded
            ) {
              context.log("[CONFIRMATION] Payin rejected by API:", { status, errorCode: payment.errorCode });
              capture(ROZO_EVENTS.PAYMENT_FAILED, {
                payment_id: rozoPaymentId,
                tx_hash: txHash,
                error_message: payment.errorCode ?? status,
              });
              context.setRoute(ROUTES.ERROR, {
                error: `Payment ${status.replace("payment_", "")}${
                  payment.errorCode ? ` (${payment.errorCode})` : ""
                }`,
              });
              return;
            }
          }
        } catch (error) {
          if ((error as Error)?.name === "AbortError") return;
          context.log("[CONFIRMATION] Payin polling error:", error);
        }
        if (Date.now() >= deadline) {
          context.log("[CONFIRMATION] Payin confirmation timed out:", { rozoPaymentId, txHash });
          capture(ROZO_EVENTS.PAYMENT_FAILED, {
            payment_id: rozoPaymentId,
            tx_hash: txHash,
            error_message: "payin_confirmation_timeout",
          });
          setPayinTimedOut(payinGateKey);
          return;
        }
        // 2s for the first minute, then 5s.
        await sleep(Date.now() - startedAt < 60_000 ? 2000 : 5000);
      }
    };

    (async () => {
      await reportPayin();
      await pollUntilConfirmed();
    })();

    return () => {
      active = false;
      cancelRequestScope(scopeKey);
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payinGateKey, rozoPaymentId]);

  // useMemo only for computation, no state changes
  const { done, txURL, rawPayInHash, pendingTxURL } = useMemo(() => {
    const { tokenMode, txHash } = paymentStateContext;

    if (isRozoPayment && txHash) {
      // Determine chain ID based on token mode
      let chainId: number;
      if (tokenMode === "stellar") {
        chainId = rozoStellar.chainId;
      } else if (tokenMode === "solana") {
        chainId = rozoSolana.chainId;
      } else {
        // Wallet flow sets selectedTokenOption; deposit-address flow sets
        // selectedDepositAddressOption instead — fall back to it.
        chainId = Number(
          paymentStateContext.selectedTokenOption?.required.token.chainId ??
            paymentStateContext.selectedDepositAddressOption?.token.chainId ??
            paymentStateContext.selectedDepositAddressOption?.chainId,
        );
      }

      // Gated payments are not done until the API confirmed THIS deposit.
      if (payinGateActive) {
        const confirmedForKey = payinConfirmed && payinConfirmed.key === payinGateKey;
        if (!confirmedForKey) {
          return {
            done: false,
            txURL: undefined,
            rawPayInHash: undefined,
            pendingTxURL: getChainExplorerTxUrl(chainId, txHash),
          };
        }
        const txURL = getChainExplorerTxUrl(chainId, payinConfirmed.txHash);
        return { done: true, txURL, rawPayInHash: payinConfirmed.txHash, pendingTxURL: undefined };
      }

      // Legacy: rozo-destination order without an API payment id.
      const txURL = getChainExplorerTxUrl(chainId, txHash);
      return { done: true, txURL, rawPayInHash: txHash, pendingTxURL: undefined };
    } else {
      if (paymentState === "payment_completed" || paymentState === "payment_bounced") {
        const txHash = order.destFastFinishTxHash ?? order.destClaimTxHash;
        const destChainId = getOrderDestChainId(order);
        assert(txHash != null, `[CONFIRMATION] paymentState: ${paymentState}, but missing txHash`);
        const txURL = getChainExplorerTxUrl(destChainId, txHash);

        return { done: true, txURL, rawPayInHash: txHash, pendingTxURL: undefined };
      }
    }

    return { done: false, txURL: undefined, rawPayInHash: undefined, pendingTxURL: undefined };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentState, order, paymentStateContext, isRozoPayment, payinGateActive, payinGateKey, payinConfirmed]);

  const payinWaitTimedOut = !!payinGateKey && payinTimedOut === payinGateKey;

  const analyticsCompletedSent = useRef<string | null>(null);
  useEffect(() => {
    if (!done || !rawPayInHash) return;
    const key = `${rozoPaymentId}:${rawPayInHash}`;
    if (analyticsCompletedSent.current === key) return;
    analyticsCompletedSent.current = key;
    const destChainId = order ? getOrderDestChainId(order) : undefined;

    let duration_ms: number | undefined;
    try {
      const submittedAt = sessionStorage.getItem(`rozo_submitted_at:${rozoPaymentId}`);
      if (submittedAt) {
        duration_ms = Date.now() - Number(submittedAt);
        sessionStorage.removeItem(`rozo_submitted_at:${rozoPaymentId}`);
      }
    } catch {
      // sessionStorage unavailable — omit duration
    }

    capture(ROZO_EVENTS.PAYMENT_COMPLETED, {
      payment_id: rozoPaymentId,
      tx_hash: rawPayInHash,
      destination_chain: destChainId,
      source_chain: paymentStateContext.selectedTokenOption?.required.token.chainId,
      amount:
        paymentStateContext.payParams?.toUnits != null
          ? String(paymentStateContext.payParams.toUnits)
          : order?.destFinalCallTokenAmount?.usd != null
            ? String(order.destFinalCallTokenAmount.usd)
            : undefined,
      token_symbol: order?.destFinalCallTokenAmount?.token.symbol,
      ...(duration_ms !== undefined && { duration_ms }),
    });
  }, [done, rawPayInHash, rozoPaymentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const receiptUrl = useMemo(() => {
    if (
      order &&
      "metadata" in order &&
      "receiptUrl" in order.metadata &&
      typeof order.metadata.receiptUrl === "string"
    ) {
      const url = new URL(order.metadata.receiptUrl as string);
      return url.toString();
    }
    return undefined;
  }, [order]);

  const generateReceiptUrl = useMemo(() => {
    // If the receiptUrl is set, use it
    if (receiptUrl) {
      return receiptUrl;
    }

    if (rozoPaymentId) {
      const url = new URL(`${ROZO_INVOICE_URL}/receipt`);
      url.searchParams.set("id", rozoPaymentId);
      return url.toString();
    }
    return undefined;
  }, [rozoPaymentId, receiptUrl]);

  // Use payout polling hook
  const { payoutLoading, payoutTxHash, payoutTxHashUrl } = usePayoutPolling({
    enabled: pollingEnabled,
    rozoPaymentId,
    order,
    done,
    showProcessingPayout,
    log: context.log,
    triggerResize,
  });

  // Payout is resolved when either Pusher or polling has found the destination txhash
  const payoutResolved = !!(
    (pusherPayoutTxHash && computedPusherPayoutTxHashUrl) ||
    (payoutTxHash && payoutTxHashUrl)
  );

  // Use Pusher hook for real-time status updates
  // Start with Pusher enabled, will switch to polling after 1 minute if no data received
  // Only enable Pusher when showProcessingPayout is true — no need to track payout otherwise
  const { unsubscribe: pusherUnsubscribe } = usePusherPayout({
    enabled: !!showProcessingPayout && pusherEnabled && !!rozoPaymentId,
    rozoPaymentId,
    onDataReceived: () => {
      // Track that we received data from Pusher
      pusherDataReceivedRef.current = true;
      context.log("[CONFIRMATION] Pusher data received");
    },
    onPayoutCompleted: (payload) => {
      context.log("[CONFIRMATION] Pusher payout completed:", payload);
      // If we receive payout completed from Pusher and have the destination txhash,
      // we can use it to update the payout state
      if (payload.destination_txhash && rozoPaymentId) {
        const payoutKey = `${payload.destination_txhash}-${rozoPaymentId}`;
        if (payoutCompletedSent.current !== payoutKey) {
          payoutCompletedSent.current = payoutKey;
          payoutCompletedRef.current = true;

          // Update local state for UI display (URL computed at render time via useMemo)
          setPusherPayoutTxHash(payload.destination_txhash);

          // Update payment state
          setPaymentPayoutCompleted(payload.destination_txhash, rozoPaymentId);
          triggerResize();

          // Unsubscribe from Pusher since payout is completed
          if (pusherUnsubscribeRef.current) {
            context.log("[CONFIRMATION] Payout completed via Pusher, unsubscribing");
            pusherUnsubscribeRef.current();
          }
          pusherEnabledRef.current = false;
          setPusherEnabled(false);

          // Clear timeout since payout is completed
          if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
          }
        }
      }
    },
    log: context.log,
  });

  // Store unsubscribe function in ref
  useEffect(() => {
    pusherUnsubscribeRef.current = pusherUnsubscribe;
  }, [pusherUnsubscribe]);

  // Initialize Pusher timer when Pusher is enabled and rozoPaymentId is available
  // This effect sets up the timeout to switch to polling after 1 minute if no data is received
  useEffect(() => {
    // Only proceed if showProcessingPayout is enabled, we have a payment ID and Pusher is enabled
    if (!showProcessingPayout || !rozoPaymentId || !pusherEnabled) {
      context.log("[CONFIRMATION] Timeout setup skipped:", {
        rozoPaymentId: !!rozoPaymentId,
        pusherEnabled,
      });
      return;
    }

    // Only set timeout once per payment ID
    if (timeoutIdRef.current !== null) {
      context.log("[CONFIRMATION] Timeout already set, skipping", timeoutIdRef.current);
      return;
    }

    // Initialize timer on first Pusher connection
    if (pusherInitializedTimeRef.current === null) {
      pusherInitializedTimeRef.current = Date.now();
      context.log(
        "[CONFIRMATION] Pusher initialized, starting 1-minute timeout at",
        new Date(pusherInitializedTimeRef.current).toISOString(),
      );
    }

    // Set up timeout to switch to polling after 1 minute if payout not completed
    context.log("[CONFIRMATION] Setting up 1-minute timeout");
    timeoutIdRef.current = setTimeout(() => {
      context.log(
        "[CONFIRMATION] Timeout fired at",
        new Date().toISOString(),
        "- checking conditions for polling switch",
      );

      // Switch to polling if payout hasn't been completed and Pusher is still enabled
      // Note: We check payoutCompletedRef, not pusherDataReceivedRef, because we may
      // receive payin data but still need to poll for payout if it doesn't arrive via Pusher
      if (pusherEnabledRef.current && !payoutCompletedRef.current) {
        context.log(
          "[CONFIRMATION] 1 minute elapsed without payout completion, switching to polling",
        );

        // Unsubscribe from Pusher
        if (pusherUnsubscribeRef.current) {
          context.log("[CONFIRMATION] Unsubscribing from Pusher");
          pusherUnsubscribeRef.current();
        }

        // Disable Pusher and enable polling
        pusherEnabledRef.current = false;
        setPusherEnabled(false);
        setPollingEnabled(true);
      } else {
        context.log("[CONFIRMATION] Timeout fired but conditions not met:", {
          pusherEnabled: pusherEnabledRef.current,
          payoutCompleted: payoutCompletedRef.current,
        });
      }
      timeoutIdRef.current = null;
    }, 60000); // 1 minute = 60000ms

    context.log("[CONFIRMATION] Timeout set successfully, will fire in 60 seconds");

    return () => {
      // Clear timeout when dependencies change or component unmounts
      if (timeoutIdRef.current) {
        context.log("[CONFIRMATION] Clearing timeout in cleanup");
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProcessingPayout, rozoPaymentId, pusherEnabled]);

  // Reset tracking when rozoPaymentId changes to a DIFFERENT value (not on initial mount)
  useEffect(() => {
    // Only reset if we're switching to a different payment ID, not on initial mount
    if (prevRozoPaymentIdRef.current && prevRozoPaymentIdRef.current !== rozoPaymentId) {
      context.log("[CONFIRMATION] Resetting tracking for new payment ID");
      pusherInitializedTimeRef.current = null;
      pusherDataReceivedRef.current = false;
      payoutCompletedRef.current = false;
      pusherEnabledRef.current = true;
      setPusherEnabled(true);
      setPollingEnabled(false);
      if (timeoutIdRef.current) {
        context.log("[CONFIRMATION] Clearing existing timeout on payment ID change");
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    }
    // Update the previous value for next comparison
    prevRozoPaymentIdRef.current = rozoPaymentId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rozoPaymentId]);

  /**
   * Sets the payment completed state.
   * Runs once `done` is true — for rozo payments that means the API confirmed
   * the deposit, for other flows that the FSM reached payment_completed.
   */
  useEffect(() => {
    if (done && rawPayInHash && rozoPaymentId) {
      // Only call once per unique payment hash to prevent duplicate state updates
      const paymentKey = `${rawPayInHash}-${rozoPaymentId}`;
      if (paymentCompletedSent.current === paymentKey) {
        return;
      }

      context.log("[CONFIRMATION] Setting payment completed:", {
        rawPayInHash,
        rozoPaymentId,
      });

      paymentCompletedSent.current = paymentKey;

      // Rozo payments only get here after the payin gate above saw the API
      // confirm the deposit; the tx hash was already reported there.
      setPaymentCompleted(rawPayInHash, rozoPaymentId, paymentStateContext.senderAddress ?? null);
      onSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, paymentStateContext, rawPayInHash, rozoPaymentId]);

  /**
   * Payout that is settled by the payin itself, so there is nothing to wait
   * for: stellar_direct with source txHash === destination txHash (known from
   * the order, or from the confirmed API response), and deposit-address flows
   * (which previously marked payout completed on payin detection). Separate
   * from the completion effect so its dedupe cannot swallow this event.
   */
  useEffect(() => {
    if (!done || !rawPayInHash || !rozoPaymentId) return;
    const sameTx = isStellarDirectSameTx || !!payinConfirmed?.sameTxPayout;
    // Deposit-address flow: only when the API already reports the destination
    // tx. Otherwise leave payoutCompletedRef untouched so the normal Pusher /
    // polling payout wait runs — never report the source tx as the payout.
    const depositPayout =
      !!paymentStateContext.selectedDepositAddressOption && !!payinConfirmed?.payoutTxHash;
    if (!sameTx && !depositPayout) return;
    const payoutHash = sameTx ? rawPayInHash : payinConfirmed!.payoutTxHash!;
    const payoutKey = `${payoutHash}-${rozoPaymentId}`;
    if (payoutCompletedSent.current === payoutKey) return;
    payoutCompletedSent.current = payoutKey;
    payoutCompletedRef.current = true;
    setPaymentPayoutCompleted(payoutHash, rozoPaymentId);
    context.log("[CONFIRMATION] payout completed directly:", { sameTx, depositPayout, payoutHash });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, rawPayInHash, rozoPaymentId, isStellarDirectSameTx, payinConfirmed]);

  /**
   * Sets the payout completed state.
   * This is called when the payout is confirmed and the transaction hash is available.
   */
  useEffect(() => {
    if (done && payoutTxHash && rozoPaymentId) {
      // Only call once per unique payout hash to prevent duplicate state updates
      const payoutKey = `${payoutTxHash}-${rozoPaymentId}`;
      if (payoutCompletedSent.current === payoutKey) {
        return;
      }

      context.log("[CONFIRMATION] Setting payout completed:", {
        payoutTxHash,
        rozoPaymentId,
      });

      payoutCompletedSent.current = payoutKey;
      payoutCompletedRef.current = true;
      setPaymentPayoutCompleted(payoutTxHash, rozoPaymentId);

      // Unsubscribe from Pusher since payout is completed via polling
      if (pusherUnsubscribeRef.current && pusherEnabled) {
        context.log("[CONFIRMATION] Payout completed via polling, unsubscribing from Pusher");
        pusherUnsubscribeRef.current();
      }
      pusherEnabledRef.current = false;
      setPusherEnabled(false);

      // Clear timeout since payout is completed
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, payoutTxHash, rozoPaymentId, pusherEnabled]);

  useEffect(() => {
    if (debugMode) {
      context.log(`[ORDER] Order: `, order);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, debugMode]);

  return (
    <PageContent
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ModalContent
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          paddingBottom: 0,
        }}
      >
        <AnimationContainer>
          <InsetContainer>
            {!done && <Spinner $status={false} />}
            {done && showProcessingPayout && !payoutResolved && (
              <Ring width={100} height={100} color="#0052ff" />
            )}
            {done && (!showProcessingPayout || payoutResolved) && <SuccessIcon $status={true} />}
          </InsetContainer>
        </AnimationContainer>

        {!done ? (
          <>
            <ModalH1>{payinWaitTimedOut ? "Still waiting for confirmation" : "Confirming..."}</ModalH1>
            {(pendingTxURL || paymentStateContext.txHash) && (
              <ListContainer>
                <ListItem>
                  <ModalBody>Transfer Hash</ModalBody>
                  <ModalBody>
                    {pendingTxURL ? (
                      <Link
                        href={pendingTxURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 14, fontWeight: 400 }}
                      >
                        {getAddressContraction(paymentStateContext.txHash ?? "")}
                        <ExternalIcon />
                      </Link>
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 400 }}>
                        {getAddressContraction(paymentStateContext.txHash ?? "")}
                      </span>
                    )}
                  </ModalBody>
                </ListItem>
                <ModalBody style={{ marginTop: 8, fontSize: 14 }}>
                  {payinWaitTimedOut
                    ? "We have not seen this transfer confirmed yet. If your wallet shows it as sent, check the receipt later or contact support with the hash above."
                    : "Waiting for the network to confirm your transfer."}
                </ModalBody>
              </ListContainer>
            )}
          </>
        ) : (
          <>
            <ModalH1
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                flexDirection: "column",
              }}
            >
              {showProcessingPayout && !payoutResolved ? "Payment Confirmed" : "Payment Completed"}
            </ModalH1>

            {(txURL || rawPayInHash) && (
              <ListContainer>
                <ListItem>
                  <ModalBody>Transfer Hash</ModalBody>
                  <ModalBody>
                    {txURL ? (
                      <Link
                        href={txURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 14, fontWeight: 400 }}
                      >
                        {getAddressContraction(rawPayInHash)}
                        <ExternalIcon />
                      </Link>
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 400 }}>
                        {getAddressContraction(rawPayInHash)}
                      </span>
                    )}
                  </ModalBody>
                </ListItem>

                {showProcessingPayout && (
                  <ListItem>
                    <ModalBody>Receiver Hash</ModalBody>
                    <ModalBody>
                      {payoutLoading ? (
                        <LoadingText>Processing payout...</LoadingText>
                      ) : (computedPusherPayoutTxHashUrl && pusherPayoutTxHash) ||
                        (payoutTxHashUrl && payoutTxHash) ? (
                        <Link
                          href={computedPusherPayoutTxHashUrl || payoutTxHashUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 14, fontWeight: 400 }}
                        >
                          {getAddressContraction(pusherPayoutTxHash || payoutTxHash || "")}
                          <ExternalIcon />
                        </Link>
                      ) : (
                        <LoadingText>Processing payout...</LoadingText>
                      )}
                    </ModalBody>
                  </ListItem>
                )}
              </ListContainer>
            )}

            {confirmationMessage && <ModalBody>{confirmationMessage}</ModalBody>}
          </>
        )}

        {(done || payinWaitTimedOut) && generateReceiptUrl && (
          <Button iconPosition="right" href={generateReceiptUrl} style={{ width: "100%" }}>
            See Receipt
          </Button>
        )}
        <PoweredByFooter
          showSupport
          preFilledMessage={`Transaction: ${txURL ?? pendingTxURL}`}
        />
      </ModalContent>
    </PageContent>
  );
};

const AnimationContainer = styled(motion.div)`
  position: relative;
  width: 100px;
  height: 100px;
  transition: transform 0.5s ease-in-out;
  margin-bottom: 16px;
`;

const InsetContainer = styled(motion.div)`
  position: absolute;
  overflow: hidden;
  inset: 0;
  border-radius: 50px;
  // background: var(--ck-body-background);
  display: flex;
  align-items: center;
  justify-content: center;
  svg {
    position: absolute;
    width: 100%;
    height: 100%;
  }
`;

const SuccessIcon = styled(BadgeCheckIcon)<{ $status: boolean }>`
  transition: all 0.2s ease-in-out;
  position: absolute;
  opacity: ${(props) => (props.$status ? 1 : 0)};
  transform: ${(props) => (props.$status ? "scale(1)" : "scale(0.5)")};
  fill: #0052ff;
  stroke: #ffffff;
`;

const Spinner = styled(LoadingCircleIcon)<{ $status: boolean }>`
  position: absolute;
  transition: all 0.2s ease-in-out;
  animation: rotateSpinner 400ms linear infinite;
  opacity: ${(props) => (props.$status ? 0 : 1)};
  color: var(--ck-body-action-color);

  @keyframes rotateSpinner {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  gap: 4px;
  margin-top: 16px;

  @media only screen and (max-width: ${defaultTheme.mobileWidth}px) {
    & ${ModalBody} {
      margin: 0 !important;
      max-width: 100% !important;
      text-align: left !important;
    }
  }
`;

const ListItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 320px;
  gap: 5rem;
  padding: 8px 0;

  @media only screen and (max-width: ${defaultTheme.mobileWidth}px) {
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
    max-width: 100%;
  }
`;

const ExternalIcon = styled(ExternalLinkIcon)`
  width: 14px;
  height: 14px;
  transition: opacity 0.2s ease;
  color: var(--ck-body-action-color);

  &:hover {
    opacity: 1;
    cursor: pointer;
  }
`;

const PlaceholderText = styled.span`
  font-size: 14px;
  font-weight: 400;
  color: var(--ck-body-color-muted);
  opacity: 0.6;
  font-style: italic;

  @media only screen and (max-width: ${defaultTheme.mobileWidth}px) {
    font-size: 13px;
  }
`;

const LoadingText = styled.span`
  font-size: 14px;
  font-weight: 400;
  font-style: italic;
  color: transparent;
  background: linear-gradient(90deg, #333, #999, #fff, #999, #333);
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  animation: shine 10s ease-in-out infinite;

  @keyframes shine {
    0% {
      background-position: -300% 0;
    }
    50% {
      background-position: 300% 0;
    }
    100% {
      background-position: -300% 0;
    }
  }
`;

export default Confirmation;
