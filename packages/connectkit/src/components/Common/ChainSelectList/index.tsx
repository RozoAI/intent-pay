import { supportedChains } from "@rozoai/intent-common";
import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";

import Alert from "../Alert";
import {
  ChainButton,
  ChainButtonBg,
  ChainButtonContainer,
  ChainButtons,
  ChainButtonStatus,
  ChainIcon,
  ChainLogoContainer,
  ChainLogoSpinner,
  SwitchNetworksContainer,
} from "./styles";

import { AnimatePresence, motion } from "framer-motion";
import { isCoinbaseWalletConnector, isMobile } from "../../../utils";

import { chainToLogo, UnknownChain } from "../../../assets/chains";
import useLocales from "../../../hooks/useLocales";
import { usePayContext } from "../../../hooks/usePayContext";

const Spinner = (
  <svg
    aria-hidden="true"
    width="36"
    height="36"
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 16.75C2.69036 16.75 3.25 17.3096 3.25 18V19C3.25 26.5939 9.40609 32.75 17 32.75V35.25C8.02537 35.25 0.75 27.9746 0.75 19V18C0.75 17.3096 1.30964 16.75 2 16.75Z"
      fill="url(#paint0_linear_1288_18701)"
    />
    <defs>
      <linearGradient
        id="paint0_linear_1288_18701"
        x1="2"
        y1="19.4884"
        x2="16.8752"
        y2="33.7485"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="var(--ck-spinner-color)" />
        <stop offset="1" stopColor="var(--ck-spinner-color)" stopOpacity="0" />
      </linearGradient>
    </defs>
  </svg>
);

const ChainSelectList = ({
  variant,
}: {
  variant?: "primary" | "secondary";
}) => {
  const { connector, chain } = useAccount();
  const { chains, isPending, switchChain, error } = useSwitchChain();
  const [pendingChainId, setPendingChainId] = useState<number | undefined>(
    undefined,
  );

  const locales = useLocales({});
  const mobile = isMobile();

  const isError = error?.["code"] === 4902; // Wallet cannot switch networks
  const disabled = isError || !switchChain;

  const handleSwitchNetwork = (chainId: number) => {
    if (switchChain) {
      setPendingChainId(chainId);
      switchChain({ chainId });
    }
  };

  const { triggerResize } = usePayContext();

  return (
    <SwitchNetworksContainer
      style={{ marginBottom: switchChain !== undefined ? -8 : 0 }}
    >
      <ChainButtonContainer>
        <ChainButtons>
          {chains.map((x) => {
            const c = supportedChains.find((ch) => ch.chainId === x.id);
            const ch = { ...c, ...x };
            return (
              <ChainButton
                key={`${ch?.id}-${ch?.name}`}
                $variant={variant}
                disabled={
                  disabled ||
                  ch.id === chain?.id ||
                  (isPending && pendingChainId === ch.id)
                }
                onClick={() => handleSwitchNetwork?.(ch.id)}
                style={{
                  opacity: disabled && ch.id !== chain?.id ? 0.4 : undefined,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: 12,
                    color:
                      ch.id === chain?.id
                        ? "var(--ck-dropdown-active-color, inherit)"
                        : "inherit",
                  }}
                >
                  <ChainLogoContainer>
                    <ChainLogoSpinner
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: isPending && pendingChainId === ch.id ? 1 : 0,
                      }}
                      transition={{
                        ease: [0.76, 0, 0.24, 1],
                        duration: 0.15,
                        delay: 0.1,
                      }}
                    >
                      <motion.div
                        key={`${ch?.id}-${ch?.name}`}
                        animate={
                          // UI fix for Coinbase Wallet on mobile does not remove isPending on rejection event
                          mobile &&
                            isCoinbaseWalletConnector(connector?.id) &&
                            isPending &&
                            pendingChainId === ch.id
                            ? {
                              opacity: [1, 0],

                              transition: { delay: 4, duration: 3 },
                            }
                            : { opacity: 1 }
                        }
                      >
                        {Spinner}
                      </motion.div>
                    </ChainLogoSpinner>
                    <ChainIcon>
                      {ch.chainId ? chainToLogo[ch.chainId] : <UnknownChain />}
                    </ChainIcon>
                  </ChainLogoContainer>
                  {ch.name}
                </span>
                {variant !== "secondary" && (
                  <ChainButtonStatus>
                    <AnimatePresence initial={false} mode="wait">
                      {ch.id === chain?.id && (
                        <motion.span
                          key={"connectedText"}
                          style={{
                            color:
                              "var(--ck-dropdown-active-color, var(--ck-focus-color))",
                            display: "block",
                            position: "relative",
                          }}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{
                            opacity: 0,
                            x: 4,
                            transition: { duration: 0.1, delay: 0 },
                          }}
                          transition={{
                            ease: [0.76, 0, 0.24, 1],
                            duration: 0.3,
                            delay: 0.2,
                          }}
                        >
                          {locales.connected}
                        </motion.span>
                      )}
                      {isPending && pendingChainId === ch.id && (
                        <motion.span
                          key={"approveText"}
                          style={{
                            color: "var(--ck-dropdown-pending-color, inherit)",
                            display: "block",
                            position: "relative",
                          }}
                          initial={{
                            opacity: 0,
                            x: -4,
                          }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 4 }}
                          transition={{
                            ease: [0.76, 0, 0.24, 1],
                            duration: 0.3,
                            delay: 0.1,
                          }}
                        >
                          <motion.span
                            animate={
                              // UI fix for Coinbase Wallet on mobile does not remove isLoading on rejection event
                              mobile &&
                              isCoinbaseWalletConnector(connector?.id) && {
                                opacity: [1, 0],
                                transition: { delay: 4, duration: 4 },
                              }
                            }
                          >
                            {locales.approveInWallet}
                          </motion.span>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </ChainButtonStatus>
                )}
                {variant === "secondary" ? (
                  <ChainButtonBg
                    initial={false}
                    animate={{
                      opacity: ch.id === chain?.id ? 1 : 0,
                    }}
                    transition={{
                      duration: 0.3,
                      ease: "easeOut",
                    }}
                  />
                ) : (
                  //hover === ch.name && (
                  ch.id === chain?.id && (
                    <ChainButtonBg
                      layoutId="activeChain"
                      layout="position"
                      transition={{
                        duration: 0.3,
                        ease: "easeOut",
                      }}
                    />
                  )
                )}
              </ChainButton>
            );
          })}
        </ChainButtons>
      </ChainButtonContainer>
      <AnimatePresence>
        {isError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              ease: [0.76, 0, 0.24, 1],
              duration: 0.3,
            }}
            onAnimationStart={triggerResize}
            onAnimationComplete={triggerResize}
          >
            <div style={{ paddingTop: 10, paddingBottom: 8 }}>
              <Alert>
                {locales.warnings_walletSwitchingUnsupported}{" "}
                {locales.warnings_walletSwitchingUnsupportedResolve}
              </Alert>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SwitchNetworksContainer>
  );
};

export default ChainSelectList;
