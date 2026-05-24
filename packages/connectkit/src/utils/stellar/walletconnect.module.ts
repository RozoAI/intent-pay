// Re-export the official WalletConnectModule from SWK v2.
// Our custom implementation has been replaced by the built-in module.
export { WalletConnectModule } from "@creit.tech/stellar-wallets-kit/modules/wallet-connect";

export const WALLET_CONNECT_ID = "wallet_connect";

export enum WalletConnectTargetChain {
  PUBLIC = "stellar:pubnet",
  TESTNET = "stellar:testnet",
}

export enum WalletConnectAllowedMethods {
  SIGN = "stellar_signXDR",
  SIGN_AND_SUBMIT = "stellar_signAndSubmitXDR",
}

export interface IParsedWalletConnectSession {
  id: string;
  name: string;
  description: string;
  url: string;
  icons: string;
  accounts: Array<{
    network: "pubnet" | "testnet";
    publicKey: string;
  }>;
}

export interface IWalletConnectConstructorParams {
  projectId: string;
  metadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
}
