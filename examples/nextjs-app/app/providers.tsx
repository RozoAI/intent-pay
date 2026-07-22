"use client"

import { ThemeProvider } from "@/components/theme-provider"
import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit"
import {
  getDefaultConfig as getDefaultConfigRozo,
  RozoPayProvider,
} from "@rozoai/intent-pay"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import posthog from "posthog-js"
import { useState, type ReactNode } from "react"
import {
  cookieStorage,
  cookieToInitialState,
  createConfig,
  createStorage,
  WagmiProvider,
} from "wagmi"

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
      suppressModal={false} // Set to true when using RozoPayCard exclusively
    >
      {children}
    </RozoPayProvider>
  )
}

export function Providers({
  children,
  cookie,
}: {
  children: ReactNode
  cookie?: string | null
}) {
  const [rozoPayConfig] = useState(() =>
    createConfig(
      getDefaultConfigRozo({
        appName: "Rozo Pay Playground",
        ssr: true,
        storage: createStorage({ storage: cookieStorage }),
      })
    )
  )
  const initialState = cookieToInitialState(rozoPayConfig, cookie)

  // E2E-only: drive Stellar pay-in with a headless secret-key signer (no
  // Freighter extension). Only active when the build was started with
  // NEXT_PUBLIC_E2E=1 (set by the Playwright webServer config), so production
  // builds dead-code-eliminate the entire import graph at bundle time.
  //
  // The secret is read from window.__E2E_STELLAR_SECRET__ (injected by
  // Playwright's addInitScript before the app loads) and immediately deleted
  // from the window to limit exposure to any analytics or third-party scripts
  // that run later in the same page session.
  const [stellarKit] = useState<StellarWalletsKit | undefined>(() => {
    if (typeof window === "undefined") return undefined
    if (!process.env.NEXT_PUBLIC_E2E) return undefined

    const w = window as Window & { __E2E_STELLAR_SECRET__?: string }
    const secret = w.__E2E_STELLAR_SECRET__
    // Delete immediately so the key isn't readable later in the session.
    delete w.__E2E_STELLAR_SECRET__
    if (!secret) return undefined

    try {
      // Dynamic import is resolved at build time only when NEXT_PUBLIC_E2E=1,
      // so the stellarWalletsKit bundle never enters the production chunk graph.
      const { createHeadlessStellarKit } =
        require("@/lib/e2e-stellar-kit") as typeof import("@/lib/e2e-stellar-kit")
      return createHeadlessStellarKit(secret)
    } catch (err) {
      console.error("[E2E] Failed to create headless Stellar kit:", err)
      return undefined
    }
  })

  return (
    <WagmiProvider config={rozoPayConfig} initialState={initialState}>
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
