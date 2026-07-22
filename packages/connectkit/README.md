# Intent Pay

Rozo Intent Pay enables seamless crypto payments for your app.
Onboard users from any chain, any coin into your app with one click and maximize your conversion.

## Quickstart — Get your `appId` and run a payment

Every payment takes a required `appId`. **You do not need to email anyone or wait for approval to get one** — `appId` is a namespace string you choose to group your transactions in the Rozo dashboard.

There are two ways to get going:

### 1. Try it now with the public sandbox `appId`

Use the shared sandbox `appId` `rozoSandbox` to run the SDK end-to-end immediately, no signup required:

```tsx
"use client";
import { RozoPayButton } from "@rozoai/intent-pay";

<RozoPayButton
  appId="rozoSandbox"          // public shared sandbox — testing only
  toChain={8453}               // Base
  toAddress="0xRecipient..."   // your receiving address
  toToken="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC on Base
  toUnits="1"                  // display amount, in USDC (string, not base units)
  intent="Pay"
  preferredSymbol={["USDC", "USDT"]}
  onPaymentCompleted={(e) => console.log("done", e.paymentId)}
/>
```

> `rozoSandbox` is a **shared, public** sandbox namespace meant only for trying the SDK out. **Do not use it in production** — transactions under it are co-mingled with everyone else's test traffic and the namespace may be cleared at any time. Switch to your own `appId` (below) before you ship.

### 2. Get a production `appId` + API key (self-serve, no approval)

When you're ready for production — your own namespace, webhook events, branded checkout, and API-key auth — self-register through the Rozo merchant portal. It's a 2-minute, fully self-serve flow (email OTP → pick a slug → done). No human approval step:

