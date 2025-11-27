# Chain-Specific Address Types in RozoPayButton

## Overview

The `RozoPayButton` component now uses **discriminated union types** to enforce type safety based on the target chain. The `toAddress` prop automatically adapts its type based on the `toChain` value:

- **EVM chains** (Base, Ethereum, Polygon): `toAddress` must be of type `Address` (0x... format)
- **Non-EVM chains** (Solana, Stellar): `toAddress` must be of type `string`

This ensures compile-time type safety and prevents address format mismatches.

## Supported Chains

### EVM Chains

- **Base**: Chain ID `8453`
- **Ethereum**: Chain ID `1`
- **Polygon**: Chain ID `137`

### Non-EVM Chains

- **Solana**: Chain ID `900` (Rozo Solana)
- **Stellar**: Chain ID `1500` (Rozo Stellar)

## Usage Examples

### Example 1: Base (EVM)

```typescript
import { RozoPayButton } from "@rozoai/intent-pay";

<RozoPayButton
  appId="your-app-id"
  toChain={8453} // Base
  toAddress="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" // Must be Address type
  toToken="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC on Base
  toUnits="1000000" // 1 USDC (6 decimals)
  toCallData="0x..." // Optional: Smart contract call
  refundAddress="0x..." // Optional: Refund destination
  onPaymentCompleted={(event) => {
    console.log("Payment completed!", event);
  }}
/>;
```

### Example 2: Ethereum (EVM)

```typescript
<RozoPayButton
  appId="your-app-id"
  toChain={1} // Ethereum
  toAddress="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" // Must be Address type
  toToken="0x0000000000000000000000000000000000000000" // Native ETH (zero address)
  toUnits="1000000000000000000" // 1 ETH (18 decimals)
/>
```

### Example 3: Polygon (EVM)

```typescript
<RozoPayButton
  appId="your-app-id"
  toChain={137} // Polygon
  toAddress="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" // Must be Address type
  toToken="0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" // USDC on Polygon
  toUnits="1000000" // 1 USDC (6 decimals)
  intent="Purchase" // Custom intent verb
/>
```

### Example 4: Solana (Non-EVM)

```typescript
<RozoPayButton
  appId="your-app-id"
  toChain={900} // Rozo Solana
  toAddress="DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK" // Must be string (Base58)
  toToken="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC on Solana
  toUnits="1000000" // 1 USDC (6 decimals)
  // Note: toCallData and refundAddress not available for Solana
/>
```

### Example 5: Stellar (Non-EVM)

```typescript
<RozoPayButton
  appId="your-app-id"
  toChain={1500} // Rozo Stellar
  toAddress="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" // Must be string (G... format)
  toToken="USDC" // Asset code on Stellar
  toUnits="1" // 1 USDC
  // Note: toCallData and refundAddress not available for Stellar
/>
```

## Type Safety Features

### ✅ Compile-Time Type Checking

TypeScript will enforce the correct address format:

```typescript
// ✅ CORRECT - EVM address for Base
<RozoPayButton
  toChain={8453}
  toAddress="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  // ... other props
/>

// ✅ CORRECT - String address for Solana
<RozoPayButton
  toChain={900}
  toAddress="DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK"
  // ... other props
/>

// ❌ COMPILE ERROR - Wrong address format for Solana
<RozoPayButton
  toChain={900}
  toAddress="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" // Should be Base58, not EVM
  // ... other props
/>
```

### 🔒 EVM-Only Props

Some props are only available for EVM chains:

```typescript
// ✅ CORRECT - toCallData available for EVM
<RozoPayButton
  toChain={8453} // Base
  toAddress="0x..."
  toCallData="0x..." // Smart contract call
  refundAddress="0x..." // Refund destination
/>

// ❌ COMPILE ERROR - toCallData not available for Solana
<RozoPayButton
  toChain={900} // Solana
  toAddress="DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK"
  toCallData="0x..." // ← TypeScript error: Property doesn't exist
/>
```

### 🛡️ Runtime Validation

