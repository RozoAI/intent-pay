import React, { useEffect, useMemo, useRef } from "react";
import { ROUTES } from "../../../constants/routes";
import { usePayContext } from "../../../hooks/usePayContext";
import { useAnalytics } from "../../../provider/AnalyticsProvider";
import { ROZO_EVENTS } from "../../../lib/analytics/events";

import { PageContent } from "../../Common/Modal/styles";

import { ExternalPaymentOptions, getAddressContraction } from "@rozoai/intent-common";
import { RozoPayOrderMode } from "@rozoai/intent-common";
import { useRozoPay } from "../../../hooks/useRozoPay";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connector, useAccount, useDisconnect } from "wagmi";
import { Base, Ethereum, Solana, Stellar } from "../../../assets/chains";
import {
  Coinbase,
  Freighter,
  Lobstr,
  MetaMask,
  Phantom,
  Rainbow,
  WalletIcon,
} from "../../../assets/logos";
import { useAutoConnectGate } from "../../../hooks/useAutoConnectGate";
import useIsMobile from "../../../hooks/useIsMobile";
import { useStellar } from "../../../provider/StellarContextProvider";
import { walletConfigs } from "../../../wallets/walletConfigs";
import { Option, OptionsList } from "../../Common/OptionsList";
import { OrderHeader } from "../../Common/OrderHeader";
import PoweredByFooter from "../../Common/PoweredByFooter";
import { Spinner } from "../../Common/Spinner";
import WalletChainLogo from "../../Common/WalletChainLogo";

