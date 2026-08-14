import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { ROUTES } from "../../../constants/routes";
import { useConnect } from "../../../hooks/useConnect";
import { usePayContext } from "../../../hooks/usePayContext";
import { useWallet } from "../../../wallets/useWallets";
import CopyToClipboard from "../../Common/CopyToClipboard";
import CustomQRCode from "../../Common/CustomQRCode";
import Alert from "../../Common/Alert";
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
 * The connector emits a "display_uri" message on its own `emitter` (wagmi
 * gives every connector a dedicated Emitter<ConnectorEventMap>, wired up in
 * createConfig's setup()) once connect() kicks off the pairing handshake;
 * we grab that URI and render it here.
 */
const ConnectWalletConnect: React.FC = () => {
  const context = usePayContext();
  const { pendingConnectorId, setRoute } = context;
  const wallet = useWallet(pendingConnectorId ?? "");
  const { connect } = useConnect();
  const { isConnected } = useAccount();

  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const connector = wallet?.connector;
    if (!connector) return;

    const listener = (event: { type: string; data?: unknown }) => {
      if (event.type === "display_uri" && typeof event.data === "string") {
        setUri(event.data);
      }
    };
    connector.emitter.on("message", listener);

    connect({
      connector,
      mutation: {
        onError: (err) => setError(err?.message ?? "Failed to connect"),
      },
    });

    return () => {
      connector.emitter.off("message", listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.connector]);

  useEffect(() => {
    if (!isConnected) return;
    setRoute(ROUTES.SELECT_TOKEN, { event: "walletconnect-connected" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  if (!wallet) return <Alert>Connector not found</Alert>;

  return (
    <PageContent>
      <ModalContent style={{ paddingBottom: 8, gap: 14 }}>
        <ModalH1>Scan with WalletConnect</ModalH1>
        <ModalBody>
          Scan this QR code with a WalletConnect-compatible wallet, or copy
          the link below.
        </ModalBody>
        <div style={{ width: "60%", margin: "0 auto" }}>
          <CustomQRCode value={uri ?? undefined} image={wallet.iconConnector} />
        </div>
        {error && <Alert error>{error}</Alert>}
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