The component validates address formats at runtime and logs helpful error messages:

```typescript
// This will log an error to console if address format is invalid
<RozoPayButton
  toChain={900} // Solana
  toAddress="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" // Invalid Solana address
  // ... other props
/>

// Console output:
// [RozoPayButton] Invalid address format for Solana (chain 900).
// Received: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb.
// Expected format: Base58 encoded address (32-44 chars)
```

## Address Format Reference

### EVM Address Format

- **Pattern**: `0x` followed by 40 hexadecimal characters
- **Example**: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
- **Validation**: `/^0x[a-fA-F0-9]{40}$/`

### Solana Address Format

- **Pattern**: Base58 encoded string, 32-44 characters
- **Example**: `DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK`
- **Validation**: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`
- **Note**: No 0, O, I, or l characters (Base58 alphabet)

### Stellar Address Format

- **Pattern**: Starts with `G`, followed by 55 uppercase alphanumeric characters
- **Example**: `GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- **Validation**: `/^G[A-Z2-7]{55}$/`
- **Note**: Uses Base32 encoding

## Migration from v0.0.22

### Before (Old API)

```typescript
// Separate props for each chain type
<RozoPayButton
  toChain={8453}
  toAddress="0x..." // EVM only
  toStellarAddress="G..." // Stellar only
  toSolanaAddress="D..." // Solana only
  // ... other props
/>
```

### After (New API)

```typescript
// Unified toAddress prop that adapts based on toChain
<RozoPayButton
  toChain={8453} // Base
  toAddress="0x..." // Type automatically enforced based on toChain
  // ... other props
/>

<RozoPayButton
  toChain={1500} // Stellar
  toAddress="G..." // Different chain, different address format
  // ... other props
/>
```

## Helper Functions

The SDK exports helper functions for address validation:

```typescript
import {
  isEvmChain,
  isSolanaChain,
  isStellarChain,
  validateAddressForChain,
  isValidEvmAddress,
  isValidSolanaAddress,
  isValidStellarAddress,
} from "@rozoai/intent-pay";

// Check chain type
const isEvm = isEvmChain(8453); // true
const isSol = isSolanaChain(900); // true
const isStellar = isStellarChain(1500); // true

// Validate specific address formats
const evmValid = isValidEvmAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"); // true
const solValid = isValidSolanaAddress(
  "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK"
); // true
const stellarValid = isValidStellarAddress("GXXXXXX..."); // true/false

// Validate address for specific chain
const valid = validateAddressForChain(
  8453, // Base
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
); // true
```

## Common Props (All Chains)

These props are available for all chain types:

```typescript
type CommonProps = {
  appId: string; // Your app ID
  toUnits?: string; // Amount to send
  intent?: string; // Intent verb (e.g., "Pay", "Deposit")
  paymentOptions?: string[]; // Allowed payment methods
  preferredChains?: number[]; // Preferred chain IDs
  preferredTokens?: Array<{
    // Preferred tokens
    chain: number;
    address: string | Address;
  }>;
  evmChains?: number[]; // Allowed EVM chains
  externalId?: string; // Correlation ID
  metadata?: object; // Developer metadata
};
```

## EVM-Specific Props

These props are only available when `toChain` is an EVM chain:

```typescript
type EvmOnlyProps = {
  toCallData?: Hex; // Contract call data
  refundAddress?: Address; // Refund destination
};
```

## Best Practices

1. **Always use the correct chain ID** - Use the exported constants or documented chain IDs
2. **Validate addresses before passing** - Use the helper functions to validate addresses
3. **Handle errors gracefully** - Check console for validation warnings during development
4. **Type your components** - Let TypeScript guide you to the correct prop combinations
5. **Test across chains** - Ensure your integration works with all supported chains

## TypeScript Support

The SDK provides full TypeScript support with:

- Discriminated union types for compile-time safety
- Type guards for runtime checks
- Helpful IDE autocomplete
- Inline JSDoc documentation

Your IDE will show only relevant props based on the `toChain` value!
