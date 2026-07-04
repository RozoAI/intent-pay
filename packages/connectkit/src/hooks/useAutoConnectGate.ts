import { useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useStellar } from "../provider/StellarContextProvider";
import { useRozoPay } from "./useRozoPay";

export type AutoConnectGateState = "waiting" | "error" | "ready" | "pass";

/**
 * Derives whether the modal's auto-connect path (wallet already connected on
 * open) is safe to navigate to SELECT_TOKEN. Blocks on two cheap, critical
 * signals — wallet reconnect settled + preview order resolved (from FSM) —
 * while balances load progressively later in SELECT_TOKEN. See
 * docs/superpowers/specs/2026-07-04-wallet-autoconnect-readiness-gate-design.md
 */
export function useAutoConnectGate() {
  const { isConnected: isEthConnected, status: ethStatus } = useAccount();
  const { connected: isSolanaConnected, connecting: isSolanaConnecting } =
    useWallet();
  const { isConnected: isStellarConnected } = useStellar();
  const { paymentState, paymentErrorMessage } = useRozoPay();

  return useMemo(() => {
    const anyWalletConnected =
      isEthConnected || isSolanaConnected || isStellarConnected;

    const walletSettling =
      ethStatus === "reconnecting" ||
      ethStatus === "connecting" ||
      isSolanaConnecting;

    const orderPending = paymentState === "idle";
    const orderError = paymentState === "error";
    const orderReady =
      paymentState === "preview" || paymentState.startsWith("payment_");

    let gateState: AutoConnectGateState;
    if (!anyWalletConnected) {
      gateState = "pass"; // gate inert — caller renders tiles as before
    } else if (walletSettling || orderPending) {
      gateState = "waiting";
    } else if (orderError) {
      gateState = "error";
    } else if (orderReady) {
      gateState = "ready";
    } else {
      // Defensive: unknown/transitional state → wait rather than flash tiles.
      gateState = "waiting";
    }

    return {
      anyWalletConnected,
      walletSettling,
      orderPending,
      orderError,
      orderReady,
      gateState,
      errorMessage: orderError ? paymentErrorMessage : null,
    };
  }, [
    isEthConnected,
    isSolanaConnected,
    isStellarConnected,
    ethStatus,
    isSolanaConnecting,
    paymentState,
    paymentErrorMessage,
  ]);
}
