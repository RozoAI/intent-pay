import { CreateConnectorFn } from "wagmi";
import {
  coinbaseWallet,
  CoinbaseWalletParameters,
  injected,
  safe,
  walletConnect,
} from "wagmi/connectors";
import type { Hex } from "viem";

// Harden getProvider/connect/setup: WalletConnect's EthereumProvider
// touches indexedDB/localStorage during init and can resolve without a live
// provider in some environments (private browsing, storage quota, a stale
// session). wagmi's own connector code calls `provider.on(...)` right after
// `await getProvider()` with no null-check in the connect() path, so an
// undefined provider throws synchronously inside that async function —
// escapes as an uncaught error instead of a rejected/caught promise. Wrap
// each entry point in a try/catch that rethrows as a real Error, so it
// always surfaces as a normal promise rejection our onError handlers catch.
const hardenConnector = (connector: ReturnType<CreateConnectorFn>) => {
  const wrap = <A extends any[], R>(
    fn: ((...args: A) => Promise<R>) | undefined
  ) => {
    if (!fn) return fn;
    return async (...args: A): Promise<R> => {
      try {
        return await fn(...args);
      } catch (err) {
        throw err instanceof Error
          ? err
          : new Error("WalletConnect connector failed to initialize.");
      }
    };
  };
  return {
    ...connector,
    getProvider: wrap(connector.getProvider?.bind(connector)),
    connect: wrap(connector.connect?.bind(connector)),
    setup: connector.setup
      ? async () => {
          try {
            await connector.setup!();
          } catch {
            // setup() isn't awaited by callers expecting a rejection path
            // (fire-and-forget in some wagmi versions) — swallow so it can't
            // become an unhandled rejection; connect() will retry/fail loud.
          }
        }
      : undefined,
  } as ReturnType<CreateConnectorFn>;
};

const hardenConnectorFactory = (fn: CreateConnectorFn): CreateConnectorFn =>
  ((config: Parameters<CreateConnectorFn>[0]) =>
    hardenConnector(fn(config))) as CreateConnectorFn;

// ponytail: module singleton — last-write-wins, never reset, not SSR-safe.
// Matches globalAppName/globalAppIcon pattern. Single-config assumption; if
// multi-config or SSR is needed, carry dataSuffix on wagmi Config/context instead.
let globalDataSuffix: Hex | undefined;
export const getDataSuffix = () => globalDataSuffix;

// WalletConnect's Core is itself a module-level singleton inside
// @walletconnect/core — constructing walletConnect() connectors more than
// once per projectId logs "Core is already initialized" (harmless but noisy,
// happens on every dev HMR reload or if a consumer calls getDefaultConfig()
// without memoizing). Cache the factory by projectId so repeated
// defaultConnectors() calls reuse its provider closure.
let cachedWalletConnectProjectId: string | undefined;
let cachedWalletConnectConnector: CreateConnectorFn | undefined;

type DefaultConnectorsProps = {
  app: {
    name: string;
    icon?: string;
    description?: string;
    url?: string;
  };
  coinbaseWalletPreference?: CoinbaseWalletParameters<"4">["preference"];
  dataSuffix?: Hex;
  additionalConnectors?: CreateConnectorFn[];
  walletConnectProjectId?: string;
};

const defaultConnectors = ({
  app,
  coinbaseWalletPreference,
  dataSuffix,
  additionalConnectors,
  walletConnectProjectId,
}: DefaultConnectorsProps): CreateConnectorFn[] => {
  const hasAllAppData = app.name && app.icon && app.description && app.url;
  const shouldUseSafeConnector =
    !(typeof window === "undefined") && window?.parent !== window;

  const connectors: CreateConnectorFn[] = additionalConnectors ?? [];

  // If we're in an iframe, include the SafeConnector
  if (shouldUseSafeConnector) {
    connectors.push(
      safe({
        allowedDomains: [/gnosis-safe.io$/, /app.safe.global$/],
      })
    );
  }

  // Merge dataSuffix into Coinbase Wallet attribution preference.
  // CoinbaseWalletParameters preference is `"eoaOnly" | "smartWalletOnly" | "all" | PreferenceObject`.
  // String shorthands map to `{ options: value }` in the full object form.
  // CWS SDK rejects both `auto` and `dataSuffix` on the same attribution object — skip if auto is set.
  if (dataSuffix !== undefined) globalDataSuffix = dataSuffix;
  let mergedPreference: CoinbaseWalletParameters<"4">["preference"] = coinbaseWalletPreference;
  if (dataSuffix) {
    const base: Record<string, unknown> = typeof coinbaseWalletPreference === "string"
      ? { options: coinbaseWalletPreference }
      : { ...coinbaseWalletPreference };
    const existingAttribution = (base.attribution as Record<string, unknown>) ?? {};
    if (!existingAttribution.auto) {
      mergedPreference = {
        ...base,
        attribution: { ...existingAttribution, dataSuffix },
      } as CoinbaseWalletParameters<"4">["preference"];
    } else {
      console.warn("[RozoPay] dataSuffix ignored — attribution.auto is set, cannot combine with dataSuffix");
    }
  }

  connectors.push(
    coinbaseWallet({
      appName: app.name,
      appLogoUrl: app.icon,
      overrideIsMetaMask: false,
      preference: mergedPreference,
    })
  );

  // EIP-6963 injected wallets (MetaMask, Rabby, etc.). With extension present,
  // connector names itself after the wallet (e.g. "io.metamask") and connects
  // directly. Without extension, generic "injected" name is filtered by useWallets.
  connectors.push(
    injected({ shimDisconnect: true })
  );

  // WalletConnect's provider touches indexedDB/localStorage at construction
  // time (WalletConnect Core, UniversalProvider) — building it during Next.js
  // SSR throws "indexedDB is not defined". Skip on the server; the connector
  // is only needed once the modal renders in the browser anyway.
  if (walletConnectProjectId && typeof window !== "undefined") {
    if (cachedWalletConnectProjectId !== walletConnectProjectId) {
      cachedWalletConnectProjectId = walletConnectProjectId;
      cachedWalletConnectConnector = hardenConnectorFactory(
        walletConnect({
          projectId: walletConnectProjectId,
          showQrModal: false,
        })
      );
    }
    connectors.push(cachedWalletConnectConnector!);
  }

  return connectors;
};

export default defaultConnectors;
