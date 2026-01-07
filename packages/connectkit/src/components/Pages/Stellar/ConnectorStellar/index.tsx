import React, { useEffect, useState } from "react";

import {
  ModalBody,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../../Common/Modal/styles";

import { AnimatePresence, motion } from "framer-motion";
import { ROUTES } from "../../../../constants/routes";
import { usePayContext } from "../../../../hooks/usePayContext";
import { useStellar } from "../../../../provider/StellarContextProvider";
import styled from "../../../../styles/styled";
import SquircleSpinner from "../../../Spinners/SquircleSpinner";

const ConnectorStellar: React.FC = () => {
  const { stellarConnector, setRoute, paymentState, log } = usePayContext();
  const { setTokenMode } = paymentState;

  const { setWallet, isConnected, publicKey } = useStellar();

  // Track if we've initiated connection to prevent multiple attempts
  const [connectionInitiated, setConnectionInitiated] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Debug logging
  useEffect(() => {
    log(
      `[ConnectorStellar] Component mounted/updated - isConnected: ${isConnected}, publicKey: ${publicKey}, stellarConnector: ${
        stellarConnector?.name ?? "none"
      }`
    );
  }, [isConnected, publicKey, stellarConnector, log]);

  // Trigger wallet connection on mount (like Solana pattern)
  // stellarConnector contains the full wallet object set by ConnectStellar
  useEffect(() => {
    if (!stellarConnector || connectionInitiated) return;

    const connectWallet = async () => {
      try {
        log(
          `[ConnectorStellar] Initiating connection to wallet: ${stellarConnector.name}`
        );
        setConnectionInitiated(true);

        // setWallet handles: kit.setWallet(), kit.getAddress(), state updates, localStorage
        await setWallet(stellarConnector);
        log(`[ConnectorStellar] setWallet completed successfully`);
      } catch (error: any) {
        log(`[ConnectorStellar] Connection error: ${error.message}`);
        setConnectionError(error.message || "Failed to connect wallet");
      }
    };

    connectWallet();
  }, [stellarConnector, connectionInitiated, setWallet, log]);

  // Navigate to SELECT_TOKEN when connected (same as before)
  useEffect(() => {
    log(`[ConnectorStellar] isConnected changed to: ${isConnected}`);
    if (!isConnected) return;

    // Wait so user can see it's connected
    const meta = {
      event: "wait-stellar-connected",
      walletName: stellarConnector?.name ?? "Stellar Wallet",
    };
    log(
      "[ConnectorStellar] Connection detected, navigating to SELECT_TOKEN in 500ms"
    );
    setTimeout(() => {
      setTokenMode("stellar");
      setRoute(ROUTES.SELECT_TOKEN, meta);
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  if (!stellarConnector) return null;

  // Get wallet display info from stellarConnector (which is now the full wallet object)
  const walletName = stellarConnector?.name || "Stellar Wallet";
  const walletIcon = stellarConnector?.icon;

  return (
    <PageContent>
      <LoadingContainer>
        <AnimationContainer>
          <AnimatePresence>
            <SquircleSpinner
              logo={
                <div style={{ borderRadius: "22.5%", overflow: "hidden" }}>
                  {walletIcon && <img src={walletIcon} alt={walletName} />}
                </div>
              }
              loading={!isConnected && !connectionError}
            />
          </AnimatePresence>
        </AnimationContainer>
      </LoadingContainer>
      <ModalContent style={{ paddingBottom: 0 }}>
        {connectionError ? (
          <>
            <ModalH1>Connection Failed</ModalH1>
            <ModalBody>{connectionError}</ModalBody>
          </>
        ) : isConnected ? (
          <ModalH1>Connected</ModalH1>
        ) : (
          <>
            <ModalH1>Requesting Connection</ModalH1>
            <ModalBody>Open {walletName} to continue.</ModalBody>
          </>
        )}
      </ModalContent>
    </PageContent>
  );
};

export const LoadingContainer = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 10px auto 16px;
  height: 120px;
`;
const AnimationContainer = styled(motion.div)`
  user-select: none;
  position: relative;
  --spinner-error-opacity: 0;
  &:before {
    content: "";
    position: absolute;
    inset: 1px;
    opacity: 0;
    background: var(--ck-body-color-danger);
  }
`;

export default ConnectorStellar;
