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
  // Create wagmi config lazily inside the client component so that any
  // localStorage access triggered by wallet SDKs happens only in the browser.
  const [rozoPayConfig] = useState(() =>
    createConfig(
      getDefaultConfigRozo({
        appName: "Rozo Pay Basic Demo",
        ssr: true,
      }),
    ),
  );

  return (
    <WagmiProvider config={rozoPayConfig}>
      <QueryClientProvider client={queryClient}>
        <RozoPayProvider debugMode mode="dark">
          {props.children}
        </RozoPayProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
