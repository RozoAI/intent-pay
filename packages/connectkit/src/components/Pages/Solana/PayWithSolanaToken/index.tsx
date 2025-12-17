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
  formatPaymentResponseToHydratedOrder,
  getChainExplorerTxUrl,
  RozoPayHydratedOrderWithOrg,
  rozoSolana,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { useRozoPay } from "../../../../hooks/useDaimoPay";
import { useSolanaDestination } from "../../../../hooks/useSolanaDestination";
import { getSupportUrl } from "../../../../utils/supportUrl";
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

  // Get the destination address and payment direction using our custom hook
  const { destinationAddress } = useSolanaDestination(payParams);

  const [payState, setPayStateInner] = useState<PayState>(
    PayState.PreparingTransaction
  );
  const [txURL, setTxURL] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (state === "error") {
      setRoute(ROUTES.ERROR);
      return;
    }
  }, [state]);

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
    async (option: WalletPaymentOption) => {
      setIsLoading(true);
      try {
        if (!destinationAddress) {
          throw new Error("Solana destination address is required");
        }

        if (!order) {
          throw new Error("Order not initialized");
        }

        const { required } = option;

        const needRozoPayment =
          order.preferredChainId !== null &&
          order.preferredChainId !== required.token.chainId;

        let hydratedOrder: RozoPayHydratedOrderWithOrg;
        let paymentId: string | undefined;

        if (
          (state === "payment_unpaid" || state === "payment_started") &&
          !needRozoPayment
        ) {
          hydratedOrder = order;
        } else if (needRozoPayment) {
          const res = await createPayment(option, store as any);

          if (!res) {
            throw new Error("Failed to create Rozo payment");
          }
          paymentId = res.id;

          const formattedOrder = formatPaymentResponseToHydratedOrder(res);
          hydratedOrder = formattedOrder;
        } else {
          // Hydrate existing order
          const res = await hydrateOrder(undefined, option);
          hydratedOrder = res.order;
        }

        if (!hydratedOrder) {
          throw new Error("Payment not found");
        }

        const newId = paymentId ?? hydratedOrder.externalId;
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
                  e
                );
                // Try to set started directly if state is already unpaid
                try {
                  await setPaymentStarted(String(newId), hydratedOrder);
                } catch (e2) {
                  console.error(
                    "[PayWithSolanaToken] Could not start payment:",
                    e2
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
                  e
                );
                throw e;
              }
            } else if (stateBeforeTransition === "preview") {
              // Transition from preview -> payment_unpaid -> payment_started
              await setPaymentUnpaid(String(newId), hydratedOrder);
              await setPaymentStarted(String(newId), hydratedOrder);
            } else {
              log(
                `[PayWithSolanaToken] Skipping setPaymentStarted - state is ${stateBeforeTransition}, needs to be payment_unpaid`
              );
            }
          }
        }

        setPayState(PayState.RequestingPayment);

        const paymentData = {
          destAddress: hydratedOrder.intentAddr || destinationAddress,
          usdcAmount: String(option.required.usd),
        };

        if (hydratedOrder.memo) {
          Object.assign(paymentData, {
            memo: hydratedOrder.memo,
          });
        }

        const result = await payWithSolanaTokenRozo(option, paymentData);
        log(
          "[PAY SOLANA] Result",
          result,
          getChainExplorerTxUrl(rozoSolana.chainId, result.txHash)
        );
        setTxURL(getChainExplorerTxUrl(rozoSolana.chainId, result.txHash));

        if (result.success) {
          setPayState(PayState.RequestSuccessful);
          setTxHash(result.txHash);
          setTimeout(() => {
            setPaymentCompleted(result.txHash, rozoPaymentId);
            setRoute(ROUTES.CONFIRMATION, { event: "wait-pay-with-solana" });
          }, 200);
          setTimeout(() => {
            solanaPaymentOptions.refreshOptions();
          }, 1000);
        } else {
          setPayState(PayState.RequestCancelled);
        }
      } catch (error) {
        console.error("Failed to pay with solana token", error);
        if (rozoPaymentId) {
          try {
            await setPaymentUnpaid(rozoPaymentId);
          } catch (e) {
            console.error("Failed to set payment unpaid:", e);
          }
        }
        if ((error as any).message.includes("rejected")) {
          setPayState(PayState.RequestCancelled);
        } else {
          setPayState(PayState.RequestFailed);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [destinationAddress, order, state, rozoPaymentId]
  );

  useEffect(() => {
    if (!selectedSolanaTokenOption) return;

    const transferTimeout = setTimeout(
      () => handleTransfer(selectedSolanaTokenOption),
      100
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
        <PaymentBreakdown paymentOption={selectedSolanaTokenOption} />
        {payState === PayState.RequestCancelled && !isLoading && (
          <Button onClick={() => handleTransfer(selectedSolanaTokenOption)}>
            Retry Payment
          </Button>
        )}
        {payState === PayState.RequestFailed && (
          <Button
            onClick={() => {
              window.open(
                getSupportUrl(
                  order?.id?.toString() ?? "",
                  `Pay with Solana token${txURL ? ` ${txURL}` : ""}`
                ),
                "_blank"
              );
            }}
          >
            Contact Support
          </Button>
        )}
      </ModalContent>
    </PageContent>
  );
};

export default PayWithSolanaToken;
