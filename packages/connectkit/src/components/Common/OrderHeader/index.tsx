import { getAddressContraction, getKnownToken } from "@rozoai/intent-common";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import React from "react";
import { useAccount } from "wagmi";
import {
  Base,
  BinanceSmartChain,
  Ethereum,
  Polygon,
  Solana,
  Stellar,
} from "../../../assets/chains";
import defaultTheme from "../../../constants/defaultTheme";
import { ROUTES } from "../../../constants/routes";
import { useRozoPay } from "../../../hooks/useRozoPay";
import { usePayContext } from "../../../hooks/usePayContext";
import { useStellar } from "../../../provider/StellarContextProvider";
import styled from "../../../styles/styled";
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
    publicKey?.toBase58() ?? "",
  );
  const stellarWalletDisplayName = getAddressContraction(
    stellarPublicKey ?? "",
  );
  const orderUsd = order?.destFinalCallTokenAmount.usd;
  const destinationFiatISO = React.useMemo(() => {
    if (!paymentState.payParams?.toChain || !paymentState.payParams?.toToken) {
      return order?.destFinalCallTokenAmount.token.fiatISO;
    }

    return getKnownToken(
      paymentState.payParams.toChain,
      paymentState.payParams.toToken,
    )?.fiatISO;
  }, [
    order?.destFinalCallTokenAmount.token.fiatISO,
    paymentState.payParams?.toChain,
    paymentState.payParams?.toToken,
  ]);
  const appId = paymentState.payParams?.appId;

  const titleAmountContent = React.useMemo(() => {
    if (paymentState.isDepositFlow) {
      return route === ROUTES.SELECT_TOKEN ? (
        <span style={{ fontSize: "clamp(16px, 4vw, 19px)", lineHeight: "1.45" }}>
          Your balances
        </span>
      ) : null;
    } else {
      return orderUsd != null && order ? (
        <span>{formatUsd(orderUsd, "nearest", destinationFiatISO, order.destFinalCallTokenAmount.token.displayDecimals)}</span>
      ) : null;
    }
  }, [
    paymentState.isDepositFlow,
    route,
    orderUsd,
    order,
    destinationFiatISO,
  ]);

  const renderIcon = (
    icon: React.ReactNode | string | undefined,
    name?: string,
    size = 32,
  ): JSX.Element | null => {
    if (!icon) {
      return null;
    }

    return (
      <LogoContainer $size={size} $zIndex={1} style={{ borderRadius: "22.5%" }}>
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
    );
  };

  const walletIcon = renderIcon(connector?.icon, undefined, 32);
  const solanaIcon = renderIcon(
    solanaWallet?.adapter.icon || <Solana />,
    solanaWallet?.adapter.name,
    32,
  );
  const stellarIcon = renderIcon(
    stellarConnector?.icon || <Stellar />,
    stellarConnector?.name,
    32,
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
  line-height: 1.15;
  font-size: clamp(28px, 6vw, 48px);
  font-weight: var(--ck-modal-h1-font-weight, 600);
  text-wrap: balance;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  max-width: 100%;
  color: ${(props) => {
    if (props.$error) return "var(--ck-body-color-danger)";
    if (props.$valid) return "var(--ck-body-color-valid)";
    return "var(--ck-body-color)";
  }};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const Subtitle = styled(motion.div)`
  font-size: clamp(16px, 4vw, 18px);
  font-weight: 500;
  line-height: 1.45;
  color: var(--ck-body-color-muted);
  text-wrap: balance;
`;

const MinifiedTitleAmount = styled(motion.div)`
  font-size: clamp(20px, 5vw, 28px);
  font-weight: var(--ck-modal-h1-font-weight, 600);
  line-height: 1.15;
  color: var(--ck-body-color);
  text-wrap: balance;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
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
  overflow: hidden;
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
  flex-shrink: 0;
  min-width: 0;
  overflow: hidden;
`;
