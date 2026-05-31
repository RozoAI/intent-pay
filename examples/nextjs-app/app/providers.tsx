"use client"

import { ThemeProvider } from "@/components/theme-provider"
import {
  getDefaultConfig as getDefaultConfigRozo,
  RozoPayProvider,
} from "@rozoai/intent-pay"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import { useState, type ReactNode } from "react"
import { createConfig, WagmiProvider } from "wagmi"

const queryClient = new QueryClient()

function RozoPayProviderWithTheme({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme()
  const mode = resolvedTheme === "dark" ? "dark" : "light"

  return (
    <RozoPayProvider debugMode mode={mode} stellarWalletPersistence={false}>
      {children}
    </RozoPayProvider>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  const [rozoPayConfig] = useState(() =>
    createConfig(
      getDefaultConfigRozo({
        appName: "Rozo Pay Playground",
        ssr: true,
      })
    )
  )

  return (
    <WagmiProvider config={rozoPayConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <RozoPayProviderWithTheme>{children}</RozoPayProviderWithTheme>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
