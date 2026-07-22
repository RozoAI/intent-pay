import React, { useEffect, useState } from "react";

import {
  ModalBody,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../../Common/Modal/styles";

import { Stellar } from "../../../../assets/chains";
import { ROUTES } from "../../../../constants/routes";
import { usePayContext } from "../../../../hooks/usePayContext";
import { useStellar } from "../../../../provider/StellarContextProvider";
import styled from "../../../../styles/styled";
import Button from "../../../Common/Button";
import { QRCode } from "../../../Common/CustomQRCode/QRCode";
import WalletPaymentSpinner from "../../../Spinners/WalletPaymentSpinner";

/**
 * WalletConnect QR connector for platform wrappers (e.g. Freighter Mobile
 * App webview) and desktop without extension.  Shows a QR code for the user
 * to scan with their mobile wallet app.
 */
const StellarWalletConnectQR: React.FC = () => {
  const { stellarConnector, setRoute, log } = usePayContext();
  const { setPublicKey, setConnector } = useStellar();

  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stellarConnector) return;

    let cancelled = false;

    const connect = async () => {
      try {
        log("[StellarWalletConnectQR] Initializing WalletConnect...");

        const { SignClient } = await import("@walletconnect/sign-client");

        const projectId = "7440dd8acf85933ffcc775ec6675d4a9";

        const signClient = await SignClient.init({
          projectId,
          metadata: {
            name: "Rozo",
            url: "https://rozo.ai",
            description: "Visa Layer for Stablecoins",
            icons: ["https://rozo.ai/rozo-logo.png"],
          },
        });

        log("[StellarWalletConnectQR] Creating session...");
        const { uri: wcUri, approval } = await signClient.connect({
          requiredNamespaces: {
            stellar: {
              methods: ["stellar_signXDR"],
              chains: ["stellar:pubnet"],
              events: [],
            },
          },
          optionalNamespaces: {
            stellar: {
              methods: ["stellar_signAndSubmitXDR"],
              chains: ["stellar:pubnet"],
              events: [],
            },
          },
        });

        if (cancelled) return;

        if (wcUri) {
          log("[StellarWalletConnectQR] URI received, showing QR code");
          setUri(wcUri);
        }

        log("[StellarWalletConnectQR] Waiting for wallet to scan QR...");
        const session = await approval();

        if (cancelled) {
          await signClient.disconnect({
            topic: session.topic,
            reason: { message: "Component unmounted", code: -1 },
          });
          return;
        }

        const accounts = session.namespaces.stellar.accounts.map(
          (account: string) => account.split(":")[2],
        );
        const address = accounts[0];

        log(`[StellarWalletConnectQR] Connected: ${address}`);

        setPublicKey(address);
        setConnector({
          id: stellarConnector.id,
          name: stellarConnector.name,
          icon: stellarConnector.icon,
          isAvailable: true,
          isPlatformWrapper: true,
          type: "BRIDGE_WALLET" as any,
          url: stellarConnector.url || "https://walletconnect.com/",
        });

        setRoute(ROUTES.SELECT_TOKEN, {
          event: "stellar-wc-connected",
          walletName: stellarConnector.name,
        });
      } catch (err: any) {
        if (cancelled) return;
        log(`[StellarWalletConnectQR] Error: ${err.message}`);
        setError(err.message || "Failed to connect via WalletConnect");
      }
    };

    connect();

    return () => {
      cancelled = true;
    };
  }, [stellarConnector]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <PageContent>
        <ModalContent style={{ paddingBottom: 0 }}>
          <ModalH1>Connection Failed</ModalH1>
          <ModalBody>{error}</ModalBody>
          <ButtonRow>
            <Button
              variant="primary"
              onClick={() => {
                setError(null);
                setRoute(ROUTES.STELLAR_CONNECT, {
                  event: "retry-stellar-wc",
                });
              }}
            >
              Try Again
            </Button>
            <Button
              variant="tertiary"
              onClick={() =>
                setRoute(ROUTES.SELECT_METHOD, {
                  event: "click-select-another-method",
                })
              }
            >
              Cancel
            </Button>
          </ButtonRow>
        </ModalContent>
      </PageContent>
    );
  }

  if (!uri) {
    return (
      <PageContent>
        <WalletPaymentSpinner
          logo={<Stellar />}
          logoShape="circle"
          loading={true}
          unavailable={false}
        />
        <ModalContent style={{ paddingBottom: 0 }}>
          <ModalH1>Preparing QR Code</ModalH1>
          <ModalBody>Setting up WalletConnect session...</ModalBody>
        </ModalContent>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <ModalContent style={{ paddingBottom: 0 }}>
        <ModalH1>Scan with {stellarConnector?.name || "Wallet"}</ModalH1>
        <ModalBody>
          Open your wallet app and scan this QR code to connect.
        </ModalBody>
      </ModalContent>
      <QRContainer>
        <QRCode uri={uri} size={240} />
      </QRContainer>
      <ModalContent style={{ paddingTop: 0 }}>
        <Button
          variant="tertiary"
          onClick={() =>
            setRoute(ROUTES.SELECT_METHOD, {
              event: "click-select-another-method",
            })
          }
        >
          Cancel
        </Button>
      </ModalContent>
    </PageContent>
  );
};

const QRContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: center;
`;

export default StellarWalletConnectQR;
