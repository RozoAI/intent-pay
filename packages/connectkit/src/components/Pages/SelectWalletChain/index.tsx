import {
  base,
  bsc,
  Chain,
  ethereum,
  polygon,
  rozoSolana,
  supportedTokens,
} from "@rozoai/intent-common";
import React, { useCallback, useMemo } from "react";
import { usePayContext } from "../../../hooks/usePayContext";

import { ModalContent, PageContent } from "../../Common/Modal/styles";

import WalletPaymentSpinner from "../../Spinners/WalletPaymentSpinner";

import {
  Base,
  BinanceSmartChain,
  Ethereum,
  Polygon,
  Solana,
} from "../../../assets/chains";
import { ROUTES } from "../../../constants/routes";
import { WalletProps } from "../../../wallets/useWallets";
import { OptionsList } from "../../Common/OptionsList";

const SelectWalletChain: React.FC = () => {
  const { paymentState, setPendingConnectorId, setRoute, setSolanaConnector } =
    usePayContext();
  const { selectedWallet } = paymentState;

  // Get available chain IDs from supportedTokens (must be called before early returns)
  const availableChainIds = useMemo(
    () => new Set(Array.from(supportedTokens.keys())),
    []
  );

  // Narrow the wallet type to include solanaConnectorName.
  const wallet = selectedWallet as WalletProps | undefined;

  // Define chain options with their icons (must be called before early returns)
  const chainConfigs = useMemo(
    () => [
      {
        chain: ethereum,
        icon: <Ethereum key="ethereum" />,
        supported: availableChainIds.has(ethereum.chainId),
      },
      {
        chain: base,
        icon: <Base key="base" />,
        supported: availableChainIds.has(base.chainId),
      },
      {
        chain: polygon,
        icon: <Polygon key="polygon" />,
        supported: availableChainIds.has(polygon.chainId),
      },
      {
        chain: bsc,
        icon: <BinanceSmartChain key="bnb" />,
        // Phantom doesn't support BSC, so we don't show it for Phantom
        supported:
          availableChainIds.has(bsc.chainId) && wallet?.id !== "app.phantom",
      },
      {
        chain: rozoSolana,
        icon: <Solana key="solana" />,
        supported: availableChainIds.has(rozoSolana.chainId),
      },
    ],
    [availableChainIds, wallet?.id]
  );

  // Filter to only supported chains
  const supportedChains = useMemo(
    () => chainConfigs.filter((config) => config.supported),
    [chainConfigs]
  );

  // Handle chain selection
  const handleSelect = useCallback(
    (chain: Chain) => {
      if (!wallet) return;
      if (chain.type === "evm") {
        setPendingConnectorId(wallet.id);
        setRoute(ROUTES.CONNECT, { chainId: chain.chainId });
      } else if (chain.type === "solana") {
        setSolanaConnector(wallet.solanaConnectorName);
        setRoute(ROUTES.SOLANA_CONNECTOR, { chainId: chain.chainId });
      }
    },
    [wallet, setPendingConnectorId, setRoute, setSolanaConnector]
  );

  const options = useMemo(
    () =>
      supportedChains.map((config) => ({
        id: `chain-${config.chain.chainId}`,
        title: config.chain.name,
        icons: [config.icon],
        iconsPosition: "left" as const,
        onClick: () => handleSelect(config.chain),
      })),
    [supportedChains, handleSelect]
  );

  if (selectedWallet == null) {
    return <PageContent></PageContent>;
  }

  // If wallet only supports one chain, skip this page (fallback safety)
  if (!wallet || !wallet.solanaConnectorName) {
    return <PageContent></PageContent>;
  }

  return (
    <PageContent>
      <WalletPaymentSpinner
        logo={selectedWallet.icon}
        logoShape={
          selectedWallet.iconShape === "square"
            ? "squircle"
            : selectedWallet.iconShape || "squircle"
        }
      />
      <ModalContent $preserveDisplay={true}>
        <OptionsList options={options} />
      </ModalContent>
    </PageContent>
  );
};

export default SelectWalletChain;
