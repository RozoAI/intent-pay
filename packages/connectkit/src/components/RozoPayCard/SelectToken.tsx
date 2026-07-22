import React, { useCallback, useMemo } from "react";
import { usePayContext } from "../../hooks/usePayContext";
import { useTokenOptions } from "../../hooks/useTokenOptions";
import { ROUTES } from "../../constants/routes";
import {
  LeftPanel,
  RightPanel,
  SectionLabel,
  WalletItem,
} from "./styles";

type SelectTokenProps = {
  selectedWallet: { id: string; name: string; method: string } | null;
  onTokenSelect: (token: any) => void;
  onBack: () => void;
};

/**
 * STATE 2: Select Token
 * Uses useTokenOptions hook (same as RozoPayButton)
 * Left panel: selected wallet info
 * Right panel: token list sorted by balance, disabled if low
 */
export function SelectToken({ selectedWallet, onTokenSelect, onBack }: SelectTokenProps): JSX.Element {
  const { setRoute, paymentState } = usePayContext();

  // Determine token mode based on wallet method
  const tokenMode = useMemo(() => {
    if (selectedWallet?.method === "solana") return "solana";
    if (selectedWallet?.method === "stellar") return "stellar";
    return "evm"; // Default to EVM for injected wallets
  }, [selectedWallet?.method]);

  // Use the SAME hook as RozoPayButton - handles disabled state, sorting, etc.
  const { optionsList, isLoading, refreshOptions } = useTokenOptions(tokenMode as any);

  const handleTokenClick = useCallback(
    (option: any) => {
      if (option.disabled) return; // Don't allow clicking disabled tokens
      onTokenSelect(option);
    },
    [onTokenSelect]
  );

  return (
    <>
      <LeftPanel>
        <WalletItem onClick={onBack}>← Back</WalletItem>

        {selectedWallet && (
          <>
            <SectionLabel>Wallet</SectionLabel>
            <WalletItem $active>
              {selectedWallet.name}
            </WalletItem>
          </>
        )}

        <SectionLabel>Network</SectionLabel>
        <div style={{ fontSize: 14, color: "#666", padding: "10px 12px" }}>
          {tokenMode === "evm" ? "EVM" : tokenMode === "solana" ? "Solana" : "Stellar"}
        </div>
      </LeftPanel>
      <RightPanel>
        <div style={{ width: "100%", maxWidth: 320 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Select token</div>
            <button
              onClick={() => refreshOptions()}
              style={{
                border: "none",
                background: "none",
                color: "#1A88F8",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
              Loading tokens...
            </div>
          ) : optionsList.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
              No tokens found. Make sure your wallet is connected and has a balance.
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {optionsList.map((option) => (
                <TokenOptionItem
                  key={option.id}
                  option={option}
                  onClick={() => handleTokenClick(option)}
                />
              ))}
            </div>
          )}

          {!isLoading && optionsList.length > 0 && (
            <div style={{ fontSize: 12, color: "#999", marginTop: 12, textAlign: "center" }}>
              Sorted by balance
            </div>
          )}
        </div>
      </RightPanel>
    </>
  );
}

/** Token option item - matches RozoPayButton styling */
function TokenOptionItem({
  option,
  onClick,
}: {
  option: any;
  onClick: () => void;
}) {
  const isDisabled = option.disabled;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "12px 16px",
        border: "1px solid #eee",
        borderRadius: 12,
        background: isDisabled ? "#f5f5f5" : "white",
        cursor: isDisabled ? "not-allowed" : "pointer",
        marginBottom: 8,
        textAlign: "left",
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      {/* Token icon */}
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {option.icons?.[0] ?? (
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {option.title?.split(" ")[1]?.slice(0, 2) ?? "??"}
          </span>
        )}
      </div>

      {/* Token info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {option.title}
        </div>
        <div style={{ fontSize: 12, color: isDisabled ? "#dc2626" : "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {option.subtitle}
        </div>
      </div>
    </button>
  );
}
