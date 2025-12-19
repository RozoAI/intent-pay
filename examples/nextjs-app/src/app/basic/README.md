# Basic Payment Demo

The simplest integration example showing how to accept payments from any coin on any supported blockchain network using the RozoAI Intent Pay SDK.

## Overview

This demo showcases a minimal implementation of `RozoPayButton` that enables cross-chain cryptocurrency payments with just a few lines of code.

## Features

- ✅ Accept payments from any supported chain (EVM, Solana, Stellar)
- ✅ Real-time payment tracking with event callbacks
- ✅ Auto-generated implementation code with syntax highlighting
- ✅ Interactive configuration panel
- ✅ Cross-chain bridging support

## Quick Start

1. **Configure Payment Settings**: Click "Configure Payment Settings" to set up your recipient address, chain, token, and amount.

2. **Test the Payment**: Once configured, use the "Make Payment" button to test the payment flow.

3. **Copy Implementation Code**: The generated TypeScript code is ready to copy into your project.

## Key Components

### RozoPayButton

The main payment component that handles the entire payment flow:

```typescript
import { TokenSymbol } from "@rozoai/intent-common";
import { RozoPayButton } from "@rozoai/intent-pay";

<RozoPayButton
  appId="your-app-id"
  toChain={chainId}
  toAddress={recipientAddress}
  toToken={tokenAddress}
  toUnits={amount}
  preferredSymbol={[TokenSymbol.USDC, TokenSymbol.USDT]}
  onPaymentStarted={(event) => console.log(event)}
  onPaymentCompleted={(event) => console.log(event)}
/>;
```

### Event Callbacks

Track payment lifecycle with built-in callbacks:

- `onPaymentStarted`: Triggered when user initiates payment
- `onPaymentCompleted`: Triggered when payment is confirmed on-chain
- `onPayoutCompleted`: Triggered when funds arrive at destination

### Preferred Token Symbols

The `preferredSymbol` prop allows you to specify which token symbols should appear first in the token selection list. This is useful for prioritizing specific stablecoins across all supported chains.

**Key Features:**

- **Supported Symbols**: Only `USDC`, `USDT`, and `EURC` are allowed
- **Default Behavior**: If not provided, defaults to `[USDC, USDT]`
- **Cross-Chain**: Automatically finds matching tokens across all supported chains (Base, Polygon, Ethereum, Solana, Stellar)
- **Precedence**: If `preferredTokens` is explicitly provided, it takes precedence over `preferredSymbol`

**Example Usage:**

```typescript
import { TokenSymbol } from "@rozoai/intent-common";

// Prioritize USDC and USDT (default)
<RozoPayButton
  preferredSymbol={[TokenSymbol.USDC, TokenSymbol.USDT]}
  // ... other props
/>

// Prioritize EURC only
<RozoPayButton
  preferredSymbol={[TokenSymbol.EURC]}
  // ... other props
/>

// Multiple preferred symbols
<RozoPayButton
  preferredSymbol={[TokenSymbol.USDC, TokenSymbol.USDT, TokenSymbol.EURC]}
  // ... other props
/>
```

**How It Works:**

- The `preferredSymbol` array is internally converted to a `preferredTokens` array
- The SDK searches for all tokens matching the specified symbols across supported chains
- These tokens are then prioritized in the token selection UI
- Invalid symbols are filtered out with a console warning

## Developer Notes

- Uses `react-syntax-highlighter` for clean code display
- Implements `useCallback` and `useMemo` to prevent unnecessary re-renders
- Persists configuration to localStorage for better UX
- Automatically validates addresses and configuration

## Props Reference

| Prop                 | Type              | Description                                                                                                                         |
| -------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `appId`              | `string`          | Your RozoAI Intent Pay application ID                                                                                               |
| `toChain`            | `number`          | Destination blockchain network ID                                                                                                   |
| `toAddress`          | `Address`         | Recipient wallet address (checksummed)                                                                                              |
| `toToken`            | `Address`         | Token contract address to receive                                                                                                   |
| `toUnits`            | `string`          | Amount in token's smallest unit                                                                                                     |
| `preferredSymbol`    | `TokenSymbol[]`   | Preferred token symbols (USDC, USDT, EURC). These tokens will appear first in the token selection list. Defaults to `[USDC, USDT]`. |
| `onPaymentStarted`   | `(event) => void` | Payment initiation callback                                                                                                         |
| `onPaymentCompleted` | `(event) => void` | Payment completion callback                                                                                                         |

## Cross-Chain Payments

For Stellar/Solana destinations, use bridge configuration:

```typescript
import { TokenSymbol } from "@rozoai/intent-common";

<RozoPayButton
  appId="your-app-id"
  toChain={8453} // Base Chain
  toToken="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // Base USDC
  toAddress="0x..." // Any EVM address
  toStellarAddress="GABC..." // or toSolanaAddress
  toUnits="1000000"
  preferredSymbol={[TokenSymbol.USDC, TokenSymbol.USDT]}
/>;
```

## Learn More

- [RozoAI Intent Pay Documentation](https://github.com/rozoai/intent-pay)
- [Supported Chains & Tokens](https://docs.rozo.ai)
- [API Reference](https://docs.rozo.ai/api)
