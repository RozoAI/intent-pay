# Intent Pay

Rozo Intent Pay enables seamless crypto payments for your app.
Onboard users from any chain, any coin into your app with one click and maximize your conversion.

## Features

- 🌱 Instant cross-chain payments — Accept payment from 1000+ tokens on multiple chains. Payments complete in less than 1 minute. We handle the swapping
  and bridging so that your customers don't have to.
- 💡 Pay with a single transaction - No more wallet round-trips to make approval, swap, or bridging transactions. Your customers pay with a single transfer transaction.
- ⚡️ Fully permissionless - Rozo Pay never custodies funds and funds can never be stuck in a contract. Payments can be permissionlessly completed by anyone.
- 💱 Support for all major wallets and exchanges - Rozo Pay supports payments from browser wallets like MetaMask and Rabby, as well as exchanges like Coinbase and Binance.
- 💨 Integrate within minutes - Get up and running with Rozo Pay in as little as 10 minutes with little to no code.

## Supported Infrastructure

### Supported Wallets

**EVM Wallets:** MetaMask, Coinbase Wallet, Trust Wallet, Rainbow Wallet, Family Wallet, Zerion, OKX, Bitget

**Solana Wallets:** Phantom, Backpack, Solflare

**Stellar Wallets:** Albedo, Freighter, Hot Wallet, etc. (Refer to: <https://stellarwalletskit.dev/#compatible-wallets>)

**Mobile Wallets:** All above wallets with mobile app support and deep-linking

### Supported Chains

**Currently Active in Wallet Payment Options:**

- **Base** (Chain ID: 8453) - USDC
- **Polygon** (Chain ID: 137) - USDC
- **Ethereum** (Chain ID: 1) - USDC
- **BSC** (Chain ID: 56) - USDT _(conditional: enabled for MugglePay appId related)_
- **Worldchain** (Chain ID: 480) - USDC _(conditional: enabled for World appId related)_
- **Solana** (Chain ID: 900) - USDC
- **Stellar** (Chain ID: 1500) - USDC/XLM

**Full Supported Chain Network:**

The SDK has full infrastructure support for the following chains, though not all are currently active in wallet payment options:

- **EVM Chains:** Arbitrum (42161), Base (8453), BSC (56), Ethereum (1), Polygon (137), Worldchain (480)
- **Non-EVM Chains:** Solana (900), Stellar (1500)

### Supported Tokens

**Currently Active in Wallet Payment Options:**

- **Base USDC** - `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Polygon USDC** - `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- **Ethereum USDC** - `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- **BSC USDT** - `0x55d398326f99059fF775485246999027B3197955`
- **Worldchain USDC** - `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1`
- **Solana USDC** - `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **Stellar USDC** - `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`

**Full Token Support Per Chain:**

The SDK currently supports USDC as the primary payment token across all active chains. Additional token support includes USDT on BSC (conditional) and XLM on Stellar. The SDK automatically handles cross-chain routing and bridging for supported tokens.

### External Payment Options

**Exchanges:** Coinbase, Binance, Lemon

**Payment Apps:** Venmo, CashApp, MercadoPago, Revolut, Wise

**Other:** RampNetwork, deposit addresses, ZKP2P (Zero-Knowledge Proofs to PayPal)

and much more...

## Documentation

You can find the full Rozo Pay documentation at [pay.rozoai.com](https://docs.rozo.ai).

## Examples

Check out the [Next.js example app](https://github.com/RozoAI/intent-pay/tree/master/examples/nextjs-app)

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
