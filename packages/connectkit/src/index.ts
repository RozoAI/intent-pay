export type * as Types from "./types";

export { version } from "../package.json";

// Configure Rozo Pay
export { default as getDefaultConfig } from "./defaultConfig";
export { RozoPayProvider } from "./provider/DaimoPayProvider";

// Pay button
export { RozoPayButton } from "./components/DaimoPayButton";

export type {
  RozoPayButtonCustomProps,
  RozoPayButtonProps,
} from "./components/DaimoPayButton/types";

// Hooks to track payment status + UI status.
export { useRozoPay } from "./hooks/useDaimoPay";
export { useRozoPayStatus } from "./hooks/useDaimoPayStatus";
export { useRozoPayUI } from "./hooks/useDaimoPayUI";

// For convenience, export components to show connected account.
export { default as Avatar } from "./components/Common/Avatar";
export { default as ChainIcon } from "./components/Common/Chain";
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

// Stellar integration
export { useRozoConnectStellar } from "./provider/StellarContextProvider";

// EVM utils
export { getAddress as getEVMAddress, isAddress as isEVMAddress } from "viem";
export {
  createConfig as createRozoWagmiConfig,
  WagmiProvider as RozoWagmiProvider,
} from "wagmi";
