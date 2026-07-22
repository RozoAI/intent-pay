import React, { useCallback, useState } from "react";
import { usePayContext } from "../../hooks/usePayContext";
import { useRozoPay } from "../../hooks/useRozoPay";
import { LeftPanel, RightPanel, SectionLabel, WalletItem } from "./styles";
import { CardTokenOption } from "../../hooks/useCardTokenOptions";

type ConfirmationProps = {
  selectedWallet: { id: string; name: string; method: string } | null;
  selectedToken: CardTokenOption | null;
  onBack: () => void;
  onConfirm: () => void;
  onError: (error: string) => void;
};

/**
 * STATE 3: Confirmation
 * Left panel: wallet + token summary
 * Right panel: payment breakdown + Approve & Pay button
 */
export function Confirmation({
  selectedWallet,
  selectedToken,
  onBack,
  onConfirm,
  onError,
}: ConfirmationProps): JSX.Element {
  const { paymentState, log } = usePayContext();
  const { order, setPaymentUnpaid, paymentState: fsmState } = useRozoPay();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get payment details from order
  const recipient = (order?.metadata as any)?.merchantName ?? "Merchant";

  const handleApproveAndPay = useCallback(async () => {
    if (!selectedToken) {
      setError("No token selected");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      log?.("[RozoPayCard] Starting payment with token:", selectedToken.symbol);

      // Set the selected token option in payment state based on network
      if (selectedToken.network === "evm") {
        paymentState.setSelectedTokenOption(selectedToken.walletOption);
      } else if (selectedToken.network === "solana") {
        paymentState.setSelectedSolanaTokenOption(selectedToken.walletOption);
      } else if (selectedToken.network === "stellar") {
        paymentState.setSelectedStellarTokenOption(selectedToken.walletOption);
      }

      // Set token mode based on network
      paymentState.setTokenMode(selectedToken.network);

      // For EVM: trigger the payment flow via PayWithToken
      // For Solana/Stellar: trigger via respective payment flows
      // The actual payment execution happens in the PayWithToken/SolanaPay/StellarPay components
      // Here we just transition to the waiting state

      log?.("[RozoPayCard] Payment initiated, transitioning to completed");

      // Notify parent that payment is confirmed (will trigger state transition)
      onConfirm();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Payment failed";
      log?.("[RozoPayCard] Payment error:", errorMessage);
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedToken, paymentState, log, onConfirm, onError]);

  return (
    <>
      <LeftPanel>
        {/* Back button */}
        <WalletItem onClick={onBack}>
          ← Back
        </WalletItem>

        {/* Wallet summary */}
        {selectedWallet && (
          <>
            <SectionLabel>Wallet</SectionLabel>
            <WalletItem $active>
              {selectedWallet.name}
            </WalletItem>
          </>
        )}

        {/* Token summary */}
        {selectedToken && (
          <>
            <SectionLabel>Token</SectionLabel>
            <WalletItem $active>
              {selectedToken.symbol} ({selectedToken.chainName})
            </WalletItem>
          </>
        )}
      </LeftPanel>
      <RightPanel>
        <div style={{ width: "100%", maxWidth: 320 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, textAlign: "center" }}>
            Confirm Payment
          </div>

          {/* Payment breakdown */}
          <div
            style={{
              background: "#f8f9fa",
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#666" }}>You pay</span>
              <span style={{ fontWeight: 500 }}>
                {selectedToken?.balanceFormatted ?? "0"} {selectedToken?.symbol ?? "USDC"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#666" }}>Network</span>
              <span style={{ fontWeight: 500 }}>{selectedToken?.chainName ?? "Ethereum"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#666" }}>USD Value</span>
              <span style={{ fontWeight: 500 }}>
                ${selectedToken?.usdValue.toFixed(2) ?? "0.00"}
              </span>
            </div>
            <div
              style={{
                borderTop: "1px solid #e0e0e0",
                paddingTop: 8,
                marginTop: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#666" }}>To</span>
                <span style={{ fontWeight: 500 }}>{recipient}</span>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
                color: "#dc2626",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          {/* Approve & Pay button */}
          <button
            onClick={handleApproveAndPay}
            disabled={isProcessing}
            style={{
              width: "100%",
              padding: "14px 24px",
              borderRadius: 12,
              border: "none",
              background: isProcessing ? "#ccc" : "#1A88F8",
              color: "white",
              fontSize: 16,
              fontWeight: 600,
              cursor: isProcessing ? "not-allowed" : "pointer",
            }}
          >
            {isProcessing ? "Processing..." : "Approve & Pay"}
          </button>

          <div
            style={{
              fontSize: 12,
              color: "#999",
              marginTop: 12,
              textAlign: "center",
            }}
          >
            You'll be asked to approve the transaction in your wallet
          </div>
        </div>
      </RightPanel>
    </>
  );
}
