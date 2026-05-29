export type * as Types from "./types";

export { version } from "../package.json";

// Configure Rozo Pay
export { default as getDefaultConfig } from "./defaultConfig";
export { RozoPayProvider } from "./provider/RozoPayProvider";

// Pay button
export { RozoPayButton } from "./components/RozoPayButton";

export type {
  RozoPayButtonCustomProps,
  RozoPayButtonProps,
} from "./components/RozoPayButton/types";

// Hooks to track payment status + UI status.
// export { useRozoPay } from "./hooks/useRozoPay";
export { useRozoPayStatus } from "./hooks/useRozoPayStatus";
export { useRozoPayUI } from "./hooks/useRozoPayUI";

// For convenience, export components to show connected account.
// export { default as ChainIcon } from "./components/Common/Chain";
export { wallets } from "./wallets";

// Export utilities.
export * from "./utils/exports";

// Export types
export * from "./types";

// Export chain address utilities and types
export {
  isValidEvmAddress,
  isValidSolanaAddress,
  isValidStellarAddress,
  validateAddressForChain,
} from "./types/chainAddress";

// TODO: expose this more selectively.
export { usePayContext } from "./hooks/usePayContext";
export { PayContext as RozoPayContext } from "./provider/PayContext";

// Analytics
export { useAnalytics } from "./provider/AnalyticsProvider";

// Stellar integration
export { useRozoConnectStellar } from "./provider/StellarContextProvider";

// EVM utils
export { getAddress as getEVMAddress, isAddress as isEVMAddress } from "viem";
export {
  createConfig as createRozoWagmiConfig,
  WagmiProvider as RozoWagmiProvider,
} from "wagmi";
