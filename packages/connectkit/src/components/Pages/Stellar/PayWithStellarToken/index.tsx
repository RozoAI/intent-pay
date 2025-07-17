import React, { useEffect, useState } from "react";
import { ROUTES } from "../../../../constants/routes";
import { usePayContext } from "../../../../hooks/usePayContext";

import {
  WalletSendTransactionError,
  WalletSignTransactionError,
} from "@solana/wallet-adapter-base";
import {
  Link,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../../Common/Modal/styles";

import {
  getChainExplorerTxUrl,
  RozoPayTokenAmount,
  stellar,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { useRozoPay } from "../../../../hooks/useDaimoPay";
import { getSupportUrl } from "../../../../utils/supportUrl";
import Button from "../../../Common/Button";
import PaymentBreakdown from "../../../Common/PaymentBreakdown";
import TokenLogoSpinner from "../../../Spinners/TokenLogoSpinner";
import { roundTokenAmount } from "../../../../utils/format";
import { createPayment, createPaymentRequest, PaymentResponseData } from "../../../../utils/api";
import { ROZO_DAIMO_APP_ID, ROZO_STELLAR_ADDRESS } from "../../../../constants/rozoConfig";
enum PayState {
  CreatingPayment = "Creating Payment Record...",
  RequestingPayment = "Waiting for Payment",
  RequestCancelled = "Payment Cancelled",
  RequestFailed = "Payment Failed",
  RequestSuccessful = "Payment Successful",
}

const PayWithStellarToken: React.FC = () => {
  const { triggerResize, paymentState, setRoute } = usePayContext();
  const { selectedStellarTokenOption, payWithStellarToken, setTxHash, payParams } = paymentState;
  const { order } = useRozoPay();
  const [payState, setPayState] = useState<PayState>(
    PayState.CreatingPayment,
  );
  const [txURL, setTxURL] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [activeRozoPayment, setActiveRozoPayment] = useState<PaymentResponseData | undefined>();

  // FOR API CALL
  const handleCreatePayment = async (payToken: RozoPayTokenAmount, destinationAddress: string) => {
    setPayState(PayState.CreatingPayment);

    const token = payToken.token;
    const amount = roundTokenAmount(payToken?.amount, payToken.token);

    const paymentData = createPaymentRequest({
      appId: payParams?.appId ?? ROZO_DAIMO_APP_ID,
      intent: order?.metadata?.intent ?? "",
      paymentValue: String(payToken.usd),
      currency: "USD",
      destinationAddress,
      chainId: String(token.chainId),
      amountUnits: String(amount) ?? "",
      tokenSymbol: token.symbol,
      externalId: order?.externalId ?? "",
      metadata: {
        daimoOrderId: order?.id ?? "",
        ...(order?.metadata ?? {}),
      },
    });

    // API Call
    const response = await createPayment(paymentData);
    if (!response?.data?.id) {
      throw new Error(response?.error?.message ?? "Payment creation failed");
    }

    setActiveRozoPayment(response.data);
    return response.data;
  }

  // FOR TRANSFER ACTION
  const handleTransfer = async (option: WalletPaymentOption) => {
    setIsLoading(true);
    try {
      const destinationAddress = payParams?.toStellarAddress ?? ROZO_STELLAR_ADDRESS;

      if (!destinationAddress) {
        throw new Error("Stellar destination address is required");
      }

      let payment: PaymentResponseData | undefined = activeRozoPayment;
      if (!payment) {
        payment = await handleCreatePayment(option.required, destinationAddress);
      }

      setPayState(PayState.RequestingPayment);

      const result = await payWithStellarToken(option.required, {
        destAddress: payment.destination.destinationAddress ?? destinationAddress,
        amount: payment.destination.amountUnits,
      });

      setTxURL(getChainExplorerTxUrl(stellar.chainId, result.txHash));

      if (result.success) {
        setPayState(PayState.RequestSuccessful);
        setTxHash(result.txHash);
        setTimeout(() => {
          setActiveRozoPayment(undefined);
          setRoute(ROUTES.CONFIRMATION, { event: "wait-pay-with-stellar" });
        }, 200);
      } else {
        setPayState(PayState.RequestFailed);
      }
    } catch (error) {
      if (
        error instanceof Error && error.message.includes("declined")
      ) {
        setPayState(PayState.RequestCancelled);
      } else {
        setPayState(PayState.RequestFailed);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedStellarTokenOption) return;

    // Give user time to see the UI before opening
    const transferTimeout = setTimeout(
      () => handleTransfer(selectedStellarTokenOption),
      100,
    );
    return () => clearTimeout(transferTimeout);
  }, [selectedStellarTokenOption]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    triggerResize();
  }, [payState]); // eslint-disable-line react-hooks/exhaustive-deps

  if (selectedStellarTokenOption == null) {
    return <PageContent></PageContent>;
  }

  return (
    <PageContent>
      {selectedStellarTokenOption && (
        <TokenLogoSpinner token={selectedStellarTokenOption.required.token} loading={isLoading} />
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
        {payState === PayState.RequestCancelled && (
          <Button onClick={() => handleTransfer(selectedStellarTokenOption)}>
            Retry Payment
          </Button>
        )}
        {payState === PayState.RequestFailed && (
          <Button
            onClick={() => {
              window.open(
                getSupportUrl(
                  order?.id?.toString() ?? "",
                  `Pay with Stellar token${txURL ? ` ${txURL}` : ""}`,
                ),
                "_blank",
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

export default PayWithStellarToken;
