import React, { useCallback, useState } from "react";
import { RightPanel } from "./styles";

type OthersSectionProps = {
  onConnect: (wallet: { id: string; name: string; method: string }) => void;
};

/**
 * Others section — shows WalletConnect QR for mobile wallet connections.
 * Simplified version without full Reown AppKit integration.
 */
export function OthersSection({ onConnect }: OthersSectionProps): JSX.Element {
  const [showQR, setShowQR] = useState(false);

  const handleWalletConnect = useCallback(() => {
    // TODO: Generate actual WalletConnect QR code
    // For now, notify parent with WalletConnect method
    setShowQR(true);
  }, []);

  const handleConnectAnyway = useCallback(() => {
    onConnect({
      id: "walletconnect",
      name: "WalletConnect",
      method: "walletconnect",
    });
  }, [onConnect]);

  return (
    <RightPanel>
      {!showQR ? (
        <>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#3B99FC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <span style={{ color: "white", fontSize: 28 }}>W</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              WalletConnect
            </div>
            <div style={{ fontSize: 14, color: "#666" }}>
              Connect with 400+ mobile wallets
            </div>
          </div>

          <button
            onClick={handleWalletConnect}
            style={{
              width: "100%",
              padding: "14px 24px",
              borderRadius: 12,
              border: "none",
              background: "#3B99FC",
              color: "white",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Show QR Code
          </button>
        </>
      ) : (
        <>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Scan with mobile wallet
            </div>
            <div style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
              Open your wallet app and scan this QR code
            </div>

            {/* QR Code placeholder */}
            <div
              style={{
                width: 200,
                height: 200,
                background: "#f0f0f0",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto",
                border: "1px solid #e0e0e0",
              }}
            >
              <div style={{ textAlign: "center", color: "#999" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📱</div>
                <div style={{ fontSize: 12 }}>QR Code</div>
              </div>
            </div>
          </div>

          <button
            onClick={handleConnectAnyway}
            style={{
              width: "100%",
              padding: "14px 24px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              marginBottom: 12,
            }}
          >
            Connect Anyway
          </button>

          <button
            onClick={() => setShowQR(false)}
            style={{
              width: "100%",
              padding: "12px 24px",
              borderRadius: 12,
              border: "none",
              background: "transparent",
              color: "#666",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
        </>
      )}
    </RightPanel>
  );
}
