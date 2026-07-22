import React, { useCallback, useMemo, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useStellar } from "../../provider/StellarContextProvider";
import { usePayContext } from "../../hooks/usePayContext";
import { useRozoPay } from "../../hooks/useRozoPay";
import { useWallets, WalletProps } from "../../wallets/useWallets";
import { getRecentWallets, addRecentWallet } from "../../utils/recentWallets";
import { LeftPanel, RightPanel, SectionLabel, WalletItem, NetworkButton } from "./styles";
import CustomQRCode from "../Common/CustomQRCode";
import MobileWithLogos from "../../assets/MobileWithLogos";
import { writeRozoPayOrderID } from "@rozoai/intent-common";

type SelectMethodProps = {
  onWalletSelect: (wallet: { id: string; name: string; method: string }) => void;
};

/**
 * STATE 1: Select Method
 * Left panel: all wallets visible, selected wallet highlighted
 * Right panel: QR code + Launch Extension button
 */
export function SelectMethod({ onWalletSelect }: SelectMethodProps): JSX.Element {
  const context = usePayContext();
  const { order } = useRozoPay();
  const wallets = useWallets();
  const [selectedWallet, setSelectedWallet] = useState<WalletProps | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Get connected state
  const { isConnected: isEthConnected } = useAccount();
  const { connected: isSolanaConnected, select: selectSolanaWallet } = useSolanaWallet();
  const { isConnected: isStellarConnected } = useStellar();

  // Wagmi connect
  const { connectAsync } = useConnect();

  // Get recently used wallets (max 1)
  const recentWallets = useMemo(() => getRecentWallets().slice(0, 1), []);
  const recentWallet = recentWallets[0] ?? null;

  // Categorize wallets
  const allWallets = useMemo(() => {
    return wallets.filter((w) => {
      if (w.id === "otherWallet" || w.id === "mobileWallets") return false;
      return w.isInstalled || w.connector;
    });
  }, [wallets]);

  const otherWallets = useMemo(() => wallets.find((w) => w.id === "otherWallet"), [wallets]);

  // Check if wallet supports multiple chains
  const supportsMultipleChains = useMemo(() => {
    if (!selectedWallet) return false;
    return selectedWallet.solanaConnectorName != null && selectedWallet.connector?.name != null;
  }, [selectedWallet]);

  // Chain constraints from paymentOptions
  const chainConstraints = useMemo(() => {
    const paymentOptions = context.paymentState.payParams?.paymentOptions;
    if (!paymentOptions || paymentOptions.length === 0) {
      return { hasEthereum: true, hasSolana: true, hasStellar: true };
    }
    return {
      hasEthereum: paymentOptions.includes("Ethereum" as any),
      hasSolana: paymentOptions.includes("Solana" as any),
      hasStellar: paymentOptions.includes("Stellar" as any),
    };
  }, [context.paymentState.payParams?.paymentOptions]);

  // Generate QR code URL (similar to ConnectWithQRCode)
  const qrUrl = useMemo(() => {
    const payId = order && /^\d+$/.test(String(order.id))
      ? writeRozoPayOrderID(BigInt(order.id))
      : String(order?.id || "");
    return `https://invoice.rozo.ai/checkout?id=${payId}&mode=wallet`;
  }, [order]);

  // Handle wallet click - just select, don't connect yet
  const handleWalletClick = useCallback((wallet: WalletProps) => {
    setSelectedWallet(wallet);
  }, []);

  // Handle recent wallet click
  const handleRecentWalletClick = useCallback(() => {
    if (!recentWallet) return;
    const wallet = wallets.find((w) => w.name?.toLowerCase().includes(recentWallet.name.toLowerCase()));
    if (wallet) setSelectedWallet(wallet);
  }, [recentWallet, wallets]);

  // Handle "Launch Extension" button
  const handleLaunchExtension = useCallback(async () => {
    if (!selectedWallet?.connector) return;
    setIsConnecting(true);
    try {
      await connectAsync({ connector: selectedWallet.connector });
      addRecentWallet({ name: selectedWallet.name ?? selectedWallet.id, method: "injected" });
      onWalletSelect({ id: selectedWallet.id, name: selectedWallet.name ?? selectedWallet.id, method: "injected" });
    } catch (err) {
      console.error("EVM connect failed:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [selectedWallet, connectAsync, onWalletSelect]);

  // Handle Solana connect
  const handleSolanaConnect = useCallback(async () => {
    if (!selectedWallet?.solanaConnectorName) return;
    setIsConnecting(true);
    try {
      selectSolanaWallet(selectedWallet.solanaConnectorName);
      addRecentWallet({ name: selectedWallet.name ?? selectedWallet.id, method: "solana" });
      onWalletSelect({ id: selectedWallet.id, name: selectedWallet.name ?? selectedWallet.id, method: "solana" });
    } catch (err) {
      console.error("Solana connect failed:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [selectedWallet, selectSolanaWallet, onWalletSelect]);

  // Handle chain selection for multi-chain wallets
  const handleChainSelect = useCallback(async (chain: "evm" | "solana") => {
    if (chain === "evm") {
      await handleLaunchExtension();
    } else {
      await handleSolanaConnect();
    }
  }, [handleLaunchExtension, handleSolanaConnect]);

  // Right panel content
  const renderRightPanel = () => {
    if (!selectedWallet) {
      return (
        <div style={{ textAlign: "center", color: "#999", padding: 40 }}>
          Select a wallet to continue
        </div>
      );
    }

    // Multi-chain wallet - show chain selection
    if (supportsMultipleChains) {
      return (
        <div style={{ width: "100%", maxWidth: 300, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            {selectedWallet.name}
          </div>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
            Choose a network to connect
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <NetworkButton onClick={() => handleChainSelect("evm")}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>Ξ</div>
              <div>Ethereum</div>
              <div style={{ fontSize: 11, color: "#999" }}>Base, Polygon</div>
            </NetworkButton>
            <NetworkButton onClick={() => handleChainSelect("solana")}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>◎</div>
              <div>Solana</div>
            </NetworkButton>
          </div>
        </div>
      );
    }

    // Single chain wallet - show QR + Launch Extension
    return (
      <div style={{ width: "100%", maxWidth: 300, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          {selectedWallet.name}
        </div>

        {/* QR Code */}
        <div style={{ marginBottom: 16 }}>
          <CustomQRCode
            value={qrUrl}
            image={
              <div style={{
                width: "100%",
                height: "100%",
                borderRadius: "22.5%",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--ck-body-background)",
                transform: "scale(1.3) translateY(5%)",
              }}>
                <MobileWithLogos />
              </div>
            }
            imageBackground="var(--ck-body-background)"
          />
          <div style={{ fontSize: 13, color: "#666", marginTop: 12 }}>
            Scan with {selectedWallet.name} mobile app
          </div>
        </div>

        {/* OR divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#e0e0e0" }} />
          <span style={{ fontSize: 12, color: "#999" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "#e0e0e0" }} />
        </div>

        {/* Launch Extension button */}
        {selectedWallet.isInstalled && (
          <button
            onClick={handleLaunchExtension}
            disabled={isConnecting}
            style={{
              width: "100%",
              padding: "12px 24px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              cursor: isConnecting ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {isConnecting ? "Connecting..." : "Launch Extension"}
            <span style={{ fontSize: 12 }}>↗</span>
          </button>
        )}

        {/* Install link if not installed */}
        {!selectedWallet.isInstalled && selectedWallet.downloadUrls?.download && (
          <a
            href={selectedWallet.downloadUrls.download}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              padding: "12px 24px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              textDecoration: "none",
              color: "#333",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Install {selectedWallet.name}
          </a>
        )}
      </div>
    );
  };

  return (
    <>
      <LeftPanel>
        {/* Recently Used */}
        {recentWallet && (
          <>
            <SectionLabel>Recently Used</SectionLabel>
            <WalletItem
              onClick={handleRecentWalletClick}
              $active={selectedWallet?.name?.toLowerCase().includes(recentWallet.name.toLowerCase())}
            >
              {recentWallet.name}
            </WalletItem>
          </>
        )}

        {/* Available */}
        {allWallets.length > 0 && (
          <>
            <SectionLabel>Available</SectionLabel>
            {allWallets.map((wallet) => (
              <WalletItem
                key={wallet.id}
                onClick={() => handleWalletClick(wallet)}
                $active={selectedWallet?.id === wallet.id}
              >
                {wallet.icon && typeof wallet.icon !== 'string' && wallet.icon}
                {wallet.name ?? wallet.id}
                {wallet.isInstalled && <span style={{ fontSize: 11, color: "#999" }}>Installed</span>}
              </WalletItem>
            ))}
          </>
        )}

        {/* Others / WalletConnect */}
        <SectionLabel>Others</SectionLabel>
        <WalletItem
          onClick={() => setSelectedWallet(null)}
          $active={false}
        >
          {otherWallets?.icon && typeof otherWallets.icon !== 'string' && otherWallets.icon}
          WalletConnect
        </WalletItem>
      </LeftPanel>
      <RightPanel>{renderRightPanel()}</RightPanel>
    </>
  );
}
