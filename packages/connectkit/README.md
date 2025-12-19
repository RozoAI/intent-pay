# Intent Pay

Rozo Intent Pay enables seamless crypto payments for your app.
Onboard users from any chain, any coin into your app with one click and maximize your conversion.

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

## Examples

Check out complete examples and code snippets at [Complete Examples](https://docs.rozo.ai/integration/rozointentpay/examples), including:

- Framework-specific examples (Next.js, Vite/CRA)
- Use case examples (E-commerce checkout, Donation component, Stellar payout)
- Complete code examples ready to copy-paste

You can also check out the [Next.js example app](https://github.com/RozoAI/intent-pay/tree/master/examples/nextjs-app) in this repository.

## Demo

Check out our Demo Page at [demo.rozo.ai](https://demo.rozo.ai/)

### Local Development

Clone the repository and build the SDK in `dev` mode:

```sh
git clone https://github.com/RozoAI/intent-pay.git
cd pay/packages/connectkit
pnpm i
pnpm run dev
```

The rollup bundler will now watch file changes in the background. Try using one of the examples for testing:

```sh
cd examples/nextjs
pnpm i
pnpm run dev
```

Any changes will be reflected on the Pay button in the example app.

## Contracts

Daimo Pay is noncustodial and runs on open-source, audited contracts. See `/packages/contract`.

Audits:

- [Nethermind, 2025 Apr](https://github.com/user-attachments/files/20544714/NM-0500-Daimo-Pay-final-report.pdf)

## Support

[Contact us](mailto:hi@rozo.ai) if you'd like to integrate Rozo Pay.

## License

See [LICENSE](https://github.com/RozoAI/intent-pay/blob/master/packages/connectkit/LICENSE) for more information.

## Credits

Rozo Intent Pay SDK is a fork of [Daimo](https://github.com/daimo-eth/pay) developed by [Daimo](https://daimo.com). We're grateful to them for making cross chain payment fast, simple and open-source.

Daimo Pay SDK is a fork of [Connectkit](https://github.com/family/connectkit) developed by [Family](https://family.co). We're grateful to them for making Connectkit fast, beatiful and open-source.

## How to release `connectkit` package

## Release

```sh
pnpm run release
```

Choose the version on the prompt.
