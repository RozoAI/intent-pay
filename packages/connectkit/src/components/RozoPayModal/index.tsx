import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";

import { ROUTES } from "../../constants/routes";
import { getAppName } from "../../defaultConfig";
import { useAutoConnectGate } from "../../hooks/useAutoConnectGate";
import { useChainIsSupported } from "../../hooks/useChainIsSupported";
import { useRozoPay } from "../../hooks/useRozoPay";
import useIsMobile from "../../hooks/useIsMobile";
import { usePayContext } from "../../hooks/usePayContext";
import { useStellar } from "../../provider/StellarContextProvider";
import { CustomTheme, Languages, Mode, Theme } from "../../types";
import { IntercomInitializer } from "../Common/Intercom";
import Modal from "../Common/Modal";
import { RozoPayThemeProvider } from "../RozoPayThemeProvider/RozoPayThemeProvider";
import About from "../Pages/About";
import Confirmation from "../Pages/Confirmation";
import Connectors from "../Pages/Connectors";
import DownloadApp from "../Pages/DownloadApp";
import ErrorPage from "../Pages/Error";
import MobileConnectors from "../Pages/MobileConnectors";
import Onboarding from "../Pages/Onboarding";
import PayWithToken from "../Pages/PayWithToken";
import SelectAmount from "../Pages/SelectAmount";
import SelectDepositAddressAmount from "../Pages/SelectDepositAddressAmount";
import SelectDepositAddressChain from "../Pages/SelectDepositAddressChain";
import SelectExchange from "../Pages/SelectExchange";
import SelectExternalAmount from "../Pages/SelectExternalAmount";
import SelectMethod from "../Pages/SelectMethod";
import SelectToken from "../Pages/SelectToken";
import SelectWalletAmount from "../Pages/SelectWalletAmount";
import SelectWalletChain from "../Pages/SelectWalletChain";
import SelectZKP from "../Pages/SelectZKP";
import ConnectorSolana from "../Pages/Solana/ConnectorSolana";
import PayWithSolanaToken from "../Pages/Solana/PayWithSolanaToken";
import SelectSolanaAmount from "../Pages/Solana/SelectSolanaAmount";
import ConnectorStellar from "../Pages/Stellar/ConnectorStellar";
import ConnectStellar from "../Pages/Stellar/ConnectStellar";
import PayWithStellarToken from "../Pages/Stellar/PayWithStellarToken";
import SelectStellarAmount from "../Pages/Stellar/SelectStellarAmount";
import SwitchNetworks from "../Pages/SwitchNetworks";
import WaitingDepositAddress from "../Pages/WaitingDepositAddress";
import WaitingExternal from "../Pages/WaitingExternal";
import WaitingWallet from "../Pages/WaitingWallet";
import ConnectUsing from "./ConnectUsing";

