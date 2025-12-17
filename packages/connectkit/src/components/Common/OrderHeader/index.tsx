import { getAddressContraction } from "@rozoai/intent-common";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import React from "react";
import { useAccount } from "wagmi";
import {
  Base,
  BinanceSmartChain,
  chainToLogo,
  Ethereum,
  Polygon,
  Solana,
  Stellar,
} from "../../../assets/chains";
import defaultTheme from "../../../constants/defaultTheme";
import { ROUTES } from "../../../constants/routes";
import { useRozoPay } from "../../../hooks/useDaimoPay";
import { usePayContext } from "../../../hooks/usePayContext";
import { useStellar } from "../../../provider/StellarContextProvider";
import styled from "../../../styles/styled";
import { EVM_CHAIN_IDS, NON_EVM_CHAIN_IDS } from "../../../types/chainAddress";
import { formatUsd } from "../../../utils/format";

/** Shows payment amount. */
export const OrderHeader = ({
  minified = false,
  show = "all",
  excludeLogos = [],
}: {
  minified?: boolean;
  show?: "evm" | "solana" | "stellar" | "zkp2p" | "all";
  excludeLogos?: string[];
}) => {
  const { paymentState, route } = usePayContext();
  const { isConnected: isEthConnected, address, connector } = useAccount();
  const {
    connected: isSolanaConnected,
    publicKey,
    wallet: solanaWallet,
  } = useWallet();
  const { senderEnsName } = paymentState;
  const {
    isConnected: isStellarConnected,
    publicKey: stellarPublicKey,
    connector: stellarConnector,
  } = useStellar();
  const { order } = useRozoPay();

  const ethWalletDisplayName =
    senderEnsName ?? (address ? getAddressContraction(address) : "wallet");
  const solWalletDisplayName = getAddressContraction(
    publicKey?.toBase58() ?? ""
  );
  const stellarWalletDisplayName = getAddressContraction(
    stellarPublicKey ?? ""
  );
  const orderUsd = order?.destFinalCallTokenAmount.usd;
  const appId = paymentState.payParams?.appId;
  const selectedChainId = paymentState.selectedChainId;

  // Get chain logo component based on chainId
  const getChainLogo = (
    chainId: number | undefined
  ): React.ReactNode | null => {
    if (!chainId) return null;

    switch (chainId) {
      case EVM_CHAIN_IDS.BASE:
        return <Base />;
      case EVM_CHAIN_IDS.ETHEREUM:
        return <Ethereum />;
      case EVM_CHAIN_IDS.POLYGON:
        return <Polygon />;
      case 56: // BSC
        return <BinanceSmartChain />;
      case NON_EVM_CHAIN_IDS.SOLANA:
        return <Solana />;
      case NON_EVM_CHAIN_IDS.STELLAR:
        return <Stellar />;
      default:
        return null;
    }
  };

  const titleAmountContent = (() => {
    if (paymentState.isDepositFlow) {
      return route === ROUTES.SELECT_TOKEN ? (
        // TODO: make this match `ModalH1` font size for mobile
        <span style={{ fontSize: "19px", lineHeight: "22px" }}>
          Your balances
        </span>
      ) : null;
    } else {
      return orderUsd != null ? (
        <span>{formatUsd(orderUsd, "nearest")}</span>
      ) : null;
    }
  })();

  const renderIcon = (
    icon: React.ReactNode | string | undefined,
    name?: string,
    size = 32
  ): JSX.Element | null => {
    if (!icon) {
      return null;
    }

    const chainLogo = selectedChainId ? chainToLogo[selectedChainId] : null;

    return (
      <WalletIconWrapper>
        <LogoContainer
          $size={size}
          $zIndex={1}
          style={{ borderRadius: "22.5%" }}
        >
          {typeof icon === "string" ? (
            <img
              src={icon}
              alt={name || "wallet"}
              style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
          ) : (
            icon
          )}
        </LogoContainer>
        {chainLogo && <ChainLogoBadge>{chainLogo}</ChainLogoBadge>}
      </WalletIconWrapper>
    );
  };

  const walletIcon = renderIcon(connector?.icon, undefined, 32);
  const solanaIcon = renderIcon(
    solanaWallet?.adapter.icon || <Solana />,
    solanaWallet?.adapter.name,
    32
  );
  const stellarIcon = renderIcon(
    stellarConnector?.icon || <Stellar />,
    stellarConnector?.name,
    32
  );

  if (minified) {
    if (titleAmountContent != null) {
      if (show === "zkp2p") {
        return (
          <MinifiedContainer>
            <MinifiedTitleAmount>{titleAmountContent}</MinifiedTitleAmount>
          </MinifiedContainer>
        );
      }

      return (
        <MinifiedContainer>
          <MinifiedTitleAmount>{titleAmountContent}</MinifiedTitleAmount>
          {show === "evm" && isEthConnected && (
            <>
              <SubtitleContainer>
                <Subtitle>{ethWalletDisplayName}</Subtitle>
                {walletIcon}
              </SubtitleContainer>
            </>
          )}
          {show === "solana" && isSolanaConnected && (
            <>
              <SubtitleContainer>
                <Subtitle>{solWalletDisplayName}</Subtitle>
                {solanaIcon}
              </SubtitleContainer>
            </>
          )}
          {show === "stellar" && isStellarConnected && (
            <>
              <SubtitleContainer>
                <Subtitle>{stellarWalletDisplayName}</Subtitle>
                {stellarIcon}
              </SubtitleContainer>
            </>
          )}
          {show === "all" && (
            <>
              <CoinLogos $size={32} $exclude={excludeLogos} appId={appId} />
            </>
          )}
        </MinifiedContainer>
      );
    } else {
      return (
        <>
          {titleAmountContent && (
            <TitleAmount>{titleAmountContent}</TitleAmount>
          )}
        </>
      );
    }
  } else {
    return (
      <>
        {titleAmountContent && <TitleAmount>{titleAmountContent}</TitleAmount>}
        {/* <AnyChainAnyCoinContainer>
          <CoinLogos $exclude={excludeLogos} />
          <Subtitle>1000+ tokens accepted</Subtitle>
        </AnyChainAnyCoinContainer> */}
      </>
    );
  }
};

