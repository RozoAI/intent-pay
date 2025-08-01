import React, { useEffect, useMemo, useState } from "react";
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
  getChainExplorerTxUrl,
  getOrderDestChainId,
  stellar,
} from "@rozoai/intent-common";
import { motion } from "framer-motion";
import { LoadingCircleIcon, TickIcon } from "../../../assets/icons";
import { useRozoPay } from "../../../hooks/useDaimoPay";
import styled from "../../../styles/styled";
import PoweredByFooter from "../../Common/PoweredByFooter";

const Confirmation: React.FC = () => {
  const {
    confirmationMessage,
    onSuccess,
    debugMode,
    paymentState: paymentStateContext,
  } = usePayContext();
  const { order, paymentState, setPaymentCompleted, setPaymentRozoCompleted } =
    useRozoPay();

  const [isConfirming, setIsConfirming] = useState<boolean>(true);

  const { done, txURL } = useMemo(() => {
    const { tokenMode, txHash, rozoPaymentId } = paymentStateContext;
    if (tokenMode === "stellar" && txHash) {
      // Add delay before setting payment completed to show confirming state
      if (isConfirming) {
        setTimeout(() => {
          setPaymentCompleted(txHash, rozoPaymentId);
          setIsConfirming(false);
        }, 1000);
        return { done: false, txURL: undefined };
      }

      const txURL = getChainExplorerTxUrl(stellar.chainId, txHash);
      return { done: true, txURL };
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

        return { done: true, txURL };
      }
    }

    return { done: false, txURL: undefined };
  }, [paymentState, order, paymentStateContext, isConfirming]);

  useEffect(() => {
    if (done) {
      if (paymentStateContext.tokenMode === "stellar") {
        setPaymentRozoCompleted(true);
      }
      onSuccess();
    }
  }, [done, onSuccess, paymentStateContext]);

  useEffect(() => {
    if (debugMode) {
      console.log(`[ORDER] Order: `, order);
    }
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
            <Spinner $status={done} />
            <SuccessIcon $status={done} />
          </InsetContainer>
        </AnimationContainer>

        {!done ? (
          <ModalH1>Confirming...</ModalH1>
        ) : (
          <>
            <ModalH1>
              <Link href={txURL} target="_blank" rel="noopener noreferrer">
                Payment Completed
              </Link>
            </ModalH1>
            {confirmationMessage && (
              <ModalBody>{confirmationMessage}</ModalBody>
            )}
          </>
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
  inset: 6px;
  border-radius: 50px;
  background: var(--ck-body-background);
  display: flex;
  align-items: center;
  justify-content: center;
  svg {
    position: absolute;
    width: 100%;
    height: 100%;
  }
`;

const SuccessIcon = styled(TickIcon)<{ $status: boolean }>`
  color: var(--ck-body-color-valid);
  transition: all 0.2s ease-in-out;
  position: absolute;
  opacity: ${(props) => (props.$status ? 1 : 0)};
  transform: ${(props) => (props.$status ? "scale(1)" : "scale(0.5)")};
`;

const Spinner = styled(LoadingCircleIcon)<{ $status: boolean }>`
  position: absolute;
  transition: all 0.2s ease-in-out;
  animation: rotateSpinner 400ms linear infinite;
  opacity: ${(props) => (props.$status ? 0 : 1)};

  @keyframes rotateSpinner {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

export default Confirmation;
