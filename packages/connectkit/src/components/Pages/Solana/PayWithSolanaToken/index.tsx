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
  RozoPayHydratedOrderWithOrg,
  rozoSolana,
  solana,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { useContactSupport } from "../../../../hooks/useContactSupport";
import { useRozoPay } from "../../../../hooks/useRozoPay";
import { ROZO_EVENTS } from "../../../../lib/analytics/events";
import { useAnalytics } from "../../../../provider/AnalyticsProvider";
import { getCachedFee } from "../../../../utils/feeCache";
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
        if (!order) {
          throw new Error("Order not initialized");
        }

        const { required } = option;

        const needRozoPayment =
          order.preferredChainId !== null &&
          order.preferredChainId !== required.token.chainId;

        let hydratedOrder: RozoPayHydratedOrderWithOrg;
        let paymentId: string | undefined;

        // When payId is used (no payParams), fetch the existing payment instead
        // of creating a new one to avoid re-creating a payment that already exists.
        const existingPayId = order.externalId ?? undefined;
        const isPayIdMode = !payParams && !!existingPayId;

        // @NOTE: Fee calculation
        const destToken = order.destFinalCallTokenAmount?.token;
        setFeeLoading(true);
        const feeData = await getCachedFee({
          // Prefer the appId from the loaded order — payId (Checkout) flows carry
          // it in order.metadata and don't pass it via props. Fall back to props
          // for appId-mode payments (Bridge/Deposit).
          appId:
            (order.metadata as { appId?: string } | undefined)?.appId ??
            paymentState.payParams?.appId,
          type: paymentState.payParams?.feeType ?? FeeType.ExactIn,
          sourceChainId: option.required.token.chainId.toString(),
          sourceTokenSymbol: option.required.token.symbol,
          amount: option.required.usd.toString(),
          destChainId: destToken.chainId.toString(),
          destReceiverAddress:
            getCanonicalDestination(order).finalDestinationAddress ??
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
          setPayState(PayState.RequestFailed);
          return;
        }

        setFeeData(feeData.data);

        if (isPayIdMode) {
          // payId mode: checkout (refresh) the payment with the selected source token
          const paymentRes = await getPayment(existingPayId!);
          if (!paymentRes?.data) {
            throw new Error("Failed to fetch payment");
          }

          let sourceChainId = Number(option.required.token.chainId);

          if (sourceChainId === solana.chainId) {
            sourceChainId = rozoSolana.chainId;
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

          const formattedOrder = formatPaymentResponseToHydratedOrder(
            checkoutRes.data,
          );
          hydratedOrder = formattedOrder;
        } else if (
          (state === "payment_unpaid" || state === "payment_started") &&
          !needRozoPayment
        ) {
          hydratedOrder = order;
        } else if (needRozoPayment) {
          const existingId = rozoPaymentId ?? order.externalId ?? undefined;
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

        const paymentData = {
          destAddress: hydratedOrder.intentAddr,
        };

        if (hydratedOrder.memo) {
          Object.assign(paymentData, {
            memo: hydratedOrder.memo,
          });
        }

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
          paymentData,
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
          setPayState(PayState.RequestCancelled);
        } else {
          setPayState(PayState.RequestFailed);
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
        {payState === PayState.RequestFailed && (
          <Button onClick={handleContactClick}>Contact Support</Button>
        )}
      </ModalContent>
    </PageContent>
  );
};

export default PayWithSolanaToken;
