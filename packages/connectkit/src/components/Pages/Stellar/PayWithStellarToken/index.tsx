import React, { useEffect, useRef, useState } from "react";
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
  stellar,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import {
  FeeBumpTransaction,
  Networks,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { useRozoPay } from "../../../../hooks/useDaimoPay";
import { useStellarDestination } from "../../../../hooks/useStellarDestination";
import { useStellar } from "../../../../provider/StellarContextProvider";
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
  } = paymentState;
  const {
    store,
    order,
    paymentState: state,
    setPaymentStarted,
    setPaymentUnpaid,
    setPaymentRozoCompleted,
    setPaymentCompleted,
    hydrateOrderRozo,
  } = useRozoPay();
  // Get the destination address and payment direction using our custom hook
  const { destinationAddress } = useStellarDestination(payParams);
  const {
    server: stellarServer,
    publicKey: stellarPublicKey,
    kit: stellarKit,
  } = useStellar();
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const [payState, setPayState] = useState<PayState>(
    PayState.PreparingTransaction
  );
  const [txURL, setTxURL] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [signedTx, setSignedTx] = useState<string | undefined>();

  useEffect(() => {
    if (state === "error") {
      setRoute(ROUTES.ERROR);
      return;
    }
  }, [state]);

  // FOR TRANSFER ACTION
  const handleTransfer = async (option: WalletPaymentOption) => {
    setIsLoading(true);
    try {
      if (!destinationAddress) {
        throw new Error("Stellar destination address is required");
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
        hydratedOrder = formatPaymentResponseToHydratedOrder(res);
      } else {
        // Hydrate existing order
        const res = await hydrateOrderRozo(undefined, option);
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
                "[PayWithStellarToken] State transition failed, attempting direct start:",
                e
              );
              // Try to set started directly if state is already unpaid
              try {
                await setPaymentStarted(String(newId), hydratedOrder);
              } catch (e2) {
                console.error(
                  "[PayWithStellarToken] Could not start payment:",
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
                "[PayWithStellarToken] Could not start payment:",
                e
              );
              throw e;
            }
          } else {
            log?.(
              `[PayWithStellarToken] Skipping setPaymentStarted - state is ${stateBeforeTransition}, needs to be payment_unpaid`
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

      const result = await payWithStellarToken(option, paymentData);
      setSignedTx(result.signedTx);
      setPayState(PayState.WaitingForConfirmation);
    } catch (error) {
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
          Networks.PUBLIC
        );

        const response = await stellarServer.submitTransaction(
          tx as Transaction | FeeBumpTransaction
        );

        if (response.successful) {
          setPayState(PayState.RequestSuccessful);
          setTxHash(response.hash);
          setTxURL(getChainExplorerTxUrl(stellar.chainId, response.hash));
          setTimeout(() => {
            setSignedTx(undefined);
            setPaymentRozoCompleted(true);
            setPaymentCompleted(response.hash, rozoPaymentId);
            setRoute(ROUTES.CONFIRMATION, { event: "wait-pay-with-stellar" });
          }, 200);
        } else {
          setPayState(PayState.RequestFailed);
        }
      } catch (error) {
        if ((error as any).message.includes("rejected")) {
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
      100
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
        <PaymentBreakdown paymentOption={selectedStellarTokenOption} />
        {payState === PayState.WaitingForConfirmation && signedTx && (
          <Button variant="primary" onClick={handleSubmitTx}>
            Confirm Payment
          </Button>
        )}
        {payState === PayState.RequestCancelled && (
          <Button onClick={handleSubmitTx}>Retry Payment</Button>
        )}
        {payState === PayState.RequestFailed && (
          <>
            <Button onClick={handleSubmitTx}>Retry Payment</Button>
            <Button
              onClick={() => {
                window.open(
                  getSupportUrl(
                    order?.id?.toString() ?? "",
                    `Pay with Stellar token${txURL ? ` ${txURL}` : ""}`
                  ),
                  "_blank"
                );
              }}
            >
              Contact Support
            </Button>
          </>
        )}
      </ModalContent>
    </PageContent>
  );
};

export default PayWithStellarToken;
