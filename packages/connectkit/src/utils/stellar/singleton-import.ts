import type { ModuleInterface } from "@creit.tech/stellar-wallets-kit";

declare global {
  let __ROZO_STELLAR_KIT_INITIALIZED__: boolean | undefined;
  let __ROZO_STELLAR_KIT_LOADING__: Promise<void> | undefined;
}

/**
 * Initializes StellarWalletsKit (v2 static singleton) once.
 * Safe to call multiple times — skips init if already done.
 * Consumer can skip this entirely by calling StellarWalletsKit.init() themselves
 * and passing stellarKit={true} to RozoPayProvider.
 */
export async function initStellarKit(config?: {
  log?: (msg: string) => void;
  modules?: ModuleInterface[];
}): Promise<void> {
  if (typeof window === "undefined") return;

  if ((globalThis as any).__ROZO_STELLAR_KIT_INITIALIZED__) {
    config?.log?.("[Rozo] StellarWalletsKit already initialized");
    return;
  }

  if ((globalThis as any).__ROZO_STELLAR_KIT_LOADING__) {
    config?.log?.("[Rozo] Waiting for StellarWalletsKit initialization...");
    return (globalThis as any).__ROZO_STELLAR_KIT_LOADING__;
  }

  const loadingPromise = (async () => {
    try {
      const { StellarWalletsKit } =
        await import("@creit.tech/stellar-wallets-kit");
      const { defaultModules } =
        await import("@creit.tech/stellar-wallets-kit/modules/utils");
      const { WalletConnectModule } =
        await import("@creit.tech/stellar-wallets-kit/modules/wallet-connect");

      const modules = config?.modules ?? [
        ...defaultModules(),
        new WalletConnectModule({
          projectId: "7440dd8acf85933ffcc775ec6675d4a9",
          metadata: {
            name: "Rozo",
            description: "Visa Layer for Stablecoins",
            url: "https://rozo.ai",
            icons: ["https://rozo.ai/rozo-logo.png"],
          },
        }),
      ];

      StellarWalletsKit.init({ modules });

      (globalThis as any).__ROZO_STELLAR_KIT_INITIALIZED__ = true;
      config?.log?.("[Rozo] StellarWalletsKit initialized successfully");
    } catch (error) {
      config?.log?.(`[Rozo] Failed to initialize StellarWalletsKit: ${error}`);
      throw error;
    } finally {
      (globalThis as any).__ROZO_STELLAR_KIT_LOADING__ = undefined;
    }
  })();

  (globalThis as any).__ROZO_STELLAR_KIT_LOADING__ = loadingPromise;
  return loadingPromise;
}

export function isStellarKitInitialized(): boolean {
  return !!(globalThis as any).__ROZO_STELLAR_KIT_INITIALIZED__;
}
