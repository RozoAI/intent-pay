import {
  ALBEDO_ID,
  type ISupportedWallet,
  StellarWalletsKit,
  WalletNetwork,
  AlbedoModule,
  LobstrModule,
} from '@creit.tech/stellar-wallets-kit';
import { Horizon } from '@stellar/stellar-sdk';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_STELLAR_RPC_URL } from '../constants/rozoConfig';

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
    selectedWalletId: ALBEDO_ID,
    // modules: allowAllModules(),
    modules: [
      new LobstrModule(),
      new AlbedoModule(),
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
