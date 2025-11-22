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
<RozoPayButton
  appId="your-app-id"
  toChain={chainId}
  toAddress={recipientAddress}
  toToken={tokenAddress}
  toUnits={amount}
  onPaymentStarted={(event) => console.log(event)}
  onPaymentCompleted={(event) => console.log(event)}
/>
```

### Event Callbacks

Track payment lifecycle with built-in callbacks:

- `onPaymentStarted`: Triggered when user initiates payment
- `onPaymentCompleted`: Triggered when payment is confirmed on-chain
- `onPayoutCompleted`: Triggered when funds arrive at destination

## Developer Notes

- Uses `react-syntax-highlighter` for clean code display
- Implements `useCallback` and `useMemo` to prevent unnecessary re-renders
- Persists configuration to localStorage for better UX
- Automatically validates addresses and configuration

## Props Reference

| Prop | Type | Description |
|------|------|-------------|
| `appId` | `string` | Your RozoAI Intent Pay application ID |
| `toChain` | `number` | Destination blockchain network ID |
| `toAddress` | `Address` | Recipient wallet address (checksummed) |
| `toToken` | `Address` | Token contract address to receive |
| `toUnits` | `string` | Amount in token's smallest unit |
| `onPaymentStarted` | `(event) => void` | Payment initiation callback |
| `onPaymentCompleted` | `(event) => void` | Payment completion callback |

## Cross-Chain Payments

For Stellar/Solana destinations, use bridge configuration:

```typescript
<RozoPayButton
  appId="your-app-id"
  toChain={8453} // Base Chain
  toToken="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // Base USDC
  toAddress="0x..." // Any EVM address
  toStellarAddress="GABC..." // or toSolanaAddress
  toUnits="1000000"
/>
```

## Learn More

- [RozoAI Intent Pay Documentation](https://github.com/rozoai/intent-pay)
- [Supported Chains & Tokens](https://docs.rozo.ai)
- [API Reference](https://docs.rozo.ai/api)