1. Open the [Rozo Partners portal](https://partners.rozo.ai/) and enter your email; you'll get a 6-digit code.
2. Choose **"Wallet (Dapp developer)"** as the account type (developers don't need to provide a settlement wallet — that's only for merchants).
3. Pick a slug (e.g. `coffee-studio`). The portal derives your `appId` automatically: `wallet_<slug>` (or `merchant_<slug>` for merchant accounts).
4. You're dropped into **Settings → API Keys**, where you issue your first `rz_live_...` API key (shown once — copy it). Pass it as the `X-API-Key` header when your `appId` uses a portal-issued prefix.

That's the whole loop — no email to support, no domain whitelisting request.

### Minimal end-to-end (provider → button → result)

```bash
npm install @rozoai/intent-pay @rozoai/intent-common \
  @tanstack/react-query wagmi viem \
  @creit.tech/stellar-wallets-kit @stellar/stellar-sdk
```

```tsx
// providers.tsx — wrap your app once (see docs/PROVIDER_SETUP.md for SSR details)
"use client";
import { getDefaultConfig, RozoPayProvider } from "@rozoai/intent-pay";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createConfig, WagmiProvider } from "wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
  const [config] = useState(() =>
    createConfig(getDefaultConfig({
      appName: "Your App",
      ssr: true,
      // Optional: Base builder code attribution (https://docs.base.org/apps/builder-codes)
      // dataSuffix: Attribution.toDataSuffix({ codes: [process.env.NEXT_PUBLIC_BASE_BUILDER_CODE] }),
    })));
  const [qc] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>
        <RozoPayProvider>{children}</RozoPayProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

Then drop a `<RozoPayButton appId="rozoSandbox" ... />` (snippet above) anywhere inside the provider and read the result from `onPaymentCompleted`, or poll with the `useRozoPayStatus()` hook / `getPayment(id)` on your backend.

> **Embedding inside a wallet's in-app browser (Base App, MetaMask, Phantom)?** `ssr: true` alone does not eliminate the auto-connect flash on first load — you also need cookie-persisted `initialState`. See [PROVIDER_SETUP.md § Minimizing the Wallet Reconnect Flash](../../docs/PROVIDER_SETUP.md#minimizing-the-wallet-reconnect-flash-in-app-browsers) (required, not optional, for this use case).

> **Result truth lives on the backend.** Treat `onPaymentCompleted` as a UI hint and confirm settlement server-side (webhook or `getPayment`) before fulfilling.

## RozoPayCard — Inline Payment Card

RozoPayCard is an alternative to RozoPayButton that embeds the payment flow directly in your page layout. No modal, no redirect — just a clean two-panel card.

### When to use RozoPayCard

- **Embedded checkout** — when you want the payment UI to be part of your page, not a popup
- **Merchants** — for a seamless, branded payment experience
- **Dedicated payment pages** — when you have space for a full card layout

### Quick start

```tsx
import { RozoPayCard } from "@rozoai/intent-pay";

// Inside RozoPayProvider
<RozoPayCard
  payId="pay_abc123"
  width={480}
  onPaymentCompleted={(e) => console.log("done", e.paymentId)}
/>
```

### Features

- **Two-panel layout** — wallet list on left, payment action on right
- **Recently used wallets** — remembers last 5 wallets via cookie
- **Multi-network wallets** — MetaMask/Phantom show Ethereum/Solana choice
- **All tokens** — shows tokens across all networks, sorted by balance
- **Responsive** — two-column on desktop, stacked on mobile
- **Dark/light mode** — inherits from RozoPayProvider
- **Intercom help** — built-in support trigger in footer

### Props

RozoPayCard accepts the same payment props as RozoPayButton, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `number \| string` | `480` | Card width in pixels |
| `height` | `number \| string` | `auto` | Card height |
| `className` | `string` | — | CSS class name |
| `style` | `React.CSSProperties` | — | Inline styles |

### Provider setup

```tsx
import { RozoPayProvider, RozoPayCard } from "@rozoai/intent-pay";

// Use suppressModal to prevent modal from rendering
<RozoPayProvider payApiUrl="..." suppressModal>
  <RozoPayCard
    payId="pay_abc123"
    onPaymentCompleted={(e) => console.log(e)}
  />
</RozoPayProvider>
```

### Wallet sources

1. **Recently Used** — cookie storage (`rk_recent_wallets`), 30-day expiry, max 5 entries
2. **Available** — detected wallets (MetaMask, Phantom, Coinbase, etc.)
3. **Others** — WalletConnect via Reown AppKit (lazy-loaded on click)

## Features

- 🌱 Cross-chain payments from 1000+ tokens in under 1 minute.
- 💡 Single transaction — no multiple wallet steps.
- ⚡️ Permissionless — we never hold funds.
- 💱 Works with major wallets and exchanges.
- 💨 Integrate in minutes, minimal code required.

## Supported Infrastructure

### Supported Wallets

**EVM Wallets:** MetaMask, Coinbase Wallet, Trust Wallet, Rainbow Wallet, Family Wallet, Zerion, OKX, Bitget

**Solana Wallets:** Phantom, Backpack, Solflare

**Stellar Wallets:** Albedo, Freighter, Hot Wallet, etc. (Refer to: <https://stellarwalletskit.dev/#compatible-wallets>)

**Mobile Wallets:** All above wallets with mobile app support and deep-linking

### Supported Chains

For a complete list of supported tokens and chains, see the [Supported Tokens and Chains documentation](https://docs.rozo.ai/integration/api-doc/supported-tokens-and-chains).

## Documentation

You can find the full Rozo Pay documentation at [docs.rozo.ai](https://docs.rozo.ai).

For in-repo SDK prop reference, see [RozoPayButton Props](https://github.com/RozoAI/intent-pay/blob/master/docs/ROZO_PAY_BUTTON_PROPS.md).

For correct provider setup (Next.js App Router, Vite, SSR patterns), see [Provider Setup Guide](https://github.com/RozoAI/intent-pay/blob/master/docs/PROVIDER_SETUP.md).

For analytics, telemetry opt-out, and what data is tracked, see [Analytics & Telemetry](https://github.com/RozoAI/intent-pay/blob/master/docs/ANALYTICS.md).

## Examples

Check out complete examples and code snippets at [Complete Examples](https://docs.rozo.ai/integration/rozointentpay/examples), including:

- Framework-specific examples (Next.js, Vite/CRA)
- Use case examples (E-commerce checkout, Donation component, Stellar payout)
- Complete code examples ready to copy-paste

You can also check out the [Next.js example app](https://github.com/RozoAI/intent-pay/tree/master/examples/nextjs-app) in this repository.

## Demo

Check out our Demo Page at [demo.rozo.ai](https://demo.rozo.ai/)

You can also try the intent-based bridge built with this SDK at [intents.rozo.ai/bridge](https://intents.rozo.ai/bridge?utm_source=npm&utm_medium=readme).

### Local Development

Clone the repository and build the SDK in `dev` mode:

```sh
git clone https://github.com/RozoAI/intent-pay.git
cd intent-pay/packages/connectkit
pnpm i
pnpm run dev
```

The rollup bundler will now watch file changes in the background. Try using one of the examples for testing:

```sh
cd examples/nextjs-app
pnpm i
pnpm run dev
```

Any changes will be reflected on the Pay button in the example app.

## Contracts

Daimo Pay is noncustodial and runs on open-source, audited contracts. See [`packages/contract`](https://github.com/RozoAI/intent-pay/tree/master/packages/contract).

Audits:

- [Nethermind, 2025 Apr](https://github.com/user-attachments/files/20544714/NM-0500-Daimo-Pay-final-report.pdf)

## Support

[Contact us](mailto:hi@rozo.ai) if you'd like to integrate Rozo Pay.

## License

See [LICENSE](https://github.com/RozoAI/intent-pay/blob/master/packages/connectkit/LICENSE) for more information.

## Credits

Rozo Intent Pay SDK is a fork of [Daimo](https://github.com/daimo-eth/pay) developed by [Daimo](https://daimo.com). We're grateful to them for making cross chain payment fast, simple and open-source.

Daimo Pay SDK is a fork of [Connectkit](https://github.com/family/connectkit) developed by [Family](https://family.co). We're grateful to them for making Connectkit fast, beatiful and open-source.

## Release

To publish a new version of `@rozoai/intent-pay`:

```sh
# Beta release (bumps prerelease version, publishes with `beta` tag)
pnpm run publish:beta

# Latest release (bumps stable version, updates CHANGELOG, publishes with `latest` tag)
pnpm run publish:latest
```