export default function SelectMethod() {
  const { isMobile } = useIsMobile();

  // EVM
  const { address, chain, isConnected: isEthConnected, connector } = useAccount();

  // Solana
  const {
    connected: isSolanaConnected,
    wallet: solanaWallet,
    disconnect: disconnectSolana,
    publicKey,
  } = useWallet();

  // Stellar
  const {
    connector: stellarConnector,
    isConnected: isStellarConnected,
    disconnect: disconnectStellar,
    publicKey: stellarPublicKey,
    isExternalKit: isStellarExternalKit,
  } = useStellar();

  const { setRoute, paymentState, log, disableMobileInjector, open: modalOpen } = usePayContext();
  const { capture } = useAnalytics();
  const { showSolanaPaymentMethod } = paymentState;
  const { disconnectAsync } = useDisconnect();
  const autoConnectGate = useAutoConnectGate();

  // Eagerly hydrate on mobile so deeplink wallets have a payId ready
  // before the user taps "Pay with wallet".
  const { hydrateOrder, order, paymentState: payState } = useRozoPay();
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
      modalOpen &&
      isMobile &&
      !paymentState.isDepositFlow &&
      !hasCustomDeeplink &&
      order != null &&
      order.mode !== RozoPayOrderMode.HYDRATED &&
      payState !== "payment_unpaid"
    ) {
      hasHydratedRef.current = true;
      hydrateOrder();
    }
    if (hasCustomDeeplink) hasHydratedRef.current = true;
  }, [modalOpen, isMobile, paymentState.isDepositFlow, order, hasCustomDeeplink, payState]);

  const {
    externalPaymentOptions,
    senderEnsName,
    showStellarPaymentMethod,
    payParams,
    connectedWalletOnly,
    depositAddressOptions,
  } = paymentState;

  // Decide whether to show the connected eth account, solana account, or both.
  // Desktop: Always show connected wallets when available
  // Mobile: Only show connected wallets when mobile injector is enabled (!disableMobileInjector)
  const showConnectedEth = useMemo(
    () => isEthConnected && (!isMobile || !disableMobileInjector),
    [isEthConnected, isMobile, disableMobileInjector],
  );
  const showConnectedSolana = useMemo(
    () => isSolanaConnected && (!isMobile || !disableMobileInjector),
    [isSolanaConnected, isMobile, disableMobileInjector],
  );
  const showConnectedStellar = useMemo(
    () => isStellarConnected && (!isMobile || !disableMobileInjector),
    [isStellarConnected, isMobile, disableMobileInjector],
  );

  // Memoize connected wallet options to prevent unnecessary recalculations
  const connectedWalletOptions = useMemo(() => {
    const paymentOptions = payParams?.paymentOptions;

    const showChainLogo =
      (isEthConnected || isSolanaConnected || isStellarConnected) &&
      ((isEthConnected && isSolanaConnected) ||
        (isEthConnected && isStellarConnected) ||
        (isSolanaConnected && isStellarConnected));

    const connectedOptions: Option[] = [];

    if (showConnectedEth) {
      const ethWalletDisplayName =
        senderEnsName ?? (address ? getAddressContraction(address) : "wallet");

      // Prefer icon from walletConfigs if there's a name match, otherwise fall back
      // to the connector-provided icon, and finally to the generic WalletIcon.
      let walletIcon: JSX.Element;

      const matchedConfig = Object.values(walletConfigs).find((cfg) => {
        if (!cfg.name || !connector?.name) return false;
        const cfgName = cfg.name.toLowerCase();
        const connName = connector.name.toLowerCase();
        return cfgName.includes(connName) || connName.includes(cfgName);
      });

      if (matchedConfig?.icon) {
        walletIcon =
          typeof matchedConfig.icon === "string" ? (
            <img src={matchedConfig.icon} alt={matchedConfig.name} />
          ) : (
            (matchedConfig.icon as JSX.Element)
          );
      } else if (connector?.icon) {
        walletIcon = (
          <div style={{ borderRadius: "22.5%", overflow: "hidden" }}>
            <img src={connector.icon} alt={connector.name} />
          </div>
        );
      } else {
        walletIcon = <WalletIcon />;
      }

      const connectedEthWalletOption = {
        id: "connectedWallet",
        title: `Pay with ${ethWalletDisplayName}`,
        icons: [
          <WalletChainLogo
            key="eth"
            walletIcon={walletIcon}
            walletName={connector?.name || "Wallet"}
            chainLogo={showChainLogo ? <Ethereum /> : null}
          />,
        ],
        onClick: () => {
          capture(ROZO_EVENTS.PAYMENT_METHOD_SELECTED, {
            field: "chain",
            value: "evm",
            wallet_id: connector?.id,
          });
          capture(ROZO_EVENTS.WALLET_CONNECTED, {
            wallet_id: connector?.id,
            chain_type: "evm",
            chain: chain?.id,
          });
          paymentState.setTokenMode("evm");
          setRoute(ROUTES.SELECT_TOKEN, {
            event: "click-wallet",
            walletId: connector?.id,
            address: address,
          });
        },
      };

      // Include if paymentOptions is undefined (all allowed) or includes Ethereum
      if (paymentOptions == null || paymentOptions.includes(ExternalPaymentOptions.Ethereum)) {
        connectedOptions.push(connectedEthWalletOption);
      }
    }

    if (showConnectedSolana && showSolanaPaymentMethod) {
      const solWalletDisplayName = getAddressContraction(publicKey?.toBase58() ?? "");

      // Prefer icon from walletConfigs if available
      let solWalletIcon: React.ReactNode;
      const solMatchedConfig = Object.values(walletConfigs).find((cfg) => {
        if (!cfg.name) return false;
        const cfgName = cfg.name.toLowerCase();
        const solName = solanaWallet?.adapter.name.toLowerCase() || "";
        return cfgName.includes(solName) || solName.includes(cfgName);
      });

      if (solMatchedConfig?.icon) {
        solWalletIcon =
          typeof solMatchedConfig.icon === "string" ? (
            <img src={solMatchedConfig.icon} alt={solMatchedConfig.name} />
          ) : (
            (solMatchedConfig.icon as JSX.Element)
          );
      } else if (solanaWallet?.adapter.icon) {
        solWalletIcon = solanaWallet.adapter.icon;
      } else {
        solWalletIcon = <Solana />;
      }

      const connectedSolWalletOption = {
        id: "connectedSolanaWallet",
        title: `Pay with ${solWalletDisplayName}`,
        icons: [
          <WalletChainLogo
            key="sol-wallet"
            walletIcon={solWalletIcon}
            walletName={solanaWallet?.adapter.name || "Wallet"}
            chainLogo={showChainLogo && <Solana />}
          />,
        ],
        onClick: () => {
          capture(ROZO_EVENTS.PAYMENT_METHOD_SELECTED, {
            field: "chain",
            value: "solana",
            wallet_id: solanaWallet?.adapter.name,
          });
          capture(ROZO_EVENTS.WALLET_CONNECTED, {
            wallet_id: solanaWallet?.adapter.name,
            chain_type: "solana",
          });
          paymentState.setTokenMode("solana");
          setRoute(ROUTES.SELECT_TOKEN, {
            event: "click-wallet",
            walletId: solanaWallet?.adapter.name,
            chainId: "solana",
            address: publicKey?.toBase58(),
          });
        },
      };

      // Include if paymentOptions is undefined (all allowed) or includes Solana
      if (paymentOptions == null || paymentOptions.includes(ExternalPaymentOptions.Solana)) {
        connectedOptions.push(connectedSolWalletOption);
      }
    }

    if (showConnectedStellar) {
      const stellarWalletDisplayName = getAddressContraction(stellarPublicKey ?? "");

      const connectedStellarWalletOption = {
        id: "connectedStellarWallet",
        title: `Pay with ${stellarWalletDisplayName}`,
        icons: stellarConnector?.icon
          ? [
              <WalletChainLogo
                key="stellar-wallet"
                walletIcon={stellarConnector.icon}
                walletName={stellarConnector.name}
                chainLogo={<Stellar />}
              />,
            ]
          : [
              <WalletChainLogo
                key="stellar-wallet"
                walletIcon={<Stellar />}
                walletName="Default wallet icon"
                chainLogo={<Stellar />}
              />,
            ],
        onClick: () => {
          capture(ROZO_EVENTS.PAYMENT_METHOD_SELECTED, {
            field: "chain",
            value: "stellar",
            wallet_id: stellarConnector?.id,
          });
          capture(ROZO_EVENTS.WALLET_CONNECTED, {
            wallet_id: stellarConnector?.id,
            chain_type: "stellar",
          });
          paymentState.setTokenMode("stellar");
          setRoute(ROUTES.SELECT_TOKEN, {
            event: "click-wallet",
            walletId: stellarConnector?.id,
            chainId: "stellar",
            address: stellarPublicKey,
          });
        },
      };

      // Include if paymentOptions is undefined (all allowed) or includes Stellar
      if (paymentOptions == null || paymentOptions.includes(ExternalPaymentOptions.Stellar)) {
        connectedOptions.push(connectedStellarWalletOption);
      }
    }

    return connectedOptions;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paymentState,
    showConnectedEth,
    showConnectedSolana,
    showConnectedStellar,
    isEthConnected,
    isSolanaConnected,
    isStellarConnected,
    showSolanaPaymentMethod,
    address,
    senderEnsName,
    connector?.id,
    connector?.name,
    connector?.icon,
    chain?.id,
    publicKey,
    solanaWallet?.adapter.name,
    solanaWallet?.adapter.icon,
    stellarPublicKey,
    stellarConnector?.id,
    stellarConnector?.name,
    stellarConnector?.icon,
    payParams?.paymentOptions,
    // paymentState.setTokenMode,
    // setRoute,
  ]);

  // Memoize all options to prevent unnecessary recalculations
  const allOptions = useMemo(() => {
    const options: Option[] = [];
    options.push(...connectedWalletOptions);

    if (!connectedWalletOnly) {
      // Pay with another wallet
      const unconnectedWalletOption = {
        id: "unconnectedWallet",
        title:
          isEthConnected || isSolanaConnected || isStellarConnected
            ? `Pay with another wallet`
            : `Pay with wallet`,
        icons: getBestUnconnectedWalletIcons(connector, isMobile),
        onClick: async () => {
          capture(ROZO_EVENTS.PAYMENT_METHOD_SELECTED, {
            field: "chain",
            value: "unconnected_wallet",
          });
          if (isEthConnected) {
            capture(ROZO_EVENTS.WALLET_DISCONNECTED, {
              wallet_id: connector?.id,
              chain_type: "evm",
            });
          }
          if (isSolanaConnected) {
            capture(ROZO_EVENTS.WALLET_DISCONNECTED, {
              wallet_id: solanaWallet?.adapter.name,
              chain_type: "solana",
            });
          }
          if (isStellarConnected && !isStellarExternalKit) {
            capture(ROZO_EVENTS.WALLET_DISCONNECTED, {
              wallet_id: stellarConnector?.id,
              chain_type: "stellar",
            });
          }
          await disconnectAsync();
          await disconnectSolana();
          if (!isStellarExternalKit) await disconnectStellar();
          setRoute(isMobile ? ROUTES.MOBILECONNECTORS : ROUTES.CONNECTORS);
        },
      };
      options.push(unconnectedWalletOption);

      // Pay with Deposit Address
      // Hide if paymentOptions exists and contains ONLY Stellar
      const paymentOptions = payParams?.paymentOptions;
      const isOnlyStellar =
        paymentOptions &&
        paymentOptions.length === 1 &&
        paymentOptions.includes(ExternalPaymentOptions.Stellar);

      if (
        !isOnlyStellar &&
        (depositAddressOptions.options.length > 0 || depositAddressOptions.loading)
      ) {
        const base = getDepositAddressOption(setRoute, payParams?.appId);
        options.push({
          ...base,
          disabled: depositAddressOptions.loading,
          loading: depositAddressOptions.loading,
          onClick: () => {
            capture(ROZO_EVENTS.PAYMENT_METHOD_SELECTED, {
              field: "chain",
              value: "deposit_address",
            });
            base.onClick();
          },
        });
      }
    }

    // Hide "Pay with Stellar" when consumer owns the kit and already has a wallet
    // connected — the shared kit instance means connecting a new wallet here would
    // silently replace their app's stellar session. The "Pay with [addr]" option above already covers this case.
    const showStellarOption =
      showStellarPaymentMethod && !(isStellarExternalKit && isStellarConnected);

    if (showStellarOption) {
      options.push({
        id: "stellar",
        title: "Pay with Stellar",
        icons: getStellarWalletIcons(),
        onClick: async () => {
          capture(ROZO_EVENTS.PAYMENT_METHOD_SELECTED, {
            field: "chain",
            value: "stellar",
          });
          await disconnectAsync();
          await disconnectSolana();
          if (!isStellarExternalKit) await disconnectStellar();
          setRoute(ROUTES.STELLAR_CONNECT);
        },
      });
    }

    // Pay with Exchange
    // const exchangeOptions = externalPaymentOptions.options.get("exchange") ?? [];

    // const showExchangePaymentMethod = exchangeOptions.length > 0;
    // if (showExchangePaymentMethod) {
    //   options.push({
    //     id: "exchange",
    //     title: "Pay with exchange",
    //     icons: exchangeOptions.slice(0, 3).map((option) => option.logoURI),
    //     onClick: () => {
    //       setRoute(ROUTES.SELECT_EXCHANGE, {
    //         event: "click-option",
    //         option: "exchange",
    //       });
    //     },
    //   });
    // }

    // ZKP2P is currently only available on desktop. Check if the user is on
    // desktop and if any ZKP2P options are available.
    const zkp2pOptions = externalPaymentOptions.options.get("zkp2p") ?? [];
    const showZkp2pPaymentMethod = !isMobile && zkp2pOptions.length > 0;
    if (showZkp2pPaymentMethod) {
      options.push({
        id: "ZKP2P",
        title: "Pay via payment app",
        icons: zkp2pOptions.slice(0, 2).map((option) => option.logoURI),
        onClick: () => {
          setRoute(ROUTES.SELECT_ZKP2P);
        },
      });
    }

    // Order disabled to bottom, but keep depositAddress in place (shows loading state)
    options.sort((a, b) => {
      if (a.id === "depositAddress" || b.id === "depositAddress") return 0;
      return (a.disabled ? 1 : 0) - (b.disabled ? 1 : 0);
    });

    return options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    connectedWalletOptions,
    connectedWalletOnly,
    isEthConnected,
    isSolanaConnected,
    isStellarConnected,
    connector,
    isMobile,
    // disconnectAsync,
    // disconnectSolana,
    // disconnectStellar,
    // setRoute,
    payParams?.appId,
    showStellarPaymentMethod,
    externalPaymentOptions.options,
  ]);

  log(
    `[SELECT_METHOD] loading: ${
      externalPaymentOptions.loading
    }, options: ${JSON.stringify(externalPaymentOptions.options)}`,
  );

  // Wallet connected but reconnect/order not settled yet: show the reused
  // spinner instead of flashing method tiles. The modal's auto-navigate effect
  // moves us to SELECT_TOKEN (or ERROR) once the gate resolves.
  if (autoConnectGate.gateState === "waiting") {
    return (
      <PageContent>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 120,
          }}
        >
          <Spinner />
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <OrderHeader excludeLogos={["tron", "arbitrum", "optimism", "stellar"]} />
      <OptionsList
        requiredSkeletons={isMobile ? 4 : 3} // TODO: programmatically determine skeletons to best avoid layout shifts
        isLoading={externalPaymentOptions.loading}
        options={externalPaymentOptions.loading ? [] : allOptions}
      />
      <PoweredByFooter />
    </PageContent>
  );
}

