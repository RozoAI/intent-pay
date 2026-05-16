"use client";

import {
  getDefaultConfig as getDefaultConfigRozo,
  RozoPayProvider,
} from "@rozoai/intent-pay";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createConfig, WagmiProvider } from "wagmi";

const queryClient = new QueryClient();

export function Providers(props: { children: ReactNode }) {
  const [rozoPayConfig] = useState(() =>
    createConfig(
      getDefaultConfigRozo({
        appName: "Rozo Pay Deposit Demo",
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
