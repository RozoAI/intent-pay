import {
  FREIGHTER_ID,
  type ISupportedWallet,
  StellarWalletsKit,
  WalletNetwork,
  FreighterModule,
  AlbedoModule,
  LobstrModule,
} from '@creit.tech/stellar-wallets-kit';
import { stellar } from '@rozoai/intent-common';
import { Horizon, Asset } from '@stellar/stellar-sdk';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

type StellarContextProvider = { children: ReactNode; stellarRpcUrl?: string };

type StellarContextProviderValue = {
  kit: StellarWalletsKit | undefined;
  server: Horizon.Server | undefined;
  publicKey: string | undefined;
  setPublicKey: (publicKey: string) => void;
  account: Horizon.AccountResponse | undefined;
  isConnected: boolean;
  connector: ISupportedWallet | undefined;
  setConnector: (connector: ISupportedWallet) => void;
  disconnect: () => void;
};


export type StellarWalletName = ISupportedWallet;

export const DEFAULT_STELLAR_RPC_URL = 'https://horizon.stellar.org';

// --- Define the Assets for the Swap ---
export const STELLAR_NATIVE_ASSET = Asset.native();
export const STELLAR_USDC_ASSET_CODE = 'USDC';
export const STELLAR_USDC_ISSUER_PK = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'; // Mainnet USDC Issuer

// --- ⭐️ Updated Static Token Information to match JSON structure ---
export const STELLAR_XLM_TOKEN_INFO = {
  chainId: stellar.chainId,
  token: 'native',
  name: 'Stellar Lumens',
  symbol: 'XLM',
  decimals: 7,
  logoSourceURI: 'https://rozo-pay.vercel.app/tokens/stellar.svg', // Placeholder
  logoURI: 'https://rozo-pay.vercel.app/tokens/stellar.svg', // Placeholder
  usd: 0.1, // Default/fallback price
  priceFromUsd: 10,
  displayDecimals: 4,
  fiatSymbol: "$",
  maxAcceptUsd: 100000,
  maxSendUsd: 100000,
};

export const STELLAR_USDC_TOKEN_INFO = {
  chainId: stellar.chainId, // Placeholder for Stellar Mainnet
  token: STELLAR_USDC_ISSUER_PK,
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 7,
  logoSourceURI: 'https://rozo-pay.vercel.app/tokens/usdc.png',
  logoURI: 'https://rozo-pay.vercel.app/tokens/usdc.png',
  usd: 1,
  priceFromUsd: 1,
  displayDecimals: 2,
  fiatSymbol: "$",
  maxAcceptUsd: 100000,
  maxSendUsd: 0,
};

const initialContext = {
  kit: undefined,
  server: undefined,
  publicKey: undefined,
  setPublicKey: () => { },
  account: undefined,
  isConnected: false,
  connector: undefined,
  setConnector: () => { },
  disconnect: () => { },
};

export const StellarContext = createContext<StellarContextProviderValue>(initialContext);

export const StellarContextProvider = ({
  children,
  stellarRpcUrl,
}: StellarContextProvider) => {
  const [publicKey, setPublicKey] = useState<string | undefined>(undefined);
  const [accountInfo, setAccountInfo] = useState<Horizon.AccountResponse | undefined>(undefined);
  const [connector, setConnector] = useState<ISupportedWallet | undefined>(undefined);

  const kit = new StellarWalletsKit({
    network: WalletNetwork.PUBLIC,
    selectedWalletId: FREIGHTER_ID,
    // modules: allowAllModules(),
    modules: [
      new LobstrModule(),
      new AlbedoModule(),
      new FreighterModule(),
    ]
  });

  const server = new Horizon.Server(stellarRpcUrl ?? DEFAULT_STELLAR_RPC_URL);

  const getAccountInfo = async (publicKey: string) => {
    try {
      const data = await server.loadAccount(publicKey);

      setAccountInfo(data);
    } catch (error: any) {
      console.error(error);
    }
  };

  const disconnect = async () => {
    try {
      setPublicKey(undefined);
      setConnector(undefined);
      setAccountInfo(undefined);
      await kit.disconnect();
    } catch (error: any) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (publicKey) {
      getAccountInfo(publicKey);
    }
  }, [publicKey]);

  return (
    <StellarContext.Provider
      value={{
        kit,
        publicKey,
        setPublicKey,
        server,
        account: accountInfo,
        isConnected: !!publicKey,
        connector,
        setConnector,
        disconnect,
      }}
    >
      {children}
    </StellarContext.Provider>
  );
};

export const useStellar = () => useContext(StellarContext);
