import { ExternalPaymentOptions, Token } from "@rozoai/intent-common";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";
import { injected, useAccount } from "wagmi";
import { Ethereum, Solana } from "../../../assets/chains";
import { RetryIcon } from "../../../assets/icons";
import defaultTheme from "../../../constants/defaultTheme";
import { ROUTES } from "../../../constants/routes";
import { useConnect } from "../../../hooks/useConnect";
import useIsMobile from "../../../hooks/useIsMobile";
import { usePayContext } from "../../../hooks/usePayContext";
import { useTokenOptions } from "../../../hooks/useTokenOptions";
import { useStellar } from "../../../provider/StellarContextProvider";
import Button from "../../Common/Button";
import { OrDivider } from "../../Common/Modal";
import {
  ModalBody,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../Common/Modal/styles";
import { OptionsList } from "../../Common/OptionsList";
import { OrderHeader } from "../../Common/OrderHeader";
import SelectAnotherMethodButton from "../../Common/SelectAnotherMethodButton";

export default function SelectToken() {
  const { isMobile } = useIsMobile();
  const isMobileFormat =
    isMobile || window?.innerWidth < defaultTheme.mobileWidth;

  const { paymentState, setRoute } = usePayContext();
  const { tokenMode, connectedWalletOnly, paymentOptions } = paymentState;

  const { isConnected: isEvmConnected } = useAccount();
  const { isConnected: isStellarConnected, connector } = useStellar();
  const { connected: isSolConnected } = useWallet();

  const isConnected = useMemo(
    () => isEvmConnected || isSolConnected || isStellarConnected,
    [isEvmConnected, isSolConnected, isStellarConnected]
  );

  // Detect if multiple networks are connected (e.g., Phantom connecting both EVM and Solana)
  const connectedNetworksCount = useMemo(() => {
    return (
      (isEvmConnected ? 1 : 0) +
      (isSolConnected ? 1 : 0) +
      (isStellarConnected ? 1 : 0)
    );
  }, [isEvmConnected, isSolConnected, isStellarConnected]);

  // Determine if paymentOptions has specific wallet constraints
  const hasPaymentOptionsConstraint = useMemo(() => {
    if (!paymentOptions || paymentOptions.length === 0) return false;

    // Check if paymentOptions includes any wallet-specific options
    // These are the options that should constrain which tokens are shown
    const walletOptions = ["Ethereum", "Solana", "Stellar"];
    return paymentOptions.some((option) => walletOptions.includes(option));
  }, [paymentOptions]);

  // If multiple networks are connected, override tokenMode to "all" to show all available tokens
  // UNLESS there are explicit paymentOptions constraints (connectedWalletOnly or specific wallet options)
  const effectiveTokenMode = useMemo(() => {
    if (connectedWalletOnly || hasPaymentOptionsConstraint) {
      // Respect the tokenMode set by paymentOptions when there are explicit constraints
      return tokenMode;
    }
    return connectedNetworksCount > 1 ? "all" : tokenMode;
  }, [
    connectedNetworksCount,
    tokenMode,
    connectedWalletOnly,
    hasPaymentOptionsConstraint,
  ]);

  const { optionsList, isLoading, refreshOptions } =
    useTokenOptions(effectiveTokenMode);

  const isAnotherMethodButtonVisible = useMemo(
    () => !connectedWalletOnly,
    [connectedWalletOnly]
  );

  const noConnectedWallet = useMemo(() => {
    if (!connectedWalletOnly) return false;

    // Check if there's a connected wallet that matches the payment options
    const hasMatchingConnectedWallet =
      (effectiveTokenMode === "evm" && isEvmConnected) ||
      (effectiveTokenMode === "solana" && isSolConnected) ||
      (effectiveTokenMode === "stellar" && isStellarConnected && connector) ||
      (effectiveTokenMode === "all" &&
        (isEvmConnected || isSolConnected || isStellarConnected));

    return !hasMatchingConnectedWallet;
  }, [
    isEvmConnected,
    isSolConnected,
    isStellarConnected,
    connectedWalletOnly,
    effectiveTokenMode,
    connector,
  ]);

  // Prevent showing "Insufficient balance" too quickly to avoid flickering
  const isEmptyOptionsList = useMemo(() => {
    return !isLoading && isConnected && optionsList.length === 0;
  }, [isLoading, isConnected, optionsList.length]);

  // Redirect to connector page if paymentOptions requires a specific chain that is not connected
  useEffect(() => {
    // Only redirect if connectedWalletOnly is false (not in connected-wallet-only mode)
    if (connectedWalletOnly) return;

    // Only redirect if paymentOptions constrains to a specific chain
    if (!paymentOptions || paymentOptions.length === 0) return;

    // Check which chains are required by paymentOptions
    const requiresEthereum = paymentOptions.includes(
      ExternalPaymentOptions.Ethereum
    );
    const requiresSolana = paymentOptions.includes(
      ExternalPaymentOptions.Solana
    );
    const requiresStellar = paymentOptions.includes(
      ExternalPaymentOptions.Stellar
    );

    // Count how many wallet-specific chains are required
    const requiredChains = [
      requiresEthereum,
      requiresSolana,
      requiresStellar,
    ].filter(Boolean).length;

    // Only redirect if exactly one chain is required (not multiple, not zero)
    if (requiredChains !== 1) return;

    // Redirect to SELECT_METHOD if required chain is not connected
    if (
      (requiresStellar && !isStellarConnected) ||
      (requiresSolana && !isSolConnected) ||
      (requiresEthereum && !isEvmConnected)
    ) {
      setRoute(ROUTES.SELECT_METHOD, {
        event: "click-select-another-method",
      });
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    connectedWalletOnly,
    paymentOptions,
    isEvmConnected,
    isSolConnected,
    isStellarConnected,
  ]);

  return (
    <PageContent>
      <OrderHeader
        minified={!connectedWalletOnly}
        show={effectiveTokenMode}
        excludeLogos={["stellar"]}
      />
      {(!isEmptyOptionsList || isLoading) && !noConnectedWallet && (
        <OptionsList
          requiredSkeletons={3}
          isLoading={isLoading}
          options={optionsList}
          scrollHeight={
            isAnotherMethodButtonVisible && isMobileFormat ? 225 : 300
          }
          orDivider={isAnotherMethodButtonVisible}
          hideBottomLine={!isAnotherMethodButtonVisible}
        />
      )}
      {!isLoading && isEmptyOptionsList && !noConnectedWallet && (
        <NoTokensAvailable
          onRefresh={refreshOptions}
          preferredTokens={paymentState.payParams?.preferredTokens}
        />
      )}
      {!isLoading && !isConnected && effectiveTokenMode === "all" && (
        <ConnectButton />
      )}
      {isAnotherMethodButtonVisible && (
        <>
          {isEmptyOptionsList && <OrDivider />}
          <SelectAnotherMethodButton />
        </>
      )}
      {noConnectedWallet && <NoConnectedWallet />}
    </PageContent>
  );
}

function NoConnectedWallet() {
  return (
    <ModalContent>
      <ModalH1>No connected wallet.</ModalH1>
      <SelectAnotherMethodButton />
    </ModalContent>
  );
}

function NoTokensAvailable({
  onRefresh,
  preferredTokens,
}: {
  onRefresh: () => Promise<void>;
  preferredTokens?: Token[];
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error("Failed to refresh tokens:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get supported token symbols from preferredTokens if available
  const supportedSymbols = useMemo(() => {
    if (preferredTokens && preferredTokens.length > 0) {
      return Array.from(new Set(preferredTokens.map((pt) => pt.symbol)));
    }
    return [];
  }, [preferredTokens]);

  // Format token symbols for display
  const formattedTokens = useMemo(() => {
    if (supportedSymbols.length === 0) {
      return "supported tokens";
    }
    if (supportedSymbols.length === 1) {
      return <strong>{supportedSymbols[0]}</strong>;
    }
    if (supportedSymbols.length === 2) {
      return (
        <>
          <strong>{supportedSymbols[0]}</strong> and{" "}
          <strong>{supportedSymbols[1]}</strong>
        </>
      );
    }
    // For 3+ tokens, show first two and "others"
    const firstTwo = supportedSymbols.slice(0, 2);
    const remaining = supportedSymbols.length - 2;
    return (
      <>
        <strong>{firstTwo[0]}</strong>, <strong>{firstTwo[1]}</strong>
        {remaining > 0 && `, and ${remaining} other${remaining > 1 ? "s" : ""}`}
      </>
    );
  }, [supportedSymbols]);

  return (
    <ModalContent
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 24,
        paddingBottom: 0,
        gap: 20,
      }}
    >
      <ModalH1>No tokens available</ModalH1>
      <ModalBody
        style={{
          margin: "0 auto",
          padding: "0 12px",
        }}
      >
        We can&apos;t find any supported tokens ({formattedTokens}) in your
        account on the selected network/chain.
      </ModalBody>
      <Button
        variant="secondary"
        onClick={handleRefresh}
        disabled={isRefreshing}
        waiting={isRefreshing}
        icon={<RetryIcon />}
        iconPosition="left"
      >
        {isRefreshing ? "Refreshing..." : "Refresh Balance"}
      </Button>
    </ModalContent>
  );
}

function ConnectButton() {
  const { connect } = useConnect();
  const solanaWallets = useWallet();
  // On Android, filter out the Android Intent deeplink fake wallet.
  const filteredWallets = solanaWallets.wallets.filter(
    (w) => w.adapter.name !== "Mobile Wallet Adapter"
  );
  const hasSolanaWallet = filteredWallets.length > 0;

  const icons = [<Ethereum key="ethereum" />];
  if (hasSolanaWallet) {
    icons.push(<Solana key="solana" />);
  }

  const onClick = () => {
    connect({
      connector: injected(),
    });
    if (hasSolanaWallet) {
      if (solanaWallets.wallet == null) {
        solanaWallets.select(solanaWallets.wallets[0].adapter.name);
      }
      solanaWallets.connect();
    }
  };

  const connectOption = {
    id: "connect-wallet",
    title: "Connect Wallet",
    icons,
    onClick,
  };

  return <OptionsList options={[connectOption]} />;
}
