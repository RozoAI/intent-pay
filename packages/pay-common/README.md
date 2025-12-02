# @rozoai/intent-common

Shared types and utilities for RozoAI Intent Pay SDK.

## Installation

```bash
npm install @rozoai/intent-common
```

## Quick Start

### Payment API (Recommended)

Use the new payment API for all new integrations:

```typescript
import { createNewPayment, getNewPayment } from "@rozoai/intent-common";

// Create a payment
const payment = await createNewPayment({
  appId: "your-app-id",
  toChain: 8453, // Base
  toToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
  toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  preferredChain: 8453,
  preferredTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  toUnits: "1",
  title: "Payment",
});

// Get payment status
const status = await getNewPayment(payment.id);
```

### Prior Payment API (Legacy)

The legacy payment API (`createRozoPayment`, `getRozoPayment`) is still available but deprecated. Use the new API above for new integrations.

## Core Exports

### Payment Bridge

Configure cross-chain payment routing:

```typescript
import { createPaymentBridgeConfig } from "@rozoai/intent-common";

const { preferred, destination } = createPaymentBridgeConfig({
  toChain: 8453,
  toToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  toAddress: "0x...",
  toUnits: "1000000",
  preferredChain: 137,
  preferredTokenAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
});
```

### Chains & Tokens

```typescript
import {
  base,
  polygon,
  baseUSDC,
  polygonUSDCe,
  getChainById,
  getKnownToken,
} from "@rozoai/intent-common";

// Chain info
const chain = getChainById(8453); // Base chain

// Token info
const token = getKnownToken(8453, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
```

## Supported Chains & Tokens

Based on `supportedTokens` Map in the codebase:

| Chain        | Chain ID | Constant      | Type    | Supported Tokens |
| ------------ | -------- | ------------- | ------- | ---------------- |
| Arbitrum     | 42161    | `arbitrum`    | EVM     | USDC, USDT       |
| Avalanche    | 43114    | `avalanche`   | EVM     | USDC, USDT       |
| Base         | 8453     | `base`        | EVM     | USDC             |
| Ethereum     | 1        | `ethereum`    | EVM     | USDC, USDT       |
| Gnosis       | 100      | `gnosis`      | EVM     | USDC, USDT       |
| Optimism     | 10       | `optimism`    | EVM     | USDC, USDT       |
| Polygon      | 137      | `polygon`     | EVM     | USDC, USDT       |
| Rozo Solana  | 900      | `rozoSolana`  | Solana  | USDC, USDT       |
| Rozo Stellar | 1500     | `rozoStellar` | Stellar | USDC             |

### Token Constants

| Token | Chain        | Constant          |
| ----- | ------------ | ----------------- |
| USDC  | Arbitrum     | `arbitrumUSDC`    |
| USDT  | Arbitrum     | `arbitrumUSDT`    |
| USDC  | Avalanche    | `avalancheUSDC`   |
| USDT  | Avalanche    | `avalancheUSDT`   |
| USDC  | Base         | `baseUSDC`        |
| USDC  | Ethereum     | `ethereumUSDC`    |
| USDT  | Ethereum     | `ethereumUSDT`    |
| USDC  | Gnosis       | `gnosisUSDC`      |
| USDT  | Gnosis       | `gnosisUSDT`      |
| USDC  | Optimism     | `optimismUSDC`    |
| USDT  | Optimism     | `optimismUSDT`    |
| USDC  | Polygon      | `polygonUSDC`     |
| USDT  | Polygon      | `polygonUSDT`     |
| USDC  | Rozo Solana  | `rozoSolanaUSDC`  |
| USDT  | Rozo Solana  | `rozoSolanaUSDT`  |
| USDC  | Rozo Stellar | `rozoStellarUSDC` |

**Example:**

```typescript
import { base, baseUSDC, polygon, polygonUSDC } from "@rozoai/intent-common";

// Use in payment config
const payment = await createNewPayment({
  toChain: base.chainId, // or 8453
  toToken: baseUSDC.token, // or "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  // ...
});
```

## TypeScript Support

Full TypeScript definitions included. All exports are typed.

## License

BSD-2-Clause