function getStellarWalletIcons() {
  return [
    <Stellar key="stellar" />,
    <Freighter key="freighter" />,
    <Lobstr key="lobstr" />,
    // <HotWallet key="hot-wallet" />,
    // <WalletConnect key="walletconnect" />,
  ];
}

// Get 3 icons, skipping the one that is already connected
function getBestUnconnectedWalletIcons(connector: Connector | undefined, isMobile: boolean) {
  const icons: JSX.Element[] = [];
  const strippedId = connector?.id.toLowerCase(); // some connector ids can have weird casing and or suffixes and prefixes
  const [isPhantom, isCoinbase, isMetamask, isRainbow] = [
    strippedId?.includes("phantom"),
    strippedId?.includes("coinbase"),
    strippedId?.includes("metamask"),
    strippedId?.includes("rainbow"),
  ];

  if (isMobile) {
    if (!isCoinbase) icons.push(<Coinbase />);
    if (!isPhantom) icons.push(<Phantom />);
    if (!isMetamask) icons.push(<MetaMask />);
  } else {
    if (!isCoinbase) icons.push(<Coinbase />);
    if (!isPhantom) icons.push(<Phantom />);
    if (!isMetamask) icons.push(<MetaMask />);
    if (!isRainbow && icons.length < 3) icons.push(<Rainbow />);
  }

  return icons;
}

function getDepositAddressOption(
  setRoute: (route: ROUTES, data?: Record<string, any>) => void,
  appId?: string,
) {
  return {
    id: "depositAddress",
    title: "Pay to address",
    icons: [<Base key="base" />, <Solana key="solana" />, <Ethereum key="ethereum" />],
    onClick: () => {
      setRoute(ROUTES.SELECT_DEPOSIT_ADDRESS_CHAIN);
    },
  };
}
