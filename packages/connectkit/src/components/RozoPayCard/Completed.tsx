import React, { useCallback, useEffect, useState } from "react";
import { getChainExplorerTxUrl } from "@rozoai/intent-common";
import { usePayContext } from "../../hooks/usePayContext";
import { useRozoPay } from "../../hooks/useRozoPay";
import { LeftPanel, RightPanel, SectionLabel, WalletItem } from "./styles";
import { CardTokenOption } from "../../hooks/useCardTokenOptions";

type CompletedProps = {
  selectedWallet: { id: string; name: string; method: string } | null;
  selectedToken: CardTokenOption | null;
  onPayAgain: () => void;
};

/**
 * STATE 4: Completed
 * Left panel: frozen summary (no edits)
 * Right panel: success state with tx hash + status polling
 */
export function Completed({
  selectedWallet,
  selectedToken,
  onPayAgain,
}: CompletedProps): JSX.Element {
  const { paymentState } = usePayContext();
  const { order, paymentState: fsmState } = useRozoPay();
  const [status, setStatus] = useState<"processing" | "completed" | "failed">("processing");

  // Get payment details from order
  const txHash = order && 'sourceStartTxHash' in order 
    ? (order as any).sourceStartTxHash ?? (order as any).payinTransactionHash 
    : undefined;
  const chainId = order && 'destFinalCallTokenAmount' in order
    ? (order as any).destFinalCallTokenAmount?.token?.chainId
    : undefined;
  const explorerUrl = txHash && chainId
    ? getChainExplorerTxUrl(chainId, txHash)
    : undefined;

  // Poll for payment status
  useEffect(() => {
    if (fsmState === "payment_completed") {
      setStatus("completed");
    } else if (fsmState === "payment_bounced") {
      setStatus("failed");
    } else if (fsmState === "payment_started") {
      setStatus("processing");
    }
  }, [fsmState]);

  return (
    <>
      <LeftPanel>
        {/* Frozen wallet summary */}
        {selectedWallet && (
          <>
            <SectionLabel>Wallet</SectionLabel>
            <WalletItem $active>
              {selectedWallet.name}
            </WalletItem>
          </>
        )}

        {/* Frozen token summary */}
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
        <div style={{ width: "100%", maxWidth: 320, textAlign: "center" }}>
          {/* Status icon */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background:
                status === "completed"
                  ? "#22c55e"
                  : status === "failed"
                  ? "#ef4444"
                  : "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            {status === "completed" ? (
              <span style={{ color: "white", fontSize: 32 }}>✓</span>
            ) : status === "failed" ? (
              <span style={{ color: "white", fontSize: 32 }}>✗</span>
            ) : (
              <span style={{ color: "white", fontSize: 32 }}>⏳</span>
            )}
          </div>

          {/* Status message */}
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            {status === "completed"
              ? "Payment Complete"
              : status === "failed"
              ? "Payment Failed"
              : "Processing..."}
          </div>

          <div style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
            {status === "completed"
              ? "Your payment has been confirmed"
              : status === "failed"
              ? "Something went wrong. Please try again."
              : "Waiting for transaction confirmation..."}
          </div>

          {/* Transaction hash */}
          {txHash && (
            <div
              style={{
                background: "#f8f9fa",
                borderRadius: 12,
                padding: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                Transaction
              </div>
              <div style={{ fontSize: 14, fontFamily: "monospace", wordBreak: "break-all" }}>
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#1A88F8", textDecoration: "none" }}
                  >
                    {txHash.slice(0, 10)}...{txHash.slice(-8)} ↗
                  </a>
                ) : (
                  `${txHash.slice(0, 10)}...${txHash.slice(-8)}`
                )}
              </div>
            </div>
          )}

          {/* Status details */}
          <div
            style={{
              background: "#f8f9fa",
              borderRadius: 12,
              padding: 12,
              marginBottom: 20,
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background:
                    status === "processing" || status === "completed"
                      ? "#22c55e"
                      : "#ccc",
                  marginRight: 8,
                }}
              />
              <span style={{ fontSize: 13 }}>Payment sent</span>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: status === "completed" ? "#22c55e" : "#ccc",
                  marginRight: 8,
                }}
              />
              <span style={{ fontSize: 13 }}>Payment confirmed</span>
            </div>
          </div>

          {/* Pay Again button */}
          {status !== "processing" && (
            <button
              onClick={onPayAgain}
              style={{
                width: "100%",
                padding: "14px 24px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "white",
                fontSize: 16,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Pay Again
            </button>
          )}
        </div>
      </RightPanel>
    </>
  );
}
