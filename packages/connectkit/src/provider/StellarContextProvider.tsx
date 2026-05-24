import type {
  ISupportedWallet,
  KitEventStateUpdated,
} from "@creit.tech/stellar-wallets-kit";
import { rozoStellarUSDC } from "@rozoai/intent-common";
import { Asset, Horizon } from "@stellar/stellar-sdk";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_STELLAR_RPC_URL } from "../constants/rozoConfig";
import * as LocalStorage from "../utils/localstorage";
import { initStellarKit } from "../utils/stellar/singleton-import";

type StellarContextProvider = {
  children: ReactNode;
  rpcUrl?: string;
  /**
   * Pass `true` if your app already called `StellarWalletsKit.init()` before
   * mounting RozoPayProvider. The SDK will skip its internal init and instead
   * subscribe to STATE_UPDATED events so any existing wallet connection is
   * automatically detected.
   */
  kit?: boolean;
  stellarWalletPersistence?: boolean;
  log?: (msg: string) => void;
};

type StellarContextProviderValue = {
  isExternalKit: boolean;
  stellarWalletPersistence: boolean;
  server: Horizon.Server;
  publicKey: string | undefined;
  setPublicKey: (publicKey: string) => void;
  account: Horizon.AccountResponse | undefined;
  refreshAccount: () => Promise<Horizon.AccountResponse | undefined>;
  isAccountExists: boolean;
  isConnected: boolean;
  connector: ISupportedWallet | undefined;
  setConnector: (connector: ISupportedWallet) => void;
  setWallet: (option: ISupportedWallet) => Promise<void>;
  disconnect: () => Promise<void>;
  convertXlmToUsdc: (amount: string) => Promise<string>;
};

export type StellarWalletName = ISupportedWallet;

export const STELLAR_WALLET_STORAGE_KEY = "rozo-stellar-wallet";

const initialContext: StellarContextProviderValue = {
  isExternalKit: false,
  stellarWalletPersistence: true,
  server: undefined as any,
  publicKey: undefined,
  setPublicKey: () => {},
  account: undefined,
  refreshAccount: () => Promise.resolve(undefined),
  isAccountExists: false,
  isConnected: false,
  connector: undefined,
  setConnector: () => {},
  setWallet: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  convertXlmToUsdc: () => Promise.resolve(""),
};

export const StellarContext =
  createContext<StellarContextProviderValue>(initialContext);

