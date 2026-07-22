import React, { useMemo } from "react";

import {
  ModalContent,
  ModalH1,
  PageContent,
} from "../../../Common/Modal/styles";

import { Stellar } from "../../../../assets/chains";
import { SquircleIcon } from "../../../../assets/logos";
import { ROUTES } from "../../../../constants/routes";
import { usePayContext } from "../../../../hooks/usePayContext";
import { useStellar } from "../../../../provider/StellarContextProvider";
import { WALLET_CONNECT_ID } from "../../../../utils/stellar";
import { OptionsList } from "../../../Common/OptionsList";
import { OrderHeader } from "../../../Common/OrderHeader";
import SelectAnotherMethodButton from "../../../Common/SelectAnotherMethodButton";
import WalletPaymentSpinner from "../../../Spinners/WalletPaymentSpinner";

const ConnectStellar: React.FC = () => {
  const { setStellarConnector, setRoute, log } = usePayContext();
  const { kit, supportedWallets } = useStellar();

  // Detect if we're inside a wallet's in-app browser (e.g. Freighter Mobile).
  // FreighterModule doesn't expose isPlatformWrapper, so we check directly.
  const isFreighterMobilePlatform =
    typeof window !== "undefined" &&
    (window as any).stellar?.provider === "freighter" &&
    (window as any).stellar?.platform === "mobile";

  // Use pre-fetched wallets from context (already loaded by StellarContextProvider)
  const stellarWallets = supportedWallets;

  // Create options list from the fetched wallets
  // Following Solana pattern: only set connector and navigate, let ConnectorStellar handle connection
  const stellarOptions = useMemo(() => {
    const options: Array<{
      id: string;
      title: string;
      icons: JSX.Element[];
      onClick: () => void;
    }> = [];

    // Wallets that should always appear, even if their browser extension is not
    // installed.  When the extension is missing, clicking routes through
    // WalletConnect so the QR modal appears directly — no intermediate wallet
    // picker step.
    const ALWAYS_SHOW = ["freighter", "lobstr"];

    for (const walletId of ALWAYS_SHOW) {
      const wallet = stellarWallets.find((w: any) => w.id === walletId);
      if (!wallet) continue;

      options.push({
        id: wallet.id,
        title: wallet.name
          .toLowerCase()
          .split(" ")
          .map((word: string) =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(" "),
        icons: [
          <SquircleIcon
            key={wallet.id}
            icon={wallet.icon}
            alt={wallet.name}
          />,
        ],
        onClick: () => {
          log(
            `[ConnectStellar] ${wallet.name} selected (extension: ${wallet.isAvailable}, platformWrapper: ${wallet.isPlatformWrapper})`,
          );

          // Platform wrapper: inside Freighter/Lobstr mobile webview.
          // FreighterModule.isPlatformWrapper is undefined, so we detect via
          // window.stellar (same check WalletConnectModule uses).
          const isPlatformWrapper =
            (wallet.id === "freighter" && isFreighterMobilePlatform) ||
            wallet.isPlatformWrapper === true;

          if (wallet.isAvailable) {
            // Extension installed → use native module directly
            setStellarConnector(wallet);
            setRoute(ROUTES.STELLAR_CONNECTOR, {
              event: "click-stellar-wallet",
              walletName: wallet.name,
            });
          } else if (isPlatformWrapper) {
            // Inside a wallet's in-app browser (e.g. Freighter Mobile webview)
            // → show WalletConnect modal (user picks wallet from list)
            setStellarConnector({
              ...wallet,
              id: WALLET_CONNECT_ID,
            });
            setRoute(ROUTES.STELLAR_CONNECTOR, {
              event: "click-stellar-wallet-wc",
              walletName: wallet.name,
            });
          } else {
            // Extension NOT installed, not a platform wrapper → route through
            // WalletConnect with AppKit modal (user picks wallet from list)
            setStellarConnector({
              ...wallet,
              id: WALLET_CONNECT_ID,
            });
            setRoute(ROUTES.STELLAR_CONNECTOR, {
              event: "click-stellar-wallet-wc",
              walletName: wallet.name,
            });
          }
        },
      });
    }

    // Include other available wallets (excluding those already added above)
    stellarWallets
      .filter(
        (wallet: any) => wallet.isAvailable && !ALWAYS_SHOW.includes(wallet.id),
      )
      .forEach((wallet: any) => {
        options.push({
          id: wallet.id,
          title: wallet.name
            .toLowerCase()
            .split(" ")
            .map((word: string) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
            )
            .join(" "),
          icons: [
            <SquircleIcon
              key={wallet.id}
              icon={wallet.icon}
              alt={wallet.name}
            />,
          ],
          onClick: () => {
            log(`[ConnectStellar] Wallet selected: ${wallet.id}`);

            // Set the selected wallet in context (like Solana pattern)
            // The full wallet object is stored so ConnectorStellar can use it
            setStellarConnector(wallet);

            // Navigate to connector page - actual connection happens there
            setRoute(ROUTES.STELLAR_CONNECTOR, {
              event: "click-stellar-wallet",
              walletName: wallet.name,
            });
          },
        });
      });

    return options;
  }, [stellarWallets, log, setStellarConnector, setRoute]);

  return (
    <PageContent>
      {!kit || stellarWallets.length === 0 ? (
        <WalletPaymentSpinner
          logo={<Stellar />}
          logoShape="circle"
          loading={true}
          unavailable={false}
        />
      ) : (
        <>
          {/* No wallets on desktop */}
          {stellarOptions.length === 0 && (
            <ModalContent
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 16,
                paddingBottom: 16,
                gap: 16,
              }}
            >
              <ModalH1>No Stellar wallets detected.</ModalH1>
              <SelectAnotherMethodButton />
            </ModalContent>
          )}

          {/* Show wallet options when not on mobile adapter */}
          {stellarOptions.length > 0 && (
            <>
              <OrderHeader
                minified
                excludeLogos={[
                  "tron",
                  "arbitrum",
                  "optimism",
                  "base",
                  "bsc",
                  "polygon",
                  "solana",
                  "ethereum",
                ]}
              />
              <OptionsList options={stellarOptions} />
            </>
          )}
        </>
      )}
    </PageContent>
  );
};

export default ConnectStellar;
