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
    payWithSolanaTokenRozo: payWithSolanaTokenImpl,
    payParams,
    rozoPaymentId,
    setRozoPaymentId,
    setTxHash,
    setPayId,
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
          console.log({ res });
          paymentId = res.id;
          hydratedOrder = formatPaymentResponseToHydratedOrder(res);
        } else {
          // Hydrate existing order
          const res = await hydrateOrderRozo(undefined, option);
          console.log({ hydrateOrderRozo: res });
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

        console.log({ hydratedOrder });

        const paymentData = {
          tokenAddress: required.token.token,
          destAddress: hydratedOrder.intentAddr || destinationAddress,
          usdcAmount: String(hydratedOrder.usdValue),
        };

        if (hydratedOrder.memo) {
          Object.assign(paymentData, {
            memo: hydratedOrder.memo,
          });
        }

        log("[PAY SOLANA] Rozo payment:", { paymentData });

        const result = await payWithSolanaTokenImpl(option, paymentData);
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
            setPaymentRozoCompleted(true);
            setPaymentCompleted(result.txHash, rozoPaymentId);
            setRoute(ROUTES.CONFIRMATION, { event: "wait-pay-with-solana" });
          }, 200);
        } else {
          setPayState(PayState.RequestCancelled);
        }
      } catch (error) {
        console.error("Failed to pay with solana token", error);
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
