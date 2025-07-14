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
  stellar,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { useRozoPay } from "../../../../hooks/useDaimoPay";
import { getSupportUrl } from "../../../../utils/supportUrl";
import Button from "../../../Common/Button";
import PaymentBreakdown from "../../../Common/PaymentBreakdown";
import TokenLogoSpinner from "../../../Spinners/TokenLogoSpinner";
enum PayState {
  RequestingPayment = "Waiting For Payment",
  RequestCancelled = "Payment Cancelled",
  RequestFailed = "Payment Failed",
  RequestSuccessful = "Payment Successful",
}

const PayWithStellarToken: React.FC = () => {
  const { triggerResize, paymentState, setRoute } = usePayContext();
  const { selectedStellarTokenOption, payWithStellarToken } = paymentState;
  const { order } = useRozoPay();
  const [payState, setPayState] = useState<PayState>(
    PayState.RequestingPayment,
  );
  const [txURL, setTxURL] = useState<string | undefined>();

  const handleTransfer = async (option: WalletPaymentOption) => {
    setPayState(PayState.RequestingPayment);
    try {
      const result = await payWithStellarToken(option.required.token.token);
      setTxURL(getChainExplorerTxUrl(stellar.chainId, result.txHash));
      if (result.success) {
        setPayState(PayState.RequestSuccessful);
        setTimeout(() => {
          setRoute(ROUTES.CONFIRMATION, { event: "wait-pay-with-stellar" });
        }, 200);
      } else {
        setPayState(PayState.RequestFailed);
      }
    } catch (error) {
      console.error(error);
      if (
        error instanceof WalletSignTransactionError ||
        error instanceof WalletSendTransactionError
      ) {
        setPayState(PayState.RequestCancelled);
      } else {
        setPayState(PayState.RequestFailed);
      }
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
        <TokenLogoSpinner token={selectedStellarTokenOption.required.token} />
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