export const StellarContextProvider = ({
  children,
  rpcUrl,
  kit: externalKitReady,
  stellarWalletPersistence: _stellarWalletPersistence,
  log,
}: StellarContextProvider) => {
  const stellarWalletPersistence =
    _stellarWalletPersistence !== undefined ? _stellarWalletPersistence : true;

  const [publicKey, setPublicKey] = useState<string | undefined>(undefined);
  const [accountInfo, setAccountInfo] = useState<
    Horizon.AccountResponse | undefined
  >(undefined);
  const [connector, setConnector] = useState<ISupportedWallet | undefined>(
    undefined,
  );
  const [isAccountExists, setIsAccountExists] = useState(false);
  const [isKitReady, setIsKitReady] = useState(false);
  const [kitError, setKitError] = useState<string | undefined>(undefined);

  const isUsingExternalKit = !!externalKitReady;

  const server = useMemo(() => {
    return new Horizon.Server(rpcUrl ?? DEFAULT_STELLAR_RPC_URL);
  }, [rpcUrl]);

  const getAccountInfo = async () => {
    try {
      if (!publicKey) return;
      const data = await server.loadAccount(publicKey);
      setAccountInfo(data);
      setIsAccountExists(true);
      return data;
    } catch (error: any) {
      console.error("[Rozo] getAccountInfo error", error);
      setIsAccountExists(false);
    }
  };

  const convertXlmToUsdc = async (amount: string) => {
    try {
      const issuer = rozoStellarUSDC.token.split(":")[1];
      const destAsset = new Asset("USDC", issuer);
      const pathResults = await server
        .strictSendPaths(Asset.native(), amount, [destAsset])
        .call();
      if (!pathResults?.records?.length) {
        throw new Error("No exchange rate found for XLM swap");
      }
      const bestPath = pathResults.records[0];
      const estimatedDestMinAmount = (
        parseFloat(bestPath.destination_amount) * 0.94
      ).toFixed(2);
      return estimatedDestMinAmount;
    } catch (error: any) {
      console.error("[Rozo] convertXlmToUsdc error", error);
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      setPublicKey(undefined);
      setConnector(undefined);
      setAccountInfo(undefined);
      if (stellarWalletPersistence) {
        LocalStorage.clear(STELLAR_WALLET_STORAGE_KEY);
      }
      if (!isUsingExternalKit) {
        const { StellarWalletsKit } =
          await import("@creit.tech/stellar-wallets-kit");
        await StellarWalletsKit.disconnect();
      }
    } catch (error: any) {
      console.error("[Rozo] disconnect error", error);
    }
  };

  const setWallet = async (option: ISupportedWallet) => {
    if (!isKitReady) {
      throw new Error("Stellar kit not initialized yet. Please wait...");
    }
    if (!option) return;

    // Idempotent: already connected with this wallet — skip kit calls to avoid
    // double WalletConnect confirmation.
    if (connector?.id === option.id && publicKey) {
      setConnector(option);
      log?.(`[Rozo] setWallet skipped (already connected): ${option.name}`);
      return;
    }

    try {
      const { StellarWalletsKit } =
        await import("@creit.tech/stellar-wallets-kit");
      log?.(
        `[Rozo] Connecting wallet: ${option.id} (externalKit: ${isUsingExternalKit})`,
      );
      StellarWalletsKit.setWallet(option.id);
      const { address } = await StellarWalletsKit.fetchAddress();
      setPublicKey(address);
      log?.(`[Rozo] Connected, publicKey: ${address}`);
      setConnector(option);

      if (stellarWalletPersistence) {
        LocalStorage.add(STELLAR_WALLET_STORAGE_KEY, {
          walletId: option.id,
          walletName: option.name,
          walletIcon: option.icon,
          publicKey: address,
        });
      }

      log?.(`[Rozo] setWallet completed successfully for: ${option.name}`);
    } catch (err: any) {
      console.error("[Rozo] setWallet error", err);
      throw new Error(err.message || "Failed to set wallet");
    }
  };

  // Initialize internal kit or mark external kit as ready
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;

    const setup = async () => {
      try {
        if (!isUsingExternalKit) {
          await initStellarKit({ log });
        }
        if (mounted) setIsKitReady(true);
      } catch (error: any) {
        console.error("[Rozo] Failed to initialize Stellar kit:", error);
        if (mounted) setKitError(error.message);
      }
    };

    setup();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to STATE_UPDATED / DISCONNECT to sync address from any source
  // (picks up connections made externally via consumer's own SWK usage)
  useEffect(() => {
    if (!isKitReady || typeof window === "undefined") return;

    let cleanupFn: (() => void) | undefined;

    const subscribe = async () => {
      const { StellarWalletsKit, KitEventType } =
        await import("@creit.tech/stellar-wallets-kit");

      const unsubState = StellarWalletsKit.on(
        KitEventType.STATE_UPDATED,
        (event: KitEventStateUpdated) => {
          const addr = event.payload?.address;
          if (addr) setPublicKey(addr);
        },
      );

      const unsubDisconnect = StellarWalletsKit.on(
        KitEventType.DISCONNECT,
        () => {
          setPublicKey(undefined);
          setConnector(undefined);
          setAccountInfo(undefined);
        },
      );

      cleanupFn = () => {
        unsubState?.();
        unsubDisconnect?.();
      };
    };

    subscribe();
    return () => cleanupFn?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKitReady]);

  useEffect(() => {
    if (kitError) {
      console.error(
        "❌ Stellar kit initialization failed:\n" +
          kitError +
          "\n\n" +
          "To fix this, initialize StellarWalletsKit before mounting RozoPayProvider:\n\n" +
          'import { StellarWalletsKit, defaultModules } from "@creit.tech/stellar-wallets-kit";\n\n' +
          "StellarWalletsKit.init({ modules: defaultModules() });\n\n" +
          "<RozoPayProvider stellarKit={true}>{children}</RozoPayProvider>",
      );
    }
  }, [kitError]);

  // Auto-reconnect to previously connected wallet
  useEffect(() => {
    if (
      !isKitReady ||
      typeof window === "undefined" ||
      !stellarWalletPersistence
    )
      return;

    const savedWallet = LocalStorage.get(STELLAR_WALLET_STORAGE_KEY);
    if (savedWallet && savedWallet.length > 0) {
      const lastWallet = savedWallet[0];
      if (lastWallet.walletId && lastWallet.publicKey) {
        try {
          setWallet({
            id: lastWallet.walletId,
            name: lastWallet.walletName,
            icon: lastWallet.walletIcon,
            ...lastWallet,
          } as ISupportedWallet);
        } catch (error: any) {
          console.error("[Rozo] Auto-reconnect failed:", error);
          disconnect();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKitReady, stellarWalletPersistence]);

  useEffect(() => {
    if (publicKey) getAccountInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  const contextValue = useMemo(() => {
    return {
      isExternalKit: isUsingExternalKit,
      stellarWalletPersistence,
      publicKey,
      setPublicKey,
      server,
      account: accountInfo,
      refreshAccount: getAccountInfo,
      isAccountExists: isAccountExists ?? (!!accountInfo && !!publicKey),
      isConnected: !!publicKey,
      connector,
      setConnector,
      setWallet,
      disconnect,
      convertXlmToUsdc,
    } satisfies StellarContextProviderValue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isUsingExternalKit,
    stellarWalletPersistence,
    publicKey,
    server,
    accountInfo,
    isAccountExists,
    connector,
    isKitReady,
  ]);

  return (
    <StellarContext.Provider value={contextValue}>
      {children}
    </StellarContext.Provider>
  );
};

export const useStellar = () => {
  const context = useContext(StellarContext);
  if (!context) {
    throw new Error("useStellar must be used within a StellarContextProvider");
  }
  return context;
};

export const useRozoConnectStellar = () => {
  const {
    publicKey,
    account,
    isConnected,
    connector,
    disconnect,
    setPublicKey,
    setWallet: setConnector,
  } = useStellar();

  return {
    isConnected,
    publicKey,
    account,
    connector,
    setPublicKey,
    setConnector,
    disconnect,
  };
};

export type { ISupportedWallet } from "@creit.tech/stellar-wallets-kit";
