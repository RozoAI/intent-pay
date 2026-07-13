import React, { useEffect, useMemo, useRef } from "react";

import { ROUTES } from "../../../constants/routes";
import { useRozoPay } from "../../../hooks/useRozoPay";
import { usePayContext } from "../../../hooks/usePayContext";
import { WalletConfigProps, walletConfigs } from "../../../wallets/walletConfigs";
import { WALLET_ID_OTHER_WALLET, WalletProps, useWallets } from "../../../wallets/useWallets";
import { ModalContent, PageContent } from "../../Common/Modal/styles";
import { ScrollArea } from "../../Common/ScrollArea";
import { Container, WalletIcon, WalletItem, WalletLabel, WalletList } from "./styles";
import { useConnect } from "../../../hooks/useConnect";
import { useWallet as useSolanaWalletAdapter } from "@solana/wallet-adapter-react";
import { RozoPayOrderMode } from "@rozoai/intent-common";
import useIsMobile from "../../../hooks/useIsMobile";

const MobileConnectors: React.FC = () => {
  const context = usePayContext();
  const { paymentState } = context;
  const { order, hydrateOrder, paymentState: payState } = useRozoPay();
  const { connect } = useConnect();
  const solanaWallets = useSolanaWalletAdapter();
  const { isMobile } = useIsMobile();

  // Mirror Connectors/index.tsx: hydrate order on mount so deeplinks have a payId
  const hasHydratedRef = useRef(false);
  const lastOrderIdRef = useRef<bigint | null>(null);
  const hasCustomDeeplink = order?.metadata?.customDeeplinkUrl != null;

  useEffect(() => {
    if (order?.id !== lastOrderIdRef.current) {
      hasHydratedRef.current = false;
      lastOrderIdRef.current = order?.id ?? null;
    }
    if (
      !hasHydratedRef.current &&
      !paymentState.isDepositFlow &&
      order != null &&
      order.mode !== RozoPayOrderMode.HYDRATED &&
      isMobile &&
      !hasCustomDeeplink
    ) {
      hasHydratedRef.current = true;
      hydrateOrder();
    }
    if (hasCustomDeeplink) hasHydratedRef.current = true;
  }, [paymentState.isDepositFlow, order, isMobile, hasCustomDeeplink]);

  useEffect(() => {
    if (order?.externalId) paymentState.setRozoPaymentId(order.externalId);
  }, [order]);

  // List renders immediately; deeplink taps wait until order is payment_unpaid
  const orderReady = hasCustomDeeplink || payState === "payment_unpaid";

  // Injected wallets (already in-app browser) — connect directly, no deeplink
  const injectedWallets = useWallets(true).filter(
    (w) =>
      w.id !== WALLET_ID_OTHER_WALLET && (w.connector != null || w.solanaConnectorName != null),
  );

  // Deeplink wallets from walletConfigs — filter by showInMobileConnectors + chain eligibility
  const deeplinkWalletIds = useMemo(
    () =>
      Object.keys(walletConfigs)
        .filter((walletId) => {
          const wallet = walletConfigs[walletId];
          if (!wallet.showInMobileConnectors) return false;
          if (wallet.isSolanaOnly && !paymentState.showSolanaPaymentMethod) return false;
          if (wallet.isStellarOnly && !paymentState.showStellarPaymentMethod) return false;
          // Skip if already shown as injected (match by name)
          const nameMatch = injectedWallets.some(
            (iw) =>
              iw.name?.toLowerCase() === wallet.name?.toLowerCase() ||
              iw.shortName?.toLowerCase() === wallet.shortName?.toLowerCase(),
          );
          if (nameMatch) return false;
          return true;
        })
        .sort((a, b) => {
          const nameA = walletConfigs[a].name ?? walletConfigs[a].shortName ?? a;
          const nameB = walletConfigs[b].name ?? walletConfigs[b].shortName ?? b;
          return nameA.localeCompare(nameB);
        }),
    [paymentState.showSolanaPaymentMethod, paymentState.showStellarPaymentMethod, injectedWallets],
  );

  const handleInjectedWallet = (wallet: WalletProps) => {
    if (wallet.connector && wallet.solanaConnectorName) {
      // Dual-chain (e.g. Phantom in-app browser)
      context.setDualChainConnect(true);
      connect({ connector: wallet.connector });
      solanaWallets.select(wallet.solanaConnectorName);
    } else if (wallet.connector) {
      connect({ connector: wallet.connector });
    } else if (wallet.solanaConnectorName) {
      solanaWallets.select(wallet.solanaConnectorName);
    }
  };

  const handleDeeplinkWallet = (wallet: WalletConfigProps) => {
    if (!orderReady) return; // still hydrating — ignore tap
    if (wallet.getRozoPayDeeplink == null) {
      console.error(`wallet ${wallet.name} has no deeplink`);
      return;
    }
    if (paymentState.isDepositFlow) {
      paymentState.setSelectedWallet(wallet);
      context.setRoute(ROUTES.SELECT_WALLET_AMOUNT);
    } else {
      paymentState.openInWalletBrowser({
        wallet,
        customDeeplink: order?.metadata?.customDeeplinkUrl,
      });
    }
  };

  return (
    <PageContent style={{ width: 312 }}>
      <Container>
        <ModalContent style={{ paddingBottom: 0 }}>
          <ScrollArea height={340}>
            <WalletList $disabled={!orderReady}>
              {/* Injected wallets first (already open, connect directly) */}
              {injectedWallets.map((wallet, i) => (
                <WalletItem
                  key={wallet.id}
                  onClick={() => handleInjectedWallet(wallet)}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <WalletIcon>{wallet.iconConnector ?? wallet.icon}</WalletIcon>
                  <WalletLabel>{wallet.shortName ?? wallet.name}</WalletLabel>
                </WalletItem>
              ))}

              {/* Deeplink wallets — alphabetically sorted, pulse while loading */}
              {deeplinkWalletIds.map((walletId, i) => {
                const wallet = walletConfigs[walletId];
                const { name, shortName, iconConnector, icon } = wallet;
                return (
                  <WalletItem
                    key={walletId}
                    onClick={() => handleDeeplinkWallet(wallet)}
                    style={{
                      animationDelay: `${(injectedWallets.length + i) * 50}ms`,
                    }}
                  >
                    <WalletIcon>{iconConnector ?? icon}</WalletIcon>
                    <WalletLabel>{shortName ?? name}</WalletLabel>
                  </WalletItem>
                );
              })}
            </WalletList>
          </ScrollArea>
        </ModalContent>
      </Container>
    </PageContent>
  );
};

export default MobileConnectors;
