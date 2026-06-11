"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { createHeadlessStellarKit } from "@/lib/e2e-stellar-kit"
import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit"
import {
  getDefaultConfig as getDefaultConfigRozo,
  RozoPayProvider,
} from "@rozoai/intent-pay"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import posthog from "posthog-js"
import { useState, type ReactNode } from "react"
import { createConfig, WagmiProvider } from "wagmi"

const queryClient = new QueryClient()

function RozoPayProviderWithTheme({
  children,
  stellarKit,
}: {
  children: ReactNode
  stellarKit?: StellarWalletsKit
}) {
  const { resolvedTheme } = useTheme()
  const mode = resolvedTheme === "dark" ? "dark" : "light"

  return (
    <RozoPayProvider
      debugMode
      mode={mode}
      stellarWalletPersistence={false}
      posthog={posthog}
      stellarKit={stellarKit}
    >
      {children}
    </RozoPayProvider>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  const [rozoPayConfig] = useState(() =>
    createConfig(
      getDefaultConfigRozo({
        appName: "Rozo Pay Playground",
      })
    )
  )

  // E2E-only: drive Stellar pay-in with a headless secret-key signer (no
  // Freighter extension). The secret is ONLY ever provided at runtime via
  // window.__E2E_STELLAR_SECRET__, which Playwright injects before the app loads
  // (see e2e helper useStellarSigner). There is no env-var path, so the headless
  // kit can never activate in the real playground or production — its presence
  // is, by definition, E2E test mode.
  //
  // Constructed once on the client in the state initializer so the external kit
  // is present on the first client render — this prevents the SDK from spinning
  // up its own internal (Freighter-based) kit.
  const [stellarKit] = useState<StellarWalletsKit | undefined>(() => {
    if (typeof window === "undefined") return undefined

    const secret = (window as Window & { __E2E_STELLAR_SECRET__?: string })
      .__E2E_STELLAR_SECRET__
    if (!secret) return undefined
    try {
      return createHeadlessStellarKit(secret)
    } catch (err) {
      console.error("[E2E] Failed to create headless Stellar kit:", err)
      return undefined
    }
  })

  return (
    <WagmiProvider config={rozoPayConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <RozoPayProviderWithTheme stellarKit={stellarKit}>
            {children}
          </RozoPayProviderWithTheme>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
