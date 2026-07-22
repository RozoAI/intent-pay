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
  const {
    kit,
    supportedWallets,
    walletsLoaded,
    hasWalletConnect,
  } = useStellar();

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
            `[ConnectStellar] ${wallet.name} selected (extension: ${wallet.isAvailable})`,
          );

          if (wallet.isAvailable) {
            // Extension installed → use native module directly
            setStellarConnector(wallet);
            setRoute(ROUTES.STELLAR_CONNECTOR, {
              event: "click-stellar-wallet",
              walletName: wallet.name,
            });
          } else if (hasWalletConnect) {
            // Extension NOT installed → route through WalletConnect modal
            // (works for both desktop QR and Freighter Mobile wallet list)
            setStellarConnector({
              ...wallet,
              id: WALLET_CONNECT_ID,
            });
            setRoute(ROUTES.STELLAR_CONNECTOR, {
              event: "click-stellar-wallet-wc",
              walletName: wallet.name,
            });
          }
          // If no WalletConnect module, clicking does nothing (option stays
          // visible but connection is not possible without the extension).
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
  }, [stellarWallets, log, setStellarConnector, setRoute, hasWalletConnect]);

  // Show spinner only while kit is loading or wallets haven't been fetched yet
  if (!kit || !walletsLoaded) {
    return (
      <PageContent>
        <WalletPaymentSpinner
          logo={<Stellar />}
          logoShape="circle"
          loading={true}
          unavailable={false}
        />
      </PageContent>
    );
  }

  return (
    <PageContent>
      {stellarOptions.length === 0 ? (
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
      ) : (
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
    </PageContent>
  );
};

export default ConnectStellar;
