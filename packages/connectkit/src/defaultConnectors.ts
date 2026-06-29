import { CreateConnectorFn } from "wagmi";
import {
  coinbaseWallet,
  CoinbaseWalletParameters,
  safe,
  walletConnect,
} from "wagmi/connectors";
import type { Hex } from "viem";

// ponytail: module singleton — last-write-wins, never reset, not SSR-safe.
// Matches globalAppName/globalAppIcon pattern. Single-config assumption; if
// multi-config or SSR is needed, carry dataSuffix on wagmi Config/context instead.
let globalDataSuffix: Hex | undefined;
export const getDataSuffix = () => globalDataSuffix;

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

  if (walletConnectProjectId) {
    connectors.push(
      walletConnect({
        projectId: walletConnectProjectId,
      })
    );
  }

  return connectors;
};

export default defaultConnectors;
