import React, { useCallback, useEffect, useState } from "react";
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
  PaymentResponse,
  RozoPayHydratedOrderWithOrg,
  rozoSolana,
  solana,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { isNativeToken } from "../../../../utils/token";
import { useContactSupport } from "../../../../hooks/useContactSupport";
import { useRozoPay } from "../../../../hooks/useRozoPay";
import { ROZO_EVENTS } from "../../../../lib/analytics/events";
import { useAnalytics } from "../../../../provider/AnalyticsProvider";
import { getCachedFee, resolveOrderAppId } from "../../../../utils/feeCache";
import { tokenBaseAmountToDecimalString } from "../../../../utils/format";
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

const PayWithSolanaToken: React.FC = () => {
  const { triggerResize, paymentState, setRoute, log } = usePayContext();
  const {
    selectedSolanaTokenOption,
    payWithSolanaTokenRozo,
    payParams,
    rozoPaymentId,
    setRozoPaymentId,
    setTxHash,
    createPayment,
    solanaPaymentOptions,
    solanaPubKey,
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

  const { capture } = useAnalytics();
  const [payState, setPayStateInner] = useState<PayState>(
    PayState.PreparingTransaction,
  );
  const [txURL, setTxURL] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [feeData, setFeeData] = useState<FeeResponseData | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);

  // useEffect(() => {
  //   if (!selectedSolanaTokenOption || !order) return;

  //   const destToken = order.destFinalCallTokenAmount?.token;
  //   if (!destToken) return;

  //   setFeeLoading(true);
  //   getCachedFee({
  //     appId: payParams?.appId,
  //     type: payParams?.feeType ?? FeeType.ExactIn,
  //     sourceChainId: selectedSolanaTokenOption.balance.token.chainId.toString(),
  //     sourceTokenSymbol: selectedSolanaTokenOption.balance.token.symbol,
  //     amount: selectedSolanaTokenOption.required.usd.toString(),
  //     destChainId: destToken.chainId.toString(),
  //     destReceiverAddress:
  //       getCanonicalDestination(order).finalDestinationAddress ??
  //       payParams?.toSolanaAddress ??
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
  // }, [selectedSolanaTokenOption?.balance.token.chainId, order?.id]);

  useEffect(() => {
    if (state === "error") {
      setRoute(ROUTES.ERROR);
      return;
    }
  }, [state]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setPayState = (state: PayState) => {
    if (state === payState) return;
    setPayStateInner(state);
    log(`[PayWithSolanaToken] payState: ${state}`);
    // (trpc as TrpcClient).nav.mutate({
    //   action: "pay-with-solana-token-state",
    //   data: { state },
    // });
  };

  // @NOTE: This is Pay In Solana by Rozo
  // FOR TRANSFER ACTION
  const handleTransfer = useCallback(
    async (option: WalletPaymentOption, isRetry: boolean = false) => {
      setIsLoading(true);
      capture(ROZO_EVENTS.PAYMENT_CONFIRMED, {
        payment_id: rozoPaymentId ?? order?.externalId,
        source_chain: option.required.token.chainId,
        token_symbol: option.required.token.symbol,
        amount:
          option.required.usd != null ? String(option.required.usd) : undefined,
      });
      if (isRetry) {
        setPayState(PayState.PreparingTransaction);
      }
      // Hoist so the catch block can reference the payment ID resolved in this
      // attempt, instead of the stale React state value captured in the closure.
      let resolvedPaymentId: string | undefined;
      try {
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
        let rozoPaymentResponse: PaymentResponse | undefined;
        let paymentId: string | undefined;

        // When payId is used (no payParams), fetch the existing payment instead
        // of creating a new one to avoid re-creating a payment that already exists.
        const existingPayId = currentOrder.externalId ?? undefined;
        const isPayIdMode = !payParams && !!existingPayId;

        // Use required.amount (base units, already priced by the backend)
        // converted to a human-readable token amount — NOT required.usd,
        // which is only equal to the token amount for 1:1-USD-pegged
        // tokens (USDC/USDT). For SOL/ETH/etc this would send the wrong
        // amount (e.g. "1.00" SOL instead of "0.013" SOL for a $1 payment).
        //
        // Some endpoints (e.g. Solana tRPC payment options) return
        // required.amount as an already-human-readable decimal string
        // instead of integer base units, so detect the shape first —
        // BigInt() throws on decimal strings.
        const sourceAmount = tokenBaseAmountToDecimalString(
          option.required.amount,
          option.required.token.decimals,
        );

        // @NOTE: Fee calculation
        const destToken = currentOrder.destFinalCallTokenAmount?.token;
        setFeeLoading(true);
        // Fee-quote type: native source forces ExactOut so the backend computes
        // the exact source.amount in native units. Scoped to getCachedFee only —
        // createPayment keeps payParams.feeType as-is.
        const isNativeSource = isNativeToken(option.required.token);
        const feeQuoteType = isNativeSource
          ? FeeType.ExactOut
          : (paymentState.payParams?.feeType ?? FeeType.ExactIn);
        // getFee maps `amount` to source.amount for exactIn and to
        // destination.amount for exactOut. For exactIn we must send the
        // source-token amount (e.g. SOL), NOT the USD/destination value —
        // otherwise the backend reads "1.3" as 1.3 SOL. For exactOut the
        // destination payout (USD-denominated for USDC) is the right input.
        const feeData = await getCachedFee({
          appId: resolveOrderAppId(currentOrder, paymentState.payParams?.appId),
          type: feeQuoteType,
          sourceChainId: option.required.token.chainId.toString(),
          sourceTokenSymbol: option.required.token.symbol,
          amount:
            feeQuoteType === FeeType.ExactOut
              ? option.required.usd.toString()
              : sourceAmount,
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
          console.error(
            "Fee calculation failed",
            feeData.error,
            JSON.stringify(feeData.error.message),
          );
          setRoute(ROUTES.ERROR, { error: feeData.error.message });
          return;
        }

        setFeeData(feeData.data);

        // ponytail: backend forbids `checkout` when rotating to a native source.
        // In payId mode there are no payParams to create a new order, so surface
        // a clear error instead of silently hanging on "Preparing Transaction".
        if (isPayIdMode && isNativeToken(option.required.token)) {
          const msg =
            "Rotating an existing order to a native token is not supported. Please create a new payment.";
          setRoute(ROUTES.ERROR, { error: msg });
          return;
        }

        if (isPayIdMode) {
          // payId mode: checkout (refresh) the payment with the selected source token
          const paymentRes = await getPayment(existingPayId!);
          if (!paymentRes?.data) {
            log(
              `[PayWithSolanaToken] getPayment failed for ${existingPayId}: status=${paymentRes?.status} error=${paymentRes?.error?.message}`,
            );
            throw new Error(
              `Failed to fetch payment: ${paymentRes?.error?.message ?? `HTTP ${paymentRes?.status}`}`,
            );
          }

          let sourceChainId = Number(option.required.token.chainId);

          if (sourceChainId === solana.chainId) {
            sourceChainId = rozoSolana.chainId;
          }

          const checkoutPayload = buildCheckoutPayload(paymentRes.data, {
            chainId: option.required.token.chainId,
            tokenSymbol: option.required.token.symbol,
            tokenAddress: option.required.token.token,
            amount: sourceAmount,
          });

          const checkoutRes = await checkoutPayment(
            existingPayId!,
            checkoutPayload,
          );
          if (!checkoutRes?.data) {
            log(
              `[PayWithSolanaToken] checkoutPayment failed for ${existingPayId}: status=${checkoutRes?.status} error=${checkoutRes?.error?.message} payload=${JSON.stringify(checkoutPayload)}`,
            );
            throw new Error(
              `Failed to checkout payment: ${checkoutRes?.error?.message ?? `HTTP ${checkoutRes?.status}`}`,
            );
          }
          paymentId = checkoutRes.data.id;

          const formattedOrder = formatPaymentResponseToHydratedOrder(
            checkoutRes.data,
          );
          hydratedOrder = formattedOrder;
          rozoPaymentResponse = checkoutRes.data;
        } else if (
          (state === "payment_unpaid" || state === "payment_started") &&
          !needRozoPayment
        ) {
          hydratedOrder = currentOrder as RozoPayHydratedOrderWithOrg;
        } else if (needRozoPayment) {
          // ponytail: backend rejects `checkout` when rotating to a native
          // source token (SOL/ETH/XLM) — "create a new order instead". So for
          // native sources we skip checkout and create a fresh payment.
          const rotateToNative = isNativeToken(option.required.token);
          const existingId =
            rozoPaymentId ?? currentOrder.externalId ?? undefined;
          if (existingId && !rotateToNative) {
            const paymentRes = await getPayment(existingId);
            if (!paymentRes?.data) {
              log(
                `[PayWithSolanaToken] getPayment failed for ${existingId}: status=${paymentRes?.status} error=${paymentRes?.error?.message}`,
              );
              throw new Error(
                `Failed to fetch payment: ${paymentRes?.error?.message ?? `HTTP ${paymentRes?.status}`}`,
              );
            }
            const checkoutPayload = buildCheckoutPayload(paymentRes.data, {
              chainId: option.required.token.chainId,
              tokenSymbol: option.required.token.symbol,
              tokenAddress: option.required.token.token,
              amount: sourceAmount,
            });
            const checkoutRes = await checkoutPayment(
              existingId,
              checkoutPayload,
            );
            if (!checkoutRes?.data) {
              log(
                `[PayWithSolanaToken] checkoutPayment failed for ${existingId}: status=${checkoutRes?.status} error=${checkoutRes?.error?.message} payload=${JSON.stringify(checkoutPayload)}`,
              );
              throw new Error(
                `Failed to checkout payment: ${checkoutRes?.error?.message ?? `HTTP ${checkoutRes?.status}`}`,
              );
            }
            paymentId = checkoutRes.data.id;
            hydratedOrder = formatPaymentResponseToHydratedOrder(
              checkoutRes.data,
            );
            rozoPaymentResponse = checkoutRes.data;
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
              log(
                `[PayWithSolanaToken] createPayment returned no result for source ${option.required.token.symbol} on chain ${option.required.token.chainId}`,
              );
              throw new Error("Failed to create Rozo payment");
            }
            paymentId = res.id;
            hydratedOrder = formatPaymentResponseToHydratedOrder(res);
            rozoPaymentResponse = res;
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
                  "[PayWithSolanaToken] State transition failed, attempting direct start:",
                  e,
                );
                // Try to set started directly if state is already unpaid
                try {
                  await setPaymentStarted(String(newId), hydratedOrder);
                } catch (e2) {
                  console.error(
                    "[PayWithSolanaToken] Could not start payment:",
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
              } catch (e) {
                console.error(
                  "[PayWithSolanaToken] Could not start payment:",
                  e,
                );
                throw e;
              }
            } else if (stateBeforeTransition === "preview") {
              // Transition from preview -> payment_unpaid -> payment_started
              await setPaymentUnpaid(String(newId), hydratedOrder);
              await setPaymentStarted(String(newId), hydratedOrder);
            } else {
              log(
                `[PayWithSolanaToken] Skipping setPaymentStarted - state is ${stateBeforeTransition}, needs to be payment_unpaid`,
              );
            }
          }
        }

        setPayState(PayState.RequestingPayment);

        const result = await payWithSolanaTokenRozo(
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
          {
            destAddress: hydratedOrder.intentAddr,
            sourceAmount: rozoPaymentResponse?.source.amount ?? undefined,
          },
        );
        log(
          "[PAY SOLANA] Result",
          result,
          getChainExplorerTxUrl(rozoSolana.chainId, result.txHash),
        );
        setTxURL(getChainExplorerTxUrl(rozoSolana.chainId, result.txHash));

        if (result.success) {
          capture(ROZO_EVENTS.PAYMENT_SUBMITTED, {
            payment_id: newId ?? rozoPaymentId,
            tx_hash: result.txHash,
            source_chain: rozoSolana.chainId,
            token_symbol: option.required.token.symbol,
          });
          try {
            sessionStorage.setItem(
              `rozo_submitted_at:${newId ?? rozoPaymentId}`,
              String(Date.now()),
            );
          } catch {}
          setPayState(PayState.RequestSuccessful);
          setTxHash(result.txHash);
          // Use `newId` (resolved this attempt) instead of the stale
          // `rozoPaymentId` React state captured in the useCallback closure.
          const completedPaymentId = newId ?? undefined;
          setTimeout(() => {
            setPaymentCompleted(
              result.txHash,
              completedPaymentId,
              solanaPubKey ?? null,
            );
            setRoute(ROUTES.CONFIRMATION, { event: "wait-pay-with-solana" });
          }, 200);
          setTimeout(() => {
            solanaPaymentOptions.refreshOptions();
          }, 1000);
        } else {
          capture(ROZO_EVENTS.PAYMENT_FAILED, {
            payment_id: newId ?? rozoPaymentId,
            error_message: "payment_unsuccessful",
            source_chain: rozoSolana.chainId,
          });
          setPayState(PayState.RequestCancelled);
        }
      } catch (error) {
        console.error("Failed to pay with solana token", error);
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
          source_chain: rozoSolana.chainId,
        });
        if (isRejected) {
          // User rejected in-wallet — keep them in-modal with a Retry affordance.
          setPayState(PayState.RequestCancelled);
        } else {
          // Setup/checkout/create-payment failure (the realistic RequestFailed
          // triggers here are all pre-submit throws). Route to the dedicated
          // Error page for proper categorization + retry/support.
          setRoute(ROUTES.ERROR, { error: errorMessage });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      setPayState,
      order,
      payParams,
      state,
      payWithSolanaTokenRozo,
      log,
      rozoPaymentId,
      createPayment,
      store,
      hydrateOrder,
      setRozoPaymentId,
      setPaymentUnpaid,
      setPaymentStarted,
      capture,
      setTxHash,
      setPaymentCompleted,
      solanaPubKey,
      setRoute,
      solanaPaymentOptions,
    ],
  );

  useEffect(() => {
    if (!selectedSolanaTokenOption) return;

    const transferTimeout = setTimeout(
      () => handleTransfer(selectedSolanaTokenOption),
      100,
    );
    return () => clearTimeout(transferTimeout);
  }, [selectedSolanaTokenOption]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    triggerResize();
  }, [payState]); // eslint-disable-line react-hooks/exhaustive-deps

  if (selectedSolanaTokenOption == null) {
    return <PageContent></PageContent>;
  }

  return (
    <PageContent>
      {selectedSolanaTokenOption && (
        <TokenLogoSpinner
          token={selectedSolanaTokenOption.required.token}
          loading={isLoading}
          nativeAsChainIcon
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
            ...selectedSolanaTokenOption,
            fees: {
              ...selectedSolanaTokenOption.fees,
              usd:
                feeData?.source.fee != null
                  ? Number(feeData.source.fee)
                  : selectedSolanaTokenOption.fees.usd,
            },
          }}
          feeData={feeData}
          feeLoading={feeLoading}
        />
        {payState === PayState.RequestCancelled && !isLoading && (
          <Button
            onClick={() => handleTransfer(selectedSolanaTokenOption, true)}
          >
            Retry Payment
          </Button>
        )}
        {/* ponytail: RequestFailed is no longer set on Solana (hard failures
            route to ROUTES.ERROR); kept as a defensive fallback. */}
        {payState === PayState.RequestFailed && (
          <Button onClick={handleContactClick}>Contact Support</Button>
        )}
      </ModalContent>
    </PageContent>
  );
};

export default PayWithSolanaToken;
