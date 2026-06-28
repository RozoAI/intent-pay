import { type CreateConfigParameters, CreateConnectorFn, http } from "wagmi";
import type { Hex } from "viem";
import {
  arbitrum,
  base,
  bsc,
  Chain,
  hyperEvm,
  mainnet,
  polygon,
} from "wagmi/chains";
import { CoinbaseWalletParameters } from "wagmi/connectors";

import defaultConnectors from "./defaultConnectors";

// TODO: Move these to a provider rather than global variable
let globalAppName: string;
let globalAppIcon: string;
export const getAppName = () => globalAppName;

type DefaultConfigProps = {
  appName: string;
  appIcon?: string;
  appDescription?: string;
  appUrl?: string;

  // Coinbase Wallet preference
  coinbaseWalletPreference?: CoinbaseWalletParameters<"4">["preference"];

  // Base builder code attribution suffix (https://docs.base.org/apps/builder-codes/app-developers)
  dataSuffix?: Hex;

  // Additional connectors to use
  additionalConnectors?: CreateConnectorFn[];
} & Partial<CreateConfigParameters>;

/**
 * REQUIRED_CHAINS is the list of chains that are required for the Rozo Pay SDK.
 * These are the chains that are supported by the Rozo Pay SDK and are required for the SDK to work.
 * Whenever Supported Chains are added to the SDK, they should also be added to this list.
 */
export const REQUIRED_CHAINS: CreateConfigParameters["chains"] = [
  arbitrum,
  base,
  bsc,
  mainnet,
  polygon,
  hyperEvm,
];

/** Rozo Pay recommended config, for use with wagmi's createConfig(). */
const defaultConfig = ({
  appName = "Rozo Pay",
  appIcon,
  appDescription,
  appUrl,
  coinbaseWalletPreference,
  dataSuffix,
  additionalConnectors,
  chains = REQUIRED_CHAINS,
  client,
  ...props
}: DefaultConfigProps): CreateConfigParameters => {
  globalAppName = appName;
  if (appIcon) globalAppIcon = appIcon;

  const paddedChains: [Chain, ...Chain[]] = [...chains];
  for (const chain of REQUIRED_CHAINS) {
    if (!paddedChains.includes(chain)) {
      paddedChains.push(chain);
    }
  }

  const paddedTransports: CreateConfigParameters["transports"] = {};
  for (const chain of paddedChains) {
    if (!props?.transports?.[chain.id]) {
      // Auto inject http transport if not provided for a chain
      paddedTransports[chain.id] = http();
    } else {
      paddedTransports[chain.id] = props.transports[chain.id];
    }
  }

  if (dataSuffix && props?.connectors) {
    console.warn("[RozoPay] dataSuffix is ignored when custom connectors are provided. Configure attribution in your connectors directly.");
  }

  const connectors: CreateConfigParameters["connectors"] =
    props?.connectors ??
    defaultConnectors({
      app: {
        name: appName,
        icon: appIcon,
        description: appDescription,
        url: appUrl,
      },
      coinbaseWalletPreference,
      dataSuffix,
      additionalConnectors,
    });

  const config: CreateConfigParameters<any, any> = {
    ...props,
    chains: paddedChains,
    transports: paddedTransports,
    connectors,
  };

  return config;
};

export default defaultConfig;
