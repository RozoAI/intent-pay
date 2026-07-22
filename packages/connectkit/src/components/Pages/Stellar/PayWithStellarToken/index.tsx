import React, { useEffect, useMemo, useRef, useState } from "react";
import { ROUTES } from "../../../../constants/routes";
import { usePayContext } from "../../../../hooks/usePayContext";

import {
  Link,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../../Common/Modal/styles";

import {
  buildCheckoutPayload,
  checkoutPayment,
  FeeResponseData,
  FeeType,
  formatPaymentResponseToHydratedOrder,
  getCanonicalDestination,
  getChainExplorerTxUrl,
  getPayment,
  RozoPayHydratedOrderWithOrg,
  rozoStellar,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import {
  FeeBumpTransaction,
  Networks,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { useContactSupport } from "../../../../hooks/useContactSupport";
import { useRozoPay } from "../../../../hooks/useRozoPay";
import { ROZO_EVENTS } from "../../../../lib/analytics/events";
import { useAnalytics } from "../../../../provider/AnalyticsProvider";
import { useStellar } from "../../../../provider/StellarContextProvider";
import { getCachedFee, resolveOrderAppId } from "../../../../utils/feeCache";
import Button from "../../../Common/Button";
import PaymentBreakdown from "../../../Common/PaymentBreakdown";
import TokenLogoSpinner from "../../../Spinners/TokenLogoSpinner";

enum PayState {
  PreparingTransaction = "Preparing Transaction",
  RequestingPayment = "Waiting for Payment",
  WaitingForConfirmation = "Waiting for Confirmation",
  ProcessingPayment = "Processing Payment",
  RequestCancelled = "Payment Cancelled",
  RequestFailed = "Payment Failed",
  RequestSuccessful = "Payment Successful",
}

const PayWithStellarToken: React.FC = () => {
  const { triggerResize, paymentState, setRoute, log } = usePayContext();
  const {
    selectedStellarTokenOption,
    payWithStellarToken,
    setTxHash,
    payParams,
    rozoPaymentId,
    setRozoPaymentId,
    createPayment,
    stellarPaymentOptions,
  } = paymentState;
  const {
    store,
    order,
    paymentState: state,
    setPaymentStarted,
    setPaymentUnpaid,
    setPaymentCompleted,
    hydrateOrder,
  } = useRozoPay();
  const handleContactClick = useContactSupport();

  // Get the destination address and payment direction using our custom hook
  const {
    server: stellarServer,
    publicKey: stellarPublicKey,
    kit: stellarKit,
  } = useStellar();
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  // Prevents the payId fetch+checkout from firing more than once per mount.
  const checkoutDoneRef = useRef(false);
  const cachedCheckoutOrderRef = useRef<RozoPayHydratedOrderWithOrg | null>(
    null,
  );
  const cachedCheckoutPaymentIdRef = useRef<string | undefined>(undefined);

  const { capture } = useAnalytics();
  const [payState, setPayState] = useState<PayState>(
    PayState.PreparingTransaction,
  );
  const [txURL, setTxURL] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [signedTx, setSignedTx] = useState<string | undefined>();
  const [feeData, setFeeData] = useState<FeeResponseData | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);

  // useEffect(() => {
  //   if (!selectedStellarTokenOption || !order) return;

  //   const destToken = order.destFinalCallTokenAmount?.token;
  //   if (!destToken) return;

  //   setFeeLoading(true);
  //   getCachedFee({
  //     appId: payParams?.appId,
  //     type: payParams?.feeType ?? FeeType.ExactIn,
  //     sourceChainId:
  //       selectedStellarTokenOption.balance.token.chainId.toString(),
  //     sourceTokenSymbol: selectedStellarTokenOption.balance.token.symbol,
  //     amount: selectedStellarTokenOption.required.usd.toString(),
  //     destChainId: destToken.chainId.toString(),
  //     destReceiverAddress:
  //       getCanonicalDestination(order).finalDestinationAddress ??
  //       payParams?.toStellarAddress ??
  //       payParams?.toAddress ??
  //       "",
  //     destTokenSymbol: destToken.symbol,
  //   })
  //     .then((res) => {
  //       setFeeData(res.data);
  //     })
  //     .finally(() => {
  //       setFeeLoading(false);
  //     });
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [selectedStellarTokenOption?.balance.token.chainId, order?.id]);

  const destinationAddress = useMemo(() => {
    return (
      payParams?.toStellarAddress ||
      payParams?.toSolanaAddress ||
      payParams?.toAddress ||
      undefined
    );
  }, [
    payParams?.toStellarAddress,
    payParams?.toSolanaAddress,
    payParams?.toAddress,
  ]);

  useEffect(() => {
    if (state === "error") {
      setRoute(ROUTES.ERROR);
      return;
    }
  }, [state]);

  // FOR TRANSFER ACTION
  const handleTransfer = async (option: WalletPaymentOption) => {
    setIsLoading(true);
    capture(ROZO_EVENTS.PAYMENT_CONFIRMED, {
      payment_id: rozoPaymentId ?? order?.externalId,
      source_chain: option.required.token.chainId,
      token_symbol: option.required.token.symbol,
      amount:
        option.required.usd != null ? String(option.required.usd) : undefined,
    });
    // Hoist so the catch block can reference the payment ID resolved in this
    // attempt, instead of the stale React state value captured in the closure.
    let resolvedPaymentId: string | undefined;
    try {
      // Validate we have current payParams - if not, check if we're in payId mode
      // (pre-created payment). If neither, component has stale state.
      if (!payParams && !order?.externalId) {
        log?.(
          "[PayWithStellarToken] No payParams or payId available, skipping transfer",
        );
        setIsLoading(false);
        return;
      }

      if (!destinationAddress && !order?.externalId) {
        throw new Error("Stellar destination address is required");
      }

      log?.("[PayWithStellarToken] Starting transfer with:", {
        destinationAddress,
        chainId: payParams?.toChain,
        toStellarAddress: payParams?.toStellarAddress,
      });

      // Read the freshest order straight from the store instead of the React
      // closure snapshot. For payId mode this is the getPayment-derived order
      // loaded by runSetPayIdEffects, so getFee/checkout below run against the
      // latest payment response (correct appId, amount, destination, etc.).
      const currentState = store.getState();
      const currentOrder =
        currentState.type !== "idle" ? currentState.order : undefined;
      if (!currentOrder) {
        throw new Error("Order not initialized");
      }

      const { required } = option;

      const needRozoPayment =
        currentOrder.preferredChainId !== null &&
        currentOrder.preferredChainId !== required.token.chainId;

      let hydratedOrder: RozoPayHydratedOrderWithOrg;
      let paymentId: string | undefined;
      let settlementMode: string | undefined;

      // When payId is used (no payParams), fetch the existing payment instead
      // of creating a new one to avoid re-creating a payment that already exists.
      const existingPayId = currentOrder.externalId ?? undefined;
      const isPayIdMode = !payParams && !!existingPayId;

      // @NOTE: Fee calculation
      const destToken = currentOrder.destFinalCallTokenAmount?.token;
      setFeeLoading(true);
      const feeData = await getCachedFee({
        appId: resolveOrderAppId(currentOrder, paymentState.payParams?.appId),
        type: paymentState.payParams?.feeType ?? FeeType.ExactIn,
        sourceChainId: option.required.token.chainId.toString(),
        sourceTokenSymbol: option.required.token.symbol,
        amount: option.required.usd.toString(),
        destChainId: destToken.chainId.toString(),
        destReceiverAddress:
          getCanonicalDestination(currentOrder).finalDestinationAddress ??
          paymentState.payParams?.toAddress ??
          "",
        destTokenSymbol: destToken.symbol,
      });
      setFeeLoading(false);

      if (feeData.error) {
        capture(ROZO_EVENTS.PAYMENT_FAILED, {
          payment_id: rozoPaymentId ?? order?.externalId,
          error_message: feeData.error.message,
          source_chain: option.required.token.chainId,
          source_token: option.required.token.symbol,
          dest_chain: destToken.chainId,
          dest_token: destToken.symbol,
        });
        console.error("Fee calculation failed", feeData.error);
        setRoute(ROUTES.ERROR, { error: feeData.error.message });
        return;
      }

      setFeeData(feeData.data);

      if (isPayIdMode) {
        // payId mode: checkout (refresh) the payment with the selected source token.
        // Guard against duplicate calls (e.g. from the recursive payment_unpaid branch).
        if (checkoutDoneRef.current && cachedCheckoutOrderRef.current) {
          log?.(
            "[PayWithStellarToken] isPayIdMode checkout already done, reusing cached result",
          );
          hydratedOrder = cachedCheckoutOrderRef.current;
          paymentId = cachedCheckoutPaymentIdRef.current;
        } else {
          checkoutDoneRef.current = true;
          const paymentRes = await getPayment(existingPayId!);
          if (!paymentRes?.data) {
            throw new Error("Failed to fetch payment");
          }
          const checkoutRes = await checkoutPayment(
            existingPayId!,
            buildCheckoutPayload(paymentRes.data, {
              chainId: option.required.token.chainId,
              tokenSymbol: option.required.token.symbol,
              tokenAddress: option.required.token.token,
              amount: String(option.required.usd),
            }),
          );
          if (!checkoutRes?.data) {
            throw new Error("Failed to checkout payment");
          }
          paymentId = checkoutRes.data.id;
          settlementMode = checkoutRes.data.settlementMode;
          hydratedOrder = formatPaymentResponseToHydratedOrder(
            checkoutRes.data,
          );
          cachedCheckoutOrderRef.current = hydratedOrder;
          cachedCheckoutPaymentIdRef.current = paymentId;
        }
      } else if (
        (state === "payment_unpaid" || state === "payment_started") &&
        !needRozoPayment
      ) {
        hydratedOrder = currentOrder as RozoPayHydratedOrderWithOrg;
      } else if (needRozoPayment) {
        const existingId = rozoPaymentId ?? currentOrder.externalId ?? undefined;
        if (existingId) {
          const paymentRes = await getPayment(existingId);
          if (!paymentRes?.data) {
            throw new Error("Failed to fetch payment");
          }
          const checkoutRes = await checkoutPayment(
            existingId,
            buildCheckoutPayload(paymentRes.data, {
              chainId: option.required.token.chainId,
              tokenSymbol: option.required.token.symbol,
              tokenAddress: option.required.token.token,
              amount: String(option.required.usd),
            }),
          );
          if (!checkoutRes?.data) {
            throw new Error("Failed to checkout payment");
          }
          paymentId = checkoutRes.data.id;
          settlementMode = checkoutRes.data.settlementMode;
          hydratedOrder = formatPaymentResponseToHydratedOrder(
            checkoutRes.data,
          );
        } else {
          const res = await createPayment(
            {
              ...option,
              fees: {
                ...option.fees,
                usd:
                  feeData.data?.source.fee != null
                    ? Number(feeData.data.source.fee)
                    : option.fees.usd,
              },
            },
            store as any,
          );
          if (!res) {
            throw new Error("Failed to create Rozo payment");
          }
          paymentId = res.id;
          settlementMode = res.settlementMode;
          hydratedOrder = formatPaymentResponseToHydratedOrder(res);
        }
      } else {
        // Hydrate existing order
        const res = await hydrateOrder(undefined, {
          ...option,
          fees: {
            ...option.fees,
            usd:
              feeData.data?.source.fee != null
                ? Number(feeData.data.source.fee)
                : option.fees.usd,
          },
        });
        hydratedOrder = res.order;
      }

      if (!hydratedOrder) {
        throw new Error("Payment not found");
      }

      const newId = paymentId ?? hydratedOrder.externalId ?? undefined;
      resolvedPaymentId = newId;

      if (newId) {
        setRozoPaymentId(newId);

        // Handle payment state transitions
        // Get the ACTUAL current state from the store, not the stale React state
        const currentState = store.getState().type;

        if (currentState === "payment_started" && paymentId) {
          // A new payment was created while in payment_started state (cross-chain switch)
          // First transition back to payment_unpaid, then to payment_started with new order
          const oldPaymentId = order?.externalId;
          if (oldPaymentId) {
            try {
              await setPaymentUnpaid(oldPaymentId);
              await setPaymentStarted(String(newId), hydratedOrder);
            } catch (e) {
              // State might have changed during async operations
              console.warn(
                "[PayWithStellarToken] State transition failed, attempting direct start:",
                e,
              );
              // Try to set started directly if state is already unpaid
              try {
                await setPaymentStarted(String(newId), hydratedOrder);
              } catch (e2) {
                console.error(
                  "[PayWithStellarToken] Could not start payment:",
                  e2,
                );
                throw e2;
              }
            }
          } else {
            await setPaymentStarted(String(newId), hydratedOrder);
          }
        } else if (currentState !== "payment_started") {
          // State is not payment_started (preview, unhydrated, or payment_unpaid)
          // Only transition to payment_started if we're in payment_unpaid
          const stateBeforeTransition = store.getState().type;
          if (stateBeforeTransition === "payment_unpaid") {
            try {
              await setPaymentStarted(String(newId), hydratedOrder);
              await handleTransfer(option);
              return;
            } catch (e) {
              console.error(
                "[PayWithStellarToken] Could not start payment:",
                e,
              );
              throw e;
            }
          } else if (stateBeforeTransition === "preview") {
            // Transition from preview -> payment_unpaid -> payment_started
            await setPaymentUnpaid(String(newId), hydratedOrder);
            await setPaymentStarted(String(newId), hydratedOrder);
          } else {
            log?.(
              `[PayWithStellarToken] Skipping setPaymentStarted - state is ${stateBeforeTransition}, needs to be payment_unpaid`,
            );
          }
        }
      }

      setPayState(PayState.RequestingPayment);

      // Double-check destination address matches the payment direction
      const finalDestAddress = hydratedOrder.intentAddr || destinationAddress;

      if (!finalDestAddress) {
        throw new Error("Destination address not found");
      }

      log?.(
        `[PayWithStellarToken] Payment setup - destAddress: ${finalDestAddress}, toChain: ${payParams?.toChain}, token chain: ${option.required.token.chainId}`,
      );

      // For stellar_direct: source IS the destination. Use source address/amount/memo directly.
      // The hydratedOrder's intentAddr already points to the source (deposit) address,
      // and fee is "0.00", so we just pass through.
      const paymentData = {
        destAddress: finalDestAddress,
      };

      if (hydratedOrder.memo) {
        Object.assign(paymentData, {
          memo: hydratedOrder.memo,
        });
      }

      log?.(
        `[PayWithStellarToken] settlementMode: ${settlementMode ?? "none"}, destAddress: ${finalDestAddress}, memo: ${hydratedOrder.memo ?? "none"}`,
      );

      const result = await payWithStellarToken(
        {
          ...option,
          fees: {
            ...option.fees,
            usd:
              feeData.data?.source.fee != null
                ? Number(feeData.data.source.fee)
                : option.fees.usd,
          },
        },
        paymentData,
      );
      setSignedTx(result.signedTx);
      setPayState(PayState.WaitingForConfirmation);
    } catch (error) {
      console.error("[PayWithStellarToken] Error:", error);

      // Use `resolvedPaymentId` (the ID from this attempt) rather than
      // the stale `rozoPaymentId` from the React state closure.
      const paymentIdToReset = resolvedPaymentId ?? rozoPaymentId;
      if (paymentIdToReset) {
        try {
          await setPaymentUnpaid(paymentIdToReset);
        } catch (e) {
          console.error("Failed to set payment unpaid:", e);
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isRejected = errorMessage.includes("rejected");
      capture(ROZO_EVENTS.PAYMENT_FAILED, {
        payment_id: resolvedPaymentId ?? rozoPaymentId,
        error_message: isRejected
          ? "user_rejected"
          : (errorMessage ?? "unknown_error"),
        source_chain: rozoStellar.chainId,
      });
      if (isRejected) {
        // User rejected in-wallet before signing — keep them in-modal with a
        // Retry affordance instead of the full Error page.
        setPayState(PayState.RequestCancelled);
      } else {
        // Pre-submit failure (setup/network/checkout). Route to the dedicated
        // Error page for proper categorization + retry/support.
        setRoute(ROUTES.ERROR, { error: errorMessage });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitTx = async () => {
    if (signedTx && stellarServer && stellarKit) {
      try {
        // Sign and submit transaction
        const signedTransaction = await stellarKit.signTransaction(signedTx, {
          address: stellarPublicKey,
          networkPassphrase: Networks.PUBLIC,
        });

        setIsLoading(true);
        setPayState(PayState.ProcessingPayment);

        const tx = TransactionBuilder.fromXDR(
          signedTransaction.signedTxXdr,
          Networks.PUBLIC,
        );

        const response = await stellarServer.submitTransaction(
          tx as Transaction | FeeBumpTransaction,
        );

        if (response.successful) {
          capture(ROZO_EVENTS.PAYMENT_SUBMITTED, {
            payment_id: rozoPaymentId,
            tx_hash: response.hash,
            source_chain: rozoStellar.chainId,
            token_symbol: selectedStellarTokenOption?.required.token.symbol,
          });
          try {
            sessionStorage.setItem(
              `rozo_submitted_at:${rozoPaymentId}`,
              String(Date.now()),
            );
          } catch {}
          setPayState(PayState.RequestSuccessful);
          setTxHash(response.hash);
          setTxURL(getChainExplorerTxUrl(rozoStellar.chainId, response.hash));
          setTimeout(() => {
            setSignedTx(undefined);
            setPaymentCompleted(
              response.hash,
              rozoPaymentId,
              stellarPublicKey ?? null,
            );
            setRoute(ROUTES.CONFIRMATION, { event: "wait-pay-with-stellar" });
          }, 200);
          setTimeout(() => {
            stellarPaymentOptions.refreshOptions();
          }, 1000);
        } else {
          capture(ROZO_EVENTS.PAYMENT_FAILED, {
            payment_id: rozoPaymentId,
            error_message: "payment_unsuccessful",
            source_chain: rozoStellar.chainId,
          });
          setPayState(PayState.RequestFailed);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const isRejected = errorMessage.includes("rejected");
        capture(ROZO_EVENTS.PAYMENT_FAILED, {
          payment_id: rozoPaymentId,
          error_message: isRejected
            ? "user_rejected"
            : (errorMessage ?? "unknown_error"),
          source_chain: rozoStellar.chainId,
        });
        if (isRejected) {
          setPayState(PayState.RequestCancelled);
        } else {
          setPayState(PayState.RequestFailed);
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      log?.("[PAY STELLAR] Cannot submit transaction - missing requirements");
    }
  };

  useEffect(() => {
    if (signedTx) {
      submitButtonRef.current?.click();
    }
  }, [signedTx]);

  useEffect(() => {
    if (!selectedStellarTokenOption) return;

    // Give user time to see the UI before opening
    const transferTimeout = setTimeout(
      () => handleTransfer(selectedStellarTokenOption),
      100,
    );
    return () => clearTimeout(transferTimeout);
  }, [selectedStellarTokenOption]);

  useEffect(() => {
    triggerResize();
  }, [payState]);

  if (selectedStellarTokenOption == null) {
    return <PageContent></PageContent>;
  }

  return (
    <PageContent>
      <button
        ref={submitButtonRef}
        style={{ display: "none" }}
        onClick={handleSubmitTx}
      />
      {selectedStellarTokenOption && (
        <TokenLogoSpinner
          token={selectedStellarTokenOption.required.token}
          loading={isLoading}
        />
      )}
      <ModalContent style={{ paddingBottom: 0 }}>
        {txURL ? (
          <ModalH1>
            <Link href={txURL} target="_blank" rel="noopener noreferrer">
              {payState}
            </Link>
          </ModalH1>
        ) : (
          <ModalH1>{payState}</ModalH1>
        )}
        <PaymentBreakdown
          paymentOption={{
            ...selectedStellarTokenOption,
            fees: {
              ...selectedStellarTokenOption.fees,
              usd:
                feeData?.source.fee != null
                  ? Number(feeData.source.fee)
                  : selectedStellarTokenOption.fees.usd,
            },
          }}
          feeData={feeData}
          feeLoading={feeLoading}
        />
        {payState === PayState.WaitingForConfirmation && signedTx && (
          <Button variant="primary" onClick={handleSubmitTx}>
            Confirm Payment
          </Button>
        )}
        {payState === PayState.RequestCancelled && (
          <Button
            onClick={
              signedTx
                ? handleSubmitTx
                : () => handleTransfer(selectedStellarTokenOption)
            }
          >
            Retry Payment
          </Button>
        )}
        {payState === PayState.RequestFailed && (
          <>
            <Button
              onClick={
                signedTx
                  ? handleSubmitTx
                  : () => handleTransfer(selectedStellarTokenOption)
              }
            >
              Retry Payment
            </Button>
            <Button onClick={handleContactClick}>Contact Support</Button>
          </>
        )}
      </ModalContent>
    </PageContent>
  );
};

export default PayWithStellarToken;