function CoinLogos({
  $size = 24,
  $exclude = [],
  appId,
}: {
  $size?: number;
  $exclude?: string[];
  appId?: string;
}) {
  const logos = [
    // <Tron key="tron" />,
    // <USDC key="usdc" />,
    // <Optimism key="optimism" />,
    // <Arbitrum key="arbitrum" />,
    <Base key="base" />,
    <Ethereum key="ethereum" />,
    <BinanceSmartChain key="bsc" />,
    <Polygon key="polygon" />,
    <Solana key="solana" />,
    <Stellar key="stellar" />,
  ];

  const logoBlock = (element: React.ReactElement, index: number) => (
    <LogoContainer
      key={index}
      $marginLeft={index !== 0 ? -($size / 3) : 0}
      $zIndex={logos.length - index}
      $size={$size}
      transition={{ duration: 0.5, ease: [0.175, 0.885, 0.32, 0.98] }}
    >
      {element}
    </LogoContainer>
  );

  return (
    <Logos>
      {logos
        .filter((element) => !$exclude.includes(element?.key ?? ""))
        .map((element, index) => logoBlock(element, index))}
    </Logos>
  );
}

const TitleAmount = styled(motion.h1)<{
  $error?: boolean;
  $valid?: boolean;
}>`
  margin-bottom: 24px;
  padding: 0;
  line-height: 66px;
  font-size: 64px;
  font-weight: var(--ck-modal-h1-font-weight, 600);
  color: ${(props) => {
    if (props.$error) return "var(--ck-body-color-danger)";
    if (props.$valid) return "var(--ck-body-color-valid)";
    return "var(--ck-body-color)";
  }};
  @media only screen and (max-width: ${defaultTheme.mobileWidth}px) {
    font-size: 64px;
  }
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const Subtitle = styled(motion.div)`
  font-size: 18px;
  font-weight: 500;
  line-height: 21px;
  color: var(--ck-body-color-muted);
`;

const MinifiedTitleAmount = styled(motion.div)`
  font-size: 32px;
  font-weight: var(--ck-modal-h1-font-weight, 600);
  line-height: 36px;
  color: var(--ck-body-color);
  display: flex;
  align-items: center;
  justify-content: start;
  gap: 8px;
`;

const MinifiedContainer = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 24px;
`;

const AnyChainAnyCoinContainer = styled(motion.div)`
  display: flex;
  vertical-align: middle;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  margin-bottom: 24px;
`;

const LogoContainer = styled(motion.div)<{
  $marginLeft?: number;
  $zIndex?: number;
  $size: number;
}>`
  display: block;
  overflow: hidden;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: ${(props) => props.$marginLeft || 0}px;
  z-index: ${(props) => props.$zIndex || 2};
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  border-radius: 9999px;
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
`;

const Logos = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SubtitleContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
`;

const WalletIconWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const ChainLogoBadge = styled(motion.div)`
  position: absolute;
  bottom: -5px;
  right: 0px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  overflow: hidden;
  z-index: 10;
  svg,
  img {
    display: block;
    position: relative;
    pointer-events: none;
    overflow: hidden;
    width: 100%;
    height: 100%;
  }
`;
