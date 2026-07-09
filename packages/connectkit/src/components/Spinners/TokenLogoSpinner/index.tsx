import { RozoPayToken } from "@rozoai/intent-common";
import { AnimatePresence } from "framer-motion";
import { chainToLogo } from "../../../assets/chains";
import { isNativeToken } from "../../../utils/token";
import CircleSpinner from "../CircleSpinner";
import { AnimationContainer, LoadingContainer } from "../styles";
import { ChainLogoContainer } from "./styles";

const TokenLogoSpinner = ({
  token,
  loading = false,
  nativeAsChainIcon = false,
}: {
  token: RozoPayToken;
  loading?: boolean;
  /**
   * When true, use the chain icon as the main logo for native tokens
   * (ETH/BNB/POL/SOL/XLM) instead of the token's logoURI.
   */
  nativeAsChainIcon?: boolean;
}) => {
  const chainLogo = chainToLogo[token.chainId];
  const showChainAsMain = nativeAsChainIcon && isNativeToken(token) && chainLogo != null;

  return (
    <LoadingContainer>
      <AnimationContainer $circle={true}>
        <AnimatePresence>
          {/* Hide the chain badge when the chain icon is already the main logo. */}
          {chainLogo && !showChainAsMain && (
            <ChainLogoContainer key="ChainLogoContainer">
              {chainLogo}
            </ChainLogoContainer>
          )}
          <CircleSpinner
            key="CircleSpinner"
            logo={
              showChainAsMain ? (
                chainLogo
              ) : (
                <img src={token.logoURI} alt={token.symbol} />
              )
            }
            loading={loading}
            unavailable={false}
          />
        </AnimatePresence>
      </AnimationContainer>
    </LoadingContainer>
  );
};

export default TokenLogoSpinner;
