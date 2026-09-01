import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { ROUTES } from "../../../constants/routes";
import { useConnect } from "../../../hooks/useConnect";
import { useConnectors } from "../../../hooks/useConnectors";
import { usePayContext } from "../../../hooks/usePayContext";
import { useWallet } from "../../../wallets/useWallets";
import CopyToClipboard from "../../Common/CopyToClipboard";
import CustomQRCode from "../../Common/CustomQRCode";
import Alert from "../../Common/Alert";
import Button from "../../Common/Button";
import {
  ModalBody,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../Common/Modal/styles";

/**
 * Desktop-only WalletConnect connect flow: renders our own QR + copyable URI
 * instead of WalletConnect's bundled modal (the "walletConnect" connector is
 * configured with showQrModal: false in defaultConnectors.ts — mobile uses a
 * separate "walletConnectModal" instance with showQrModal: true instead,
 * routed through the generic ConnectUsing page).
 *
 * pendingConnectorId may be either the real "walletConnect" connector id, or a
 * no-extension fallback stub id ("wc-fallback-…"). The connector is always the
 * shared walletConnect one; the stub only drives branding ("Scan with
 * MetaMask" + its logo), since any WC wallet can scan the QR.
 *
 * The connector emits a "display_uri" message on its own `emitter` (wagmi
 * gives every connector a dedicated Emitter<ConnectorEventMap>, wired up in
 * createConfig's setup()) once connect() kicks off the pairing handshake;
 * we grab that URI and render it here.
 */
const ConnectWalletConnect: React.FC = () => {
  const context = usePayContext();
  const { pendingConnectorId, setRoute } = context;
  const brandingWallet = useWallet(pendingConnectorId ?? "");
  const { connect } = useConnect();
  const { isConnected } = useAccount();

  // Resolve the real WC connector regardless of which tile the user clicked.
  const connectors = useConnectors();
  const wcConnector = connectors.find((c) => c.id === "walletConnect");

  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!wcConnector) return;

    setError(null);
    setUri(null);

    const listener = (event: { type: string; data?: unknown }) => {
      if (event.type === "display_uri" && typeof event.data === "string") {
        setUri(event.data);
      }
    };
    wcConnector.emitter.on("message", listener);

    connect({
      connector: wcConnector,
      mutation: {
        onError: (err) => setError(err?.message ?? "Failed to connect"),
      },
    });

    return () => {
      wcConnector.emitter.off("message", listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wcConnector, attempt]);

  // Error Alert changes content height — poke the modal so it re-measures.
  useEffect(() => {
    if (error) setTimeout(context.triggerResize, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  useEffect(() => {
    if (!isConnected) return;
    setRoute(ROUTES.SELECT_TOKEN, { event: "walletconnect-connected" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  if (!wcConnector) return <Alert>Connector not found</Alert>;

  // Branding: fallback stubs carry the wallet's own name/logo; the generic
  // walletConnect tile falls back to WalletConnect branding.
  const title = brandingWallet?.name
    ? `Scan with ${brandingWallet.name}`
    : "Scan with WalletConnect";

  return (
    <PageContent>
      <ModalContent style={{ paddingBottom: 8, gap: 14 }}>
        <ModalH1>{title}</ModalH1>
        <ModalBody>
          Scan this QR code with a WalletConnect-compatible wallet, or copy
          the link below.
        </ModalBody>
        <div style={{ width: "60%", margin: "0 auto" }}>
          <CustomQRCode value={uri ?? undefined} image={brandingWallet?.iconConnector} />
        </div>
        {error && (
          <>
            <Alert error>{error}</Alert>
            <Button
              onClick={() => setAttempt((n) => n + 1)}
              style={{ margin: "0 auto" }}
            >
              Try again
            </Button>
          </>
        )}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CopyToClipboard variant="button" string={uri ?? ""}>
            Copy to clipboard
          </CopyToClipboard>
        </div>
      </ModalContent>
    </PageContent>
  );
};

export default ConnectWalletConnect;
