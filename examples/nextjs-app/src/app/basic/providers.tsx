"use client";

import {
  WalletConnectAllowedMethods,
  WalletConnectModule,
} from "@creit.tech/stellar-wallets-kit/modules/walletconnect.module";
import {
  getDefaultConfig as getDefaultConfigRozo,
  RozoPayProvider,
} from "@rozoai/intent-pay";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { createConfig, WagmiProvider } from "wagmi";

import {
  allowAllModules,
  FREIGHTER_ID,
  StellarWalletsKit,
  WalletNetwork,
} from "@creit.tech/stellar-wallets-kit";

const stellarKit = new StellarWalletsKit({
  network: WalletNetwork.PUBLIC,
  selectedWalletId: FREIGHTER_ID,
  modules: [
    ...allowAllModules(),
    new WalletConnectModule({
      url:
        typeof window !== "undefined"
          ? window.location.origin
          : "https://intents.rozo.ai",
      projectId: "7440dd8acf85933ffcc775ec6675d4a9",
      method: WalletConnectAllowedMethods.SIGN,
      description: "ROZO Intents - Transfer USDC across chains",
      name: "ROZO Intents",
      icons: [
        "https://imagedelivery.net/AKLvTMvIg6yc9W08fHl1Tg/fdfef53e-91c2-4abc-aec0-6902a26d6c00/80x",
      ],
      network: WalletNetwork.PUBLIC,
    }),
  ],
});

export const rozoPayConfig = createConfig(
  getDefaultConfigRozo({
    appName: "Rozo Pay Basic Demo",
  })
);

const queryClient = new QueryClient();

export function Providers(props: { children: ReactNode }) {
  return (
    <WagmiProvider config={rozoPayConfig}>
      <QueryClientProvider client={queryClient}>
        <RozoPayProvider
          debugMode
          mode="dark"
          stellarKit={stellarKit}
          stellarWalletPersistence={false}
        >
          {props.children}
        </RozoPayProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
