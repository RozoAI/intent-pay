import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePayContext } from "../../../hooks/usePayContext";

import {
  Link,
  ModalBody,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../Common/Modal/styles";

import {
  assert,
  getAddressContraction,
  getChainExplorerTxUrl,
  getOrderDestChainId,
  rozoSolana,
  rozoStellar,
  updatePaymentPayInTxHash,
} from "@rozoai/intent-common";
import { motion } from "framer-motion";
import {
  BadgeCheckIcon,
  ExternalLinkIcon,
  LoadingCircleIcon,
} from "../../../assets/icons";
import defaultTheme from "../../../constants/defaultTheme";
import { ROZO_INVOICE_URL } from "../../../constants/rozoConfig";
import { useRozoPay } from "../../../hooks/useDaimoPay";
import { usePayoutPolling } from "../../../hooks/usePayoutPolling";
import { usePusherPayout } from "../../../hooks/usePusherPayout";
import { useSupportedChains } from "../../../hooks/useSupportedChains";
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
  const {
    order,
    paymentState,
    setPaymentCompleted,
    setPaymentPayoutCompleted,
  } = useRozoPay();

  const [isConfirming, setIsConfirming] = useState<boolean>(true);

  // Track if completion events have been sent to prevent duplicate calls
  const paymentCompletedSent = useRef<string | null>(null);
  const payoutCompletedSent = useRef<string | null>(null);

  // Local state for Pusher payout transaction hash
  const [pusherPayoutTxHash, setPusherPayoutTxHash] = useState<
    string | undefined
  >(undefined);
  const [pusherPayoutTxHashUrl, setPusherPayoutTxHashUrl] = useState<
    string | undefined
  >(undefined);

  // Track Pusher initialization and data activity for timeout logic
  const [pusherEnabled, setPusherEnabled] = useState<boolean>(true);
  const [pollingEnabled, setPollingEnabled] = useState<boolean>(false);
  const pusherInitializedTimeRef = useRef<number | null>(null);
  const pusherDataReceivedRef = useRef<boolean>(false);
  const pusherUnsubscribeRef = useRef<(() => void) | null>(null);
  const payoutCompletedRef = useRef<boolean>(false);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const pusherEnabledRef = useRef<boolean>(true);

  const showProcessingPayout = useMemo(() => {
    const { payParams, tokenMode } = paymentStateContext;

    if (
      payParams &&
      (tokenMode === "stellar" || tokenMode === "solana" || tokenMode === "evm")
    ) {
      return payParams.showProcessingPayout;
    }

    return false;
  }, [paymentStateContext]);

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

  const { tokens: supportedTokens } = useSupportedChains();

  const { done, txURL, rawPayInHash } = useMemo(() => {
    const { tokenMode, txHash } = paymentStateContext;

    const isRozoPayment =
      tokenMode === "stellar" ||
      tokenMode === "solana" ||
      (["evm", "all"].includes(tokenMode) &&
        order &&
        supportedTokens.some(
          (token) => token.token === order.destFinalCallTokenAmount?.token.token
        ));

    if (isRozoPayment && txHash) {
      // Add delay before setting payment completed to show confirming state
      if (isConfirming) {
        // setTimeout(() => {
        setPaymentCompleted(txHash, rozoPaymentId);
        setIsConfirming(false);
        // }, 300);
        return { done: false, txURL: undefined };
      }

      // Determine chain ID based on token mode
      let chainId: number;
      if (tokenMode === "stellar") {
        chainId = rozoStellar.chainId;
      } else if (tokenMode === "solana") {
        chainId = rozoSolana.chainId;
      } else {
        chainId = Number(
          paymentStateContext.selectedTokenOption?.required.token.chainId
        );
      }

      const txURL = getChainExplorerTxUrl(chainId, txHash);
      return { done: true, txURL, rawPayInHash: txHash };
    } else {
      if (
        paymentState === "payment_completed" ||
        paymentState === "payment_bounced"
      ) {
        const txHash = order.destFastFinishTxHash ?? order.destClaimTxHash;
        const destChainId = getOrderDestChainId(order);
        assert(
          txHash != null,
          `[CONFIRMATION] paymentState: ${paymentState}, but missing txHash`
        );
        const txURL = getChainExplorerTxUrl(destChainId, txHash);

        return { done: true, txURL, rawPayInHash: txHash };
      }
    }

    return { done: false, txURL: undefined, rawPayInHash: undefined };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paymentState,
    order,
    paymentStateContext,
    isConfirming,
    rozoPaymentId,
    supportedTokens,
  ]);

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

  // Use Pusher hook for real-time status updates
  // Start with Pusher enabled, will switch to polling after 1 minute if no data received
  const { unsubscribe: pusherUnsubscribe } = usePusherPayout({
    enabled: pusherEnabled && !!rozoPaymentId,
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

          // Update local state for UI display
          setPusherPayoutTxHash(payload.destination_txhash);

          // Generate transaction URL if we have the order
          if (order) {
            const destChainId = getOrderDestChainId(order);
            const txUrl = getChainExplorerTxUrl(
              destChainId,
              payload.destination_txhash
            );
            setPusherPayoutTxHashUrl(txUrl);
          }

          // Update payment state
          setPaymentPayoutCompleted(payload.destination_txhash, rozoPaymentId);
          triggerResize();

          // Unsubscribe from Pusher since payout is completed
          if (pusherUnsubscribeRef.current) {
            context.log(
              "[CONFIRMATION] Payout completed via Pusher, unsubscribing"
            );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Pusher timer when Pusher is enabled and rozoPaymentId is available
  // This effect sets up the timeout to switch to polling after 1 minute if no data is received
  useEffect(() => {
    // Only proceed if we have a payment ID and Pusher is enabled
    if (!rozoPaymentId || !pusherEnabled) {
      context.log("[CONFIRMATION] Timeout setup skipped:", {
        rozoPaymentId: !!rozoPaymentId,
        pusherEnabled,
      });
      return;
    }

    // Only set timeout once per payment ID
    if (timeoutIdRef.current !== null) {
      context.log(
        "[CONFIRMATION] Timeout already set, skipping",
        timeoutIdRef.current
      );
      return;
    }

    // Initialize timer on first Pusher connection
    if (pusherInitializedTimeRef.current === null) {
      pusherInitializedTimeRef.current = Date.now();
      context.log(
        "[CONFIRMATION] Pusher initialized, starting 1-minute timeout at",
        new Date(pusherInitializedTimeRef.current).toISOString()
      );
    }

    // Set up timeout to switch to polling after 1 minute if no data received
    context.log("[CONFIRMATION] Setting up 1-minute timeout");
    timeoutIdRef.current = setTimeout(() => {
      context.log(
        "[CONFIRMATION] Timeout fired at",
        new Date().toISOString(),
        "- checking conditions for polling switch"
      );

      // Only switch to polling if payout hasn't been completed and Pusher is still enabled
      if (
        !pusherDataReceivedRef.current &&
        pusherEnabledRef.current &&
        !payoutCompletedRef.current
      ) {
        context.log(
          "[CONFIRMATION] 1 minute elapsed with no Pusher data, switching to polling"
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
          pusherDataReceived: pusherDataReceivedRef.current,
          pusherEnabled: pusherEnabledRef.current,
          payoutCompleted: payoutCompletedRef.current,
        });
      }
      timeoutIdRef.current = null;
    }, 60000); // 1 minute = 60000ms

    context.log(
      "[CONFIRMATION] Timeout set successfully, will fire in 60 seconds"
    );

    return () => {
      // Clear timeout when dependencies change or component unmounts
      if (timeoutIdRef.current) {
        context.log("[CONFIRMATION] Clearing timeout in cleanup");
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rozoPaymentId, pusherEnabled]);

  // Reset tracking when rozoPaymentId changes
  useEffect(() => {
    context.log("[CONFIRMATION] Resetting tracking for new payment ID");
    pusherInitializedTimeRef.current = null;
    pusherDataReceivedRef.current = false;
    payoutCompletedRef.current = false;
    pusherEnabledRef.current = true;
    setPusherEnabled(true);
    setPollingEnabled(false);
    if (timeoutIdRef.current) {
      context.log(
        "[CONFIRMATION] Clearing existing timeout on payment ID change"
      );
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rozoPaymentId]);

  /**
   * Sets the payment completed state.
   * This is called when the payment is confirmed and the transaction hash is available.
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

      // Update payment pay-in transaction hash on the server
      updatePaymentPayInTxHash(rozoPaymentId, rawPayInHash, "v2").catch(
        (error) => {
          context.log(
            "[CONFIRMATION] Failed to update payment pay-in tx hash:",
            error
          );
        }
      );

      setPaymentCompleted(rawPayInHash, rozoPaymentId);
      onSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, paymentStateContext, rawPayInHash, rozoPaymentId]);

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
        context.log(
          "[CONFIRMATION] Payout completed via polling, unsubscribing from Pusher"
        );
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
            {!done && <Spinner $status={done} />}
            {done && <SuccessIcon $status={done} />}
          </InsetContainer>
        </AnimationContainer>

        {!done ? (
          <ModalH1>Confirming...</ModalH1>
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
              Payment Completed
            </ModalH1>

            {txURL && (
              <ListContainer>
                <ListItem>
                  <ModalBody>Transfer Hash</ModalBody>
                  <ModalBody>
                    <Link
                      href={txURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 14, fontWeight: 400 }}
                    >
                      {getAddressContraction(rawPayInHash)}
                      <ExternalIcon />
                    </Link>
                  </ModalBody>
                </ListItem>

                {showProcessingPayout && (
                  <ListItem>
                    <ModalBody>Receiver Hash</ModalBody>
                    <ModalBody>
                      {payoutLoading ? (
                        <LoadingText>Processing payout...</LoadingText>
                      ) : (pusherPayoutTxHashUrl && pusherPayoutTxHash) ||
                        (payoutTxHashUrl && payoutTxHash) ? (
                        <Link
                          href={pusherPayoutTxHashUrl || payoutTxHashUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 14, fontWeight: 400 }}
                        >
                          {getAddressContraction(
                            pusherPayoutTxHash || payoutTxHash || ""
                          )}
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

            {confirmationMessage && (
              <ModalBody>{confirmationMessage}</ModalBody>
            )}
          </>
        )}

        {done && generateReceiptUrl && (
          <Button
            iconPosition="right"
            href={generateReceiptUrl}
            style={{ width: "100%" }}
          >
            See Receipt
          </Button>
        )}
        <PoweredByFooter
          showSupport={!done}
          preFilledMessage={`Transaction: ${txURL}`}
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
