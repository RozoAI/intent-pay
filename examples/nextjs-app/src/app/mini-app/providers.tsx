"use client";

import {
  getDefaultConfig as getDefaultConfigRozo,
  RozoPayProvider,
} from "@rozoai/intent-pay";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createConfig, WagmiProvider } from "wagmi";
import { farcasterConnector } from "./farcaster-connector";

const queryClient = new QueryClient();

export function Providers(props: { children: ReactNode }) {
  const [rozoPayConfig] = useState(() =>
    createConfig(
      getDefaultConfigRozo({
        appName: "Rozo Pay Farcaster Frame Demo",
        additionalConnectors: [farcasterConnector()],
        ssr: true,
      })
    )
  );

  return (
    <WagmiProvider config={rozoPayConfig}>
      <QueryClientProvider client={queryClient}>
        <RozoPayProvider>{props.children}</RozoPayProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