export const RozoPayModal: React.FC<{
  mode: Mode;
  theme: Theme;
  customTheme: CustomTheme;
  lang: Languages;
  disableMobileInjector: boolean;
}> = ({
  mode,
  theme,
  customTheme,
  lang,
  disableMobileInjector,
}: {
  mode: Mode;
  theme: Theme;
  customTheme: CustomTheme;
  lang: Languages;
  disableMobileInjector: boolean;
}) => {
  const context = usePayContext();
  const { setMode, setTheme, setCustomTheme, setLang, setDisableMobileInjector } = context;
  const paymentState = context.paymentState;
  const {
    generatePreviewOrder,
    isDepositFlow,
    solanaPaymentEligible,
    stellarPaymentEligible,
    setPaymentWaitingMessage,
    setSelectedExternalOption,
    setSelectedTokenOption,
    setSelectedSolanaTokenOption,
    setSelectedStellarTokenOption,
    setSelectedDepositAddressOption,
    setSelectedWallet,
  } = paymentState;
  const { paymentState: paymentFsmState } = useRozoPay();
  const autoConnectGate = useAutoConnectGate();

  // EVM
  const { isConnected: isEthConnected, connector, chain, address } = useAccount();

  // Solana
  const { connected: isSolanaConnected, wallet: solanaWallet } = useWallet();

  // Stellar
  const { isConnected: isStellarConnected } = useStellar();

  const chainIsSupported = useChainIsSupported(chain?.id);

  //if chain is unsupported we enforce a "switch chain" prompt
  const closeable = !(
    context.options?.enforceSupportedChains &&
    isEthConnected &&
    !chainIsSupported
  );

  const showBackButton =
    closeable &&
    context.route !== ROUTES.SELECT_METHOD &&
    context.route !== ROUTES.CONFIRMATION &&
    context.route !== ROUTES.SELECT_TOKEN &&
    context.route !== ROUTES.ERROR &&
    paymentFsmState !== "error";

  const onBack = () => {
    const meta = { event: "click-back" };
    if (context.route === ROUTES.DOWNLOAD) {
      context.setRoute(ROUTES.CONNECT, meta);
    } else if (context.route === ROUTES.CONNECTORS) {
      context.setRoute(ROUTES.SELECT_METHOD, meta);
    } else if (context.route === ROUTES.SELECT_AMOUNT) {
      setSelectedTokenOption(undefined);
      context.setRoute(ROUTES.SELECT_TOKEN, meta);
    } else if (context.route === ROUTES.SELECT_EXTERNAL_AMOUNT) {
      setSelectedExternalOption(undefined);
      context.setRoute(ROUTES.SELECT_METHOD, meta);
    } else if (context.route === ROUTES.SELECT_DEPOSIT_ADDRESS_AMOUNT) {
      setSelectedDepositAddressOption(undefined);
      context.setRoute(ROUTES.SELECT_DEPOSIT_ADDRESS_CHAIN, meta);
    } else if (context.route === ROUTES.SELECT_ZKP2P) {
      context.setRoute(ROUTES.SELECT_METHOD, meta);
    } else if (context.route === ROUTES.WAITING_EXTERNAL) {
      setPaymentWaitingMessage(undefined);
      if (isDepositFlow) {
        generatePreviewOrder();
        context.setRoute(ROUTES.SELECT_EXTERNAL_AMOUNT, meta);
      } else {
        setSelectedExternalOption(undefined);
        context.setRoute(ROUTES.SELECT_METHOD, meta);
      }
    } else if (context.route === ROUTES.PAY_WITH_TOKEN) {
      if (isDepositFlow) {
        generatePreviewOrder();
        context.setRoute(ROUTES.SELECT_AMOUNT, meta);
      } else {
        if (paymentState.payParams) {
          generatePreviewOrder();
        }
        setSelectedTokenOption(undefined);
        context.setRoute(ROUTES.SELECT_TOKEN, meta);
      }
    } else if (context.route === ROUTES.ONBOARDING) {
      context.setRoute(ROUTES.CONNECTORS, meta);
    } else if (context.route === ROUTES.WAITING_DEPOSIT_ADDRESS) {
      if (isDepositFlow) {
        if (paymentState.selectedDepositAddressOption === undefined) {
          context.setRoute(ROUTES.SELECT_DEPOSIT_ADDRESS_CHAIN, meta);
        } else {
          generatePreviewOrder();
          context.setRoute(ROUTES.SELECT_DEPOSIT_ADDRESS_AMOUNT, meta);
        }
      } else {
        setSelectedDepositAddressOption(undefined);
        context.setRoute(ROUTES.SELECT_DEPOSIT_ADDRESS_CHAIN, meta);
      }
    } else if (context.route === ROUTES.WAITING_WALLET) {
      if (isDepositFlow) {
        generatePreviewOrder();
        context.setRoute(ROUTES.SELECT_WALLET_AMOUNT, meta);
      } else {
        setSelectedWallet(undefined);
        context.setRoute(ROUTES.SELECT_METHOD, meta);
      }
    } else if (context.route === ROUTES.SOLANA_SELECT_AMOUNT) {
      setSelectedSolanaTokenOption(undefined);
      context.setRoute(ROUTES.SELECT_TOKEN, meta);
    } else if (context.route === ROUTES.SOLANA_PAY_WITH_TOKEN) {
      if (isDepositFlow) {
        generatePreviewOrder();
        context.setRoute(ROUTES.SOLANA_SELECT_AMOUNT, meta);
      } else {
        if (paymentState.payParams) {
          generatePreviewOrder();
        }
        setSelectedSolanaTokenOption(undefined);
        context.setRoute(ROUTES.SELECT_TOKEN, meta);
      }
    } else if (context.route === ROUTES.STELLAR_SELECT_AMOUNT) {
      setSelectedStellarTokenOption(undefined);
      context.setRoute(ROUTES.SELECT_TOKEN, meta);
    } else if (context.route === ROUTES.STELLAR_PAY_WITH_TOKEN) {
      if (isDepositFlow) {
        generatePreviewOrder();
        context.setRoute(ROUTES.STELLAR_SELECT_AMOUNT, meta);
      } else {
        if (paymentState.payParams) {
          generatePreviewOrder();
        }
        setSelectedStellarTokenOption(undefined);
        context.setRoute(ROUTES.SELECT_TOKEN, meta);
      }
    } else if (context.route === ROUTES.SELECT_WALLET_CHAIN) {
      setSelectedWallet(undefined);
      context.setRoute(ROUTES.CONNECTORS, meta);
    } else {
      context.setRoute(ROUTES.SELECT_METHOD, meta);
    }
  };

  const pages: Record<ROUTES, React.ReactNode> = {
    [ROUTES.SELECT_METHOD]: <SelectMethod />,
    [ROUTES.SELECT_TOKEN]: <SelectToken />,
    [ROUTES.SELECT_AMOUNT]: <SelectAmount />,
    [ROUTES.SELECT_EXTERNAL_AMOUNT]: <SelectExternalAmount />,
    [ROUTES.SELECT_EXCHANGE]: <SelectExchange />,
    [ROUTES.SELECT_DEPOSIT_ADDRESS_AMOUNT]: <SelectDepositAddressAmount />,
    [ROUTES.SELECT_WALLET_AMOUNT]: <SelectWalletAmount />,
    [ROUTES.SELECT_WALLET_CHAIN]: <SelectWalletChain />,
    [ROUTES.WAITING_EXTERNAL]: <WaitingExternal />,
    [ROUTES.SELECT_DEPOSIT_ADDRESS_CHAIN]: <SelectDepositAddressChain />,
    [ROUTES.WAITING_DEPOSIT_ADDRESS]: <WaitingDepositAddress />,
    [ROUTES.SELECT_ZKP2P]: <SelectZKP />,
    [ROUTES.WAITING_WALLET]: <WaitingWallet />,
    [ROUTES.CONFIRMATION]: <Confirmation />,
    [ROUTES.ERROR]: <ErrorPage />,
    [ROUTES.PAY_WITH_TOKEN]: <PayWithToken />,
    [ROUTES.SOLANA_CONNECTOR]: <ConnectorSolana />,
    [ROUTES.SOLANA_SELECT_AMOUNT]: <SelectSolanaAmount />,
    [ROUTES.SOLANA_PAY_WITH_TOKEN]: <PayWithSolanaToken />,

    [ROUTES.STELLAR_CONNECT]: <ConnectStellar />,
    [ROUTES.STELLAR_CONNECTOR]: <ConnectorStellar />,
    [ROUTES.STELLAR_SELECT_AMOUNT]: <SelectStellarAmount />,
    [ROUTES.STELLAR_PAY_WITH_TOKEN]: <PayWithStellarToken />,
    // Unused routes. Kept to minimize connectkit merge conflicts.
    [ROUTES.ONBOARDING]: <Onboarding />,
    [ROUTES.ABOUT]: <About />,
    [ROUTES.DOWNLOAD]: <DownloadApp />,
    [ROUTES.CONNECTORS]: <Connectors />,
    [ROUTES.MOBILECONNECTORS]: <MobileConnectors />,
    [ROUTES.CONNECT]: <ConnectUsing />,
    [ROUTES.SWITCHNETWORKS]: <SwitchNetworks />,
  };

  function hide() {
    if (isDepositFlow) {
      generatePreviewOrder();
    }
    context.setOpen(false, { event: "click-close" });
  }
  const { isMobile } = useIsMobile();
  const { connect } = useConnect();
  const connectors = useConnectors();

  // On deeplink open, only Solana auto-connects via wallet-standard.
  // EVM needs an explicit connect() — the wallet silently approves it inside
  // its own in-app browser (works for Phantom, Backpack, and any wallet that
  // injects both EVM and Solana providers).
  useEffect(() => {
    if (!isMobile) return;
    if (!context.open) return;
    if (isEthConnected) return;
    if (!isSolanaConnected) return;
    const solanaName = solanaWallet?.adapter.name.toLowerCase();
    if (!solanaName) return;
    // Find the injected EVM connector whose name matches the connected Solana wallet
    const injected = connectors.find(
      (c) => c.type === "injected" && c.name.toLowerCase().includes(solanaName),
    );
    if (!injected) return;
    connect({ connector: injected });
  }, [context.open, isEthConnected, isSolanaConnected, isMobile, solanaWallet, connectors, connect]);

  // If the user has a wallet already connected upon opening the modal, go
  // straight to the select token screen.
  // Gated on wagmi reconnect and Solana autoConnect completing first —
  // both are async and start false, causing a flash of SELECT_METHOD if we
  // navigate before they settle.
  useEffect(() => {
    if (!context.open) return;
    if (context.route !== ROUTES.SELECT_METHOD) return;

    // Only auto-navigate on initial open, not when the user explicitly
    // navigated back to SELECT_METHOD from SELECT_TOKEN.
    const isExplicitBackNavigation = context.routeMeta?.event === "click-select-another-method";
    if (isExplicitBackNavigation) return;

    // Readiness gate (wallet settled + order resolved, from FSM).
    // "pass"    → no wallet connected: leave SELECT_METHOD showing tiles.
    // "waiting" → wait; SelectMethod renders the spinner meanwhile.
    // "error"   → route to the Error page with the FSM message.
    // "ready"   → navigate to SELECT_TOKEN for the connected wallet.
    if (autoConnectGate.gateState === "pass") return;
    if (autoConnectGate.gateState === "waiting") return;
    if (autoConnectGate.gateState === "error") {
      context.setRoute(ROUTES.ERROR, {
        error: autoConnectGate.errorMessage ?? undefined,
      });
      return;
    }

    // gateState === "ready": pick the token screen for the connected wallet.
    // Dual-chain connect (Phantom mobile) just linked EVM + Solana: don't
    // auto-jump to a single-chain SELECT_TOKEN. Clear the flag and stay on
    // the pay page so SELECT_METHOD shows both connected wallet tiles.
    if (context.dualChainConnect) {
      context.setDualChainConnect(false);
      return;
    }

    if (
      isEthConnected &&
      !isSolanaConnected &&
      !isStellarConnected &&
      (!isMobile || !disableMobileInjector)
    ) {
      paymentState.setTokenMode("evm");
      context.setRoute(ROUTES.SELECT_TOKEN, {
        event: "eth_connected_on_open",
        walletId: connector?.id,
        address,
      });
    } else if (
      isSolanaConnected &&
      !isStellarConnected &&
      !isEthConnected &&
      solanaPaymentEligible &&
      !disableMobileInjector
    ) {
      paymentState.setTokenMode("solana");
      context.setRoute(ROUTES.SELECT_TOKEN, {
        event: "solana_connected_on_open",
      });
    } else if (
      isStellarConnected &&
      !isEthConnected &&
      !isSolanaConnected &&
      stellarPaymentEligible &&
      !disableMobileInjector
    ) {
      paymentState.setTokenMode("stellar");
      context.setRoute(ROUTES.SELECT_TOKEN, {
        event: "stellar_connected_on_open",
      });
    }
    // Don't include context.route in deps or the user can't go back from
    // SELECT_TOKEN to SELECT_METHOD.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.open,
    autoConnectGate.gateState,
    autoConnectGate.errorMessage,
    isEthConnected,
    isSolanaConnected,
    isStellarConnected,
    solanaPaymentEligible,
    stellarPaymentEligible,
    address,
    chain?.id,
    connector?.id,
  ]);

  // If we're on the connect page and the user successfully connects their
  // wallet, go to the select token page
  useEffect(() => {
    if (
      context.route === ROUTES.CONNECT ||
      context.route === ROUTES.CONNECTORS ||
      context.route === ROUTES.MOBILECONNECTORS
    ) {
      if (isEthConnected) {
        // Dual-chain connect (e.g. Phantom mobile) just linked both EVM and
        // Solana. Return to the pay page so the user picks which connected
        // wallet to pay with, instead of auto-jumping into EVM SELECT_TOKEN.
        if (context.dualChainConnect) {
          context.setDualChainConnect(false);
          context.setRoute(ROUTES.SELECT_METHOD, {
            event: "dual_chain_connected",
          });
          return;
        }
        paymentState.setTokenMode("evm");
        context.setRoute(ROUTES.SELECT_TOKEN, {
          event: "connected",
          walletId: connector?.id,
          address,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEthConnected, context.route, connector?.id, chain?.id, address, context.dualChainConnect]);

  useEffect(() => setMode(mode), [mode, setMode]);
  useEffect(() => setTheme(theme), [theme, setTheme]);
  useEffect(() => setCustomTheme(customTheme), [customTheme, setCustomTheme]);
  useEffect(() => setLang(lang), [lang, setLang]);
  useEffect(
    () => setDisableMobileInjector(disableMobileInjector),
    [disableMobileInjector, setDisableMobileInjector],
  );

  useEffect(() => {
    const appName = getAppName();
    if (!appName || !context.open) return;

    const title = document.createElement("meta");
    title.setAttribute("property", "og:title");
    title.setAttribute("content", appName);
    document.head.prepend(title);

    return () => {
      try {
        document.head.removeChild(title);
      } catch (error) {
        console.error(error);
      }
    };
  }, [context.open]);

  return (
    <RozoPayThemeProvider theme={theme} customTheme={customTheme} mode={mode}>
      <Modal
        open={context.open}
        pages={pages}
        pageId={context.route}
        onClose={closeable ? hide : undefined}
        onInfo={undefined}
        onBack={showBackButton ? onBack : undefined}
      />

      <IntercomInitializer />
    </RozoPayThemeProvider>
  );
};
