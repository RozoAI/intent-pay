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
  formatResponseToHydratedOrder,
  getChainExplorerTxUrl,
  RozoPayHydratedOrderWithOrg,
  rozoSolana,
  rozoSolanaUSDC,
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
    payWithSolanaTokenRozo: payWithSolanaTokenImpl,
    payParams,
    rozoPaymentId,
    setRozoPaymentId,
    setTxHash,
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
  const { destinationAddress } = useSolanaDestination(payParams);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const [payState, setPayState] = useState<PayState>(
    PayState.PreparingTransaction
  );
  const [txURL, setTxURL] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTxHash, setPendingTxHash] = useState<string | undefined>();

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
        throw new Error("Solana destination address is required");
      }

      if (!order) {
        throw new Error("Order not initialized");
      }

      const { required } = option;

      const needRozoPayment =
        "payinchainid" in order.metadata &&
        Number(order.metadata.payinchainid) !== required.token.chainId;

      let hydratedOrder: RozoPayHydratedOrderWithOrg;
      let paymentId: string | undefined;

      if (state === "payment_unpaid" && !needRozoPayment) {
        hydratedOrder = order;
      } else if (needRozoPayment) {
        const res = await createPayment(option, store as any);

        if (!res) {
          throw new Error("Failed to create Rozo payment");
        }

        paymentId = res.id;
        hydratedOrder = formatResponseToHydratedOrder(res);
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
        setPaymentStarted(String(newId), hydratedOrder);
      }

      setPayState(PayState.RequestingPayment);

      const paymentData = {
        tokenAddress: (required.token.token as string) ?? rozoSolanaUSDC.token,
        destAddress:
          (hydratedOrder.destFinalCall.to as string) || destinationAddress,
        usdcAmount: String(hydratedOrder.destFinalCallTokenAmount.usd),
        solanaAmount: String(hydratedOrder.destFinalCallTokenAmount.usd),
      };

      if (hydratedOrder.metadata?.memo) {
        Object.assign(paymentData, {
          memo: hydratedOrder.metadata.memo as string,
        });
      }

      log?.("[PAY SOLANA] Rozo payment:", { paymentData });

      const result = await payWithSolanaTokenImpl(option, paymentData);
      log?.(
        "[PAY SOLANA] Result",
        result,
        getChainExplorerTxUrl(rozoSolana.chainId, result.txHash)
      );

      if (result.success) {
        setPendingTxHash(result.txHash);
        setPayState(PayState.WaitingForConfirmation);
      } else {
        setPayState(PayState.RequestCancelled);
      }
    } catch (error) {
      if (rozoPaymentId) {
        setPaymentUnpaid(rozoPaymentId);
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
    if (pendingTxHash) {
      try {
        setIsLoading(true);
        setPayState(PayState.ProcessingPayment);

        // Set the transaction URL and hash
        setTxURL(getChainExplorerTxUrl(rozoSolana.chainId, pendingTxHash));
        setTxHash(pendingTxHash);

        setPayState(PayState.RequestSuccessful);
        setTimeout(() => {
          setPendingTxHash(undefined);
          setPaymentRozoCompleted(true);
          setPaymentCompleted(pendingTxHash, rozoPaymentId);
          setRoute(ROUTES.CONFIRMATION, { event: "wait-pay-with-solana" });
        }, 200);
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
      log?.("[PAY SOLANA] Cannot submit transaction - missing requirements");
    }
  };

  useEffect(() => {
    if (pendingTxHash) {
      submitButtonRef.current?.click();
    }
  }, [pendingTxHash]);

  useEffect(() => {
    if (!selectedSolanaTokenOption) return;

    // Give user time to see the UI before opening
    const transferTimeout = setTimeout(
      () => handleTransfer(selectedSolanaTokenOption),
      100
    );
    return () => clearTimeout(transferTimeout);
  }, [selectedSolanaTokenOption]);

  useEffect(() => {
    triggerResize();
  }, [payState]);

  if (selectedSolanaTokenOption == null) {
    return <PageContent></PageContent>;
  }

  return (
    <PageContent>
      <button
        ref={submitButtonRef}
        style={{ display: "none" }}
        onClick={handleSubmitTx}
      />
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
        {payState === PayState.WaitingForConfirmation && pendingTxHash && (
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
                    `Pay with Solana token${txURL ? ` ${txURL}` : ""}`
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

export default PayWithSolanaToken;
