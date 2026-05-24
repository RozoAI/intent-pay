export * from "./types";
export * from "./walletconnect.module";

export { defineStellarChain, isStellarChain, STELLAR_NETWORKS } from "./types";
export type { StellarChainConfig } from "./types";
export {
  WalletConnectAllowedMethods,
  WalletConnectModule,
  WalletConnectTargetChain,
} from "./walletconnect.module";
export type {
  IParsedWalletConnectSession,
  IWalletConnectConstructorParams,
} from "./walletconnect.module";
export { initStellarKit, isStellarKitInitialized } from "./singleton-import";
