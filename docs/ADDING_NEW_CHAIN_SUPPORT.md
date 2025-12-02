# Adding New Chain Support to RozoAI Intent Pay SDK

**Version:** v0.0.22  
**Last Updated:** November 26, 2025

This document provides a comprehensive guide for adding support for new blockchain networks to the RozoAI Intent Pay SDK. The SDK currently supports EVM chains (Base, Polygon, BSC, Worldchain), Solana, and Stellar networks.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Summary](#architecture-summary)
3. [Chain Support Levels](#chain-support-levels)
4. [Step-by-Step Implementation Guide](#step-by-step-implementation-guide)
5. [Configuration Points](#configuration-points)
6. [Testing & Verification](#testing--verification)
7. [Current Active Chains](#current-active-chains)
8. [Code Examples](#code-examples)

---

## Overview

The RozoAI Intent Pay SDK has a multi-layered architecture for chain support:

1. **Foundation Layer** (`@rozoai/intent-common` / `packages/pay-common/`): Core chain and token definitions
2. **SDK Layer** (`packages/connectkit/`): UI components, hooks, and payment flow logic
3. **Configuration Layer**: Feature flags and conditional chain enablement

Adding a new chain requires changes across all three layers, with careful consideration of which payment methods will be supported.

---

## Architecture Summary

### Package Structure

```
packages/
├── pay-common/              # Core definitions (chains, tokens, types)
│   └── src/
│       ├── chain.ts         # Chain definitions and utilities
│       ├── token.ts         # Token definitions and lookup
│       ├── bridge.ts        # Cross-chain payment routing
│       └── index.ts         # Public exports
│
└── connectkit/              # SDK components and hooks
    └── src/
        ├── hooks/
        │   ├── useSupportedChains.tsx        # Wallet payment chain filter
        │   ├── useWalletPaymentOptions.ts    # EVM wallet options
        │   ├── useDepositAddressOptions.ts   # Deposit address options
        │   └── useExternalPaymentOptions.ts  # Exchange/ZKP2P options
        ├── assets/
        │   └── chains.tsx                    # Chain logo SVG components
        └── constants/
            ├── routes.ts                     # Payment flow routes
            └── rozoConfig.ts                 # SDK configuration
```

---

## Chain Support Levels

There are **three levels** of chain support in the SDK:

### Level 1: Full Definition (Foundation)
- Chain exists in `packages/pay-common/src/chain.ts`
- Tokens defined in `packages/pay-common/src/token.ts`
- Exported via `packages/pay-common/src/index.ts`

**Currently defined chains:**
- EVM: Arbitrum, Base, BSC, Celo, Ethereum, Linea, Mantle, Optimism, Polygon, Worldchain
- Non-EVM: Solana (501), Stellar (10001), Rozo Solana (900), Rozo Stellar (1500)

### Level 2: Active Wallet Payment Options
- Chain is enabled in `packages/connectkit/src/hooks/useSupportedChains.tsx`
- Shown as a payment option in the SDK UI for wallet connections
- Users can select this chain to pay from their wallet

**Currently active in wallet payment options:**
- Base (8453) - USDC
- Polygon (137) - USDC
- BSC (56) - USDT (conditional: MugglePay apps only)
- Worldchain (480) - USDC (conditional: World apps only)
- Rozo Solana (900) - USDC (via separate hook)
- Rozo Stellar (1500) - USDC/XLM (via separate hook)

### Level 3: Active Deposit Address Options
- Chain is enabled in `packages/connectkit/src/hooks/useDepositAddressOptions.ts`
- Users can generate a deposit address on this chain
- SDK waits for on-chain deposit confirmation

**Currently active in deposit address options:**
- Base (8453)
- Polygon (137)
- BSC (56) - conditional: MugglePay apps only
- Worldchain (480) - conditional: World apps only

---

## Step-by-Step Implementation Guide

### Step 1: Define Chain in `pay-common`

**File:** `packages/pay-common/src/chain.ts`

```typescript
export type Chain = {
  type: "evm" | "solana" | "stellar";  // Add new type if needed
  chainId: number;
  name: string;
  cctpDomain: number | null;  // Circle CCTP domain if supported
};

// Example: Adding a new EVM chain (e.g., Avalanche)
export const avalanche: Chain = {
  type: "evm",
  chainId: 43114,
  name: "Avalanche",
  cctpDomain: 1,  // Set to null if not CCTP-enabled
};

// Add to supportedChains array
export const supportedChains: Chain[] = [
  arbitrum,
  avalanche,  // <-- Add here
  base,
  // ... other chains
];
```

**Important considerations:**

- **Chain ID**: Must be unique and match the official chain ID
- **Type**: Determines wallet provider logic (EVM uses Wagmi, Solana/Stellar use custom providers)
- **CCTP Domain**: Required for Circle CCTP bridge support (see [Circle docs](https://developers.circle.com/stablecoins/supported-domains))
- **Name**: User-facing display name

**Add block explorer support:**

```typescript
export function getChainExplorerByChainId(chainId: number): string | undefined {
  switch (chainId) {
    // ... existing cases
    case avalanche.chainId:
      return "https://snowtrace.io";
    default:
      return undefined;
  }
}
```

### Step 2: Define Tokens for the Chain

**File:** `packages/pay-common/src/token.ts`

```typescript
export type Token = {
  chainId: number;
  token: `0x${string}` | string;  // Token address or "native"
  name?: string;
  symbol: string;
  decimals: number;
  fiatISO?: string;  // For stablecoins: "USD", "EUR", etc.
  logoURI: TokenLogo | string;
  logoSourceURI: string;
};

// Example: Adding Avalanche tokens
export const avalancheAVAX = nativeToken({
  chainId: avalanche.chainId,
  name: "Avalanche",
  symbol: "AVAX",
  logoURI: TokenLogo.AVAX,  // Add to TokenLogo enum first
});

export const avalancheUSDC: Token = token({
  chainId: avalanche.chainId,
  token: getAddress("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"),
  name: "USD Coin",
  symbol: "USDC",
  fiatISO: "USD",
  decimals: 6,
  logoURI: TokenLogo.USDC,
});

export const avalancheUSDT: Token = token({
  chainId: avalanche.chainId,
  token: getAddress("0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7"),
  decimals: 6,
  fiatISO: "USD",
  name: "Tether USD",
  symbol: "USDT",
  logoURI: TokenLogo.USDT,
});

// Group tokens for the chain
const avalancheTokens: Token[] = [
  avalancheAVAX,
  avalancheUSDC,
  avalancheUSDT,
];

// Add to knownTokensByChain map
const knownTokensByChain = new Map<number, Token[]>([
  // ... existing chains
  [avalanche.chainId, avalancheTokens],
]);

// Add to tokensByChainAndType for standard token lookups
const tokensByChainAndType: Map<
  number,
  Partial<Record<TokenType, Token>>
> = new Map([
  // ... existing entries
  [
    avalanche.chainId,
    {
      [TokenType.NATIVE]: avalancheAVAX,
      [TokenType.NATIVE_USDC]: avalancheUSDC,
      // Add other token types as needed
    },
  ],
]);
```

**Token logo management:**

If adding a new token logo, add to the `TokenLogo` enum:

```typescript
export enum TokenLogo {
  // ... existing logos
  AVAX = "https://imagedelivery.net/AKLvTMvIg6yc9W08fHl1Tg/your-avax-logo-hash/public",
}
```

### Step 3: Export from `pay-common`

**File:** `packages/pay-common/src/index.ts`

The index file already exports everything via wildcards:

```typescript
export * from "./chain";
export * from "./token";
```

This automatically exports your new chain and token definitions.

### Step 4: Add Chain Logo to SDK

**File:** `packages/connectkit/src/assets/chains.tsx`

Create an SVG component for the chain logo:

```tsx
const Avalanche = ({ testnet }: { testnet?: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1503 1504"
    fill="none"
    style={{ background: testnet ? "var(--testnet-bg)" : "#E84142" }}
  >
    <path
      d="M1120 ... your SVG path data ..."
      fill={testnet ? "#ffffff" : "white"}
    />
  </svg>
);

// Add to chainToLogo mapping
export const chainToLogo = {
  // ... existing chains
  [avalanche.chainId]: <Avalanche />,
};
```

**Important:** The `chainToLogo` object is used throughout the UI components for displaying chain icons.

### Step 5: Enable in Wallet Payment Options (Optional)

**File:** `packages/connectkit/src/hooks/useSupportedChains.tsx`

This file controls which chains appear in the wallet payment options UI.

**For unconditional support (always visible):**

```tsx
import {
  avalanche,
  avalancheUSDC,
  base,
  baseUSDC,
  polygon,
  polygonUSDC,
  // ... other imports
} from "@rozoai/intent-common";

const supportedChainsList = [
  base, 
  polygon,
  avalanche,  // <-- Add here for unconditional support
];

const supportedTokens = [
  baseUSDC, 
  polygonUSDC,
  avalancheUSDC,  // <-- Add corresponding token
];
```

**For conditional support (based on appId or preferences):**

```tsx
export function useSupportedChains(
  appId: string,
  preferredChains: number[] = []
) {
  const showBSCUSDT = useMemo(() => appId.includes("MP"), [appId]);
  const showWorldchainUSDC = useMemo(
    () =>
      appId?.toLowerCase().includes("world") ||
      preferredChains?.includes(worldchain.chainId),
    [appId, preferredChains]
  );
  
  // Add your conditional logic
  const showAvalancheUSDC = useMemo(
    () => preferredChains?.includes(avalanche.chainId),
    [preferredChains]
  );

  return {
    chains: [
      ...supportedChainsList,
      ...(showBSCUSDT ? [bsc] : []),
      ...(showWorldchainUSDC ? [worldchain] : []),
      ...(showAvalancheUSDC ? [avalanche] : []),
    ].filter(Boolean),
    tokens: [
      ...supportedTokens,
      ...(showBSCUSDT ? [bscUSDT] : []),
      ...(showWorldchainUSDC ? [worldchainUSDC] : []),
      ...(showAvalancheUSDC ? [avalancheUSDC] : []),
    ].filter(Boolean),
  };
}
```

**Note:** This affects the wallet connection flow. Users will see this chain as an option when connecting their wallet.

### Step 6: Enable in Deposit Address Options (Optional)

**File:** `packages/connectkit/src/hooks/useDepositAddressOptions.ts`

```tsx
import {
  avalanche,
  base,
  polygon,
  DepositAddressPaymentOptions,
} from "@rozoai/intent-common";
import { chainToLogo } from "../assets/chains";

// First, add to the enum in pay-common/src/daimoPay.ts
// export enum DepositAddressPaymentOptions {
//   AVALANCHE = "Avalanche",
//   // ... other options
// }

export function useDepositAddressOptions({
  trpc,
  usdRequired,
  mode,
  appId,
}: UseDepositAddressOptionsParams) {
  const depositAddressConfig = useMemo(() => {
    const baseOptions: DepositAddressOption[] = [
      {
        id: DepositAddressPaymentOptions.BASE,
        logoURI: chainToLogo[base.chainId],
        minimumUsd: 0.1,
      },
      {
        id: DepositAddressPaymentOptions.POLYGON,
        logoURI: chainToLogo[polygon.chainId],
        minimumUsd: 0.1,
      },
      {
        id: DepositAddressPaymentOptions.AVALANCHE,  // <-- Add here
        logoURI: chainToLogo[avalanche.chainId],
        minimumUsd: 0.1,
      },
    ];

    // Optional: Add conditional logic
    // if (appId?.includes("SOME_FLAG")) {
    //   baseOptions.push({ ... });
    // }

    return baseOptions;
  }, [appId]);

  // ... rest of hook logic
}
```

**Also add to enum:**

**File:** `packages/pay-common/src/daimoPay.ts`

```typescript
export enum DepositAddressPaymentOptions {
  AVALANCHE = "Avalanche",  // <-- Add here
  BASE = "Base",
  BSC = "BSC",
  // ... other options
}
```

### Step 7: Update Payment Bridge Configuration (If Supporting Pay-In)

**File:** `packages/pay-common/src/bridge.ts`

If users will be able to **pay FROM** this chain (not just receive TO it), update the payment bridge logic:

```typescript
export function createPaymentBridgeConfig({
  toChain = baseUSDC.chainId,
  toToken = baseUSDC.token,
  toAddress,
  toStellarAddress,
  toSolanaAddress,
  toUnits,
  payInTokenAddress,
  log,
}: PaymentBridgeConfig) {
  // ... existing logic

  if (toChain === base.chainId && toToken === baseUSDC.token) {
    // Determine preferred payment method based on wallet selection
    if (payInTokenAddress) {
      // ... existing token checks

      // Add your new chain's pay-in token
      else if (payInTokenAddress === avalancheUSDC.token) {
        log?.(`[Payment Bridge] Pay In USDC Avalanche`);
        preferred = {
          preferredChain: String(avalancheUSDC.chainId),
          preferredToken: "USDC",
          preferredTokenAddress: avalancheUSDC.token,
        };
      }
    }
  }

  return { preferred, destination };
}
```

**Important:** The SDK currently supports **Base and Stellar as destination chains** (pay-out). If you want to add a new destination chain, significant backend API changes are required.

### Step 8: Update CoinLogos in OrderHeader (Optional)

**File:** `packages/connectkit/src/components/Common/OrderHeader/index.tsx`

This controls which chain logos appear in the "Pay with any coin/chain" UI section:

```tsx
function CoinLogos({ $size = 24, $exclude = [], appId }: { ... }) {
  const logos = [
    <Base key="base" />,
    <Polygon key="polygon" />,
    <Avalanche key="avalanche" />,  // <-- Add here if always shown
  ];

  // Conditional logos
  if (appId?.includes("MP")) {
    logos.push(<BinanceSmartChain key="bsc" />);
  }

  logos.push(<Solana key="solana" />);
  logos.push(<Stellar key="stellar" />);

  // ... rest of component
}
```

### Step 9: Update CCTP Chain Lists (If Applicable)

**File:** `packages/pay-common/src/chain.ts`

If the chain supports Circle's CCTP bridge:

```typescript
// https://developers.circle.com/stablecoins/supported-domains
const cctpV1Chains = [
  arbitrum,
  avalanche,  // <-- Add if CCTP v1 supported
  base,
  // ... other chains
];

const cctpV2Chains = [
  arbitrum, 
  base, 
  ethereum, 
  linea, 
  worldchain,
  // Add here if CCTP v2 supported
];
```

---

## Configuration Points

### Conditional Chain Enablement

The SDK uses several patterns for conditional chain enablement:

#### Pattern 1: AppId-based (e.g., MugglePay)

```typescript
// Enable BSC for apps with "MP" in appId
const showBSCUSDT = useMemo(() => appId.includes("MP"), [appId]);
```

#### Pattern 2: Preference-based (e.g., Worldchain)

```typescript
// Enable Worldchain if in preferredChains or appId contains "world"
const showWorldchainUSDC = useMemo(
  () =>
    appId?.toLowerCase().includes("world") ||
    preferredChains?.includes(worldchain.chainId),
  [appId, preferredChains]
);
```

#### Pattern 3: Always Enabled

```typescript
// Base and Polygon are always enabled
const supportedChainsList = [base, polygon];
```

### Configuration Files

- **`packages/connectkit/src/constants/rozoConfig.ts`**: General SDK configuration
- **`packages/connectkit/src/constants/routes.ts`**: Payment flow routes
- **`packages/connectkit/src/defaultConfig.ts`**: Wagmi configuration generator

---

## Testing & Verification

### Checklist for New Chain Support

- [ ] **Foundation Layer**
  - [ ] Chain defined in `pay-common/src/chain.ts`
  - [ ] Tokens defined in `pay-common/src/token.ts`
  - [ ] Block explorer URL added
  - [ ] CCTP domain configured (if applicable)
  - [ ] Exported via `pay-common/src/index.ts`

- [ ] **SDK Layer**
  - [ ] Chain logo SVG added to `connectkit/src/assets/chains.tsx`
  - [ ] Added to `chainToLogo` mapping
  - [ ] Enabled in `useSupportedChains.tsx` (if wallet payment)
  - [ ] Enabled in `useDepositAddressOptions.ts` (if deposit address)
  - [ ] Updated `OrderHeader` CoinLogos (if needed)

- [ ] **Bridge Configuration**
  - [ ] Added to `createPaymentBridgeConfig` pay-in logic (if supported)
  - [ ] Token address handling in bridge routing

- [ ] **Testing**
  - [ ] Chain logo displays correctly in UI
  - [ ] Token logos display correctly
  - [ ] Wallet connection works for the chain
  - [ ] Balance fetching works
  - [ ] Payment flow completes successfully
  - [ ] Deposit address generation works (if enabled)
  - [ ] Block explorer links work

### Example Test Flow

```tsx
// In your Next.js app (examples/nextjs-app/)
import { RozoPayProvider, RozoPayButton } from '@rozoai/intent-pay';

<RozoPayButton
  appId="your-app-id"
  toChain={avalanche.chainId}  // Test with your new chain
  toToken={avalancheUSDC.token}
  toAddress="0x..."
  toUnits="1000000"  // 1 USDC
  preferredChains={[avalanche.chainId]}  // Enable conditional chain
  onPaymentStarted={(event) => console.log("Payment started:", event)}
  onPaymentCompleted={(event) => console.log("Payment completed:", event)}
/>
```

---

## Current Active Chains

### Wallet Payment Options (Level 2)

| Chain | Chain ID | Token | Support Type |
|-------|----------|-------|--------------|
| Base | 8453 | USDC | Unconditional |
| Polygon | 137 | USDC | Unconditional |
| BSC | 56 | USDT | Conditional (MP apps) |
| Worldchain | 480 | USDC | Conditional (World apps/prefs) |
| Rozo Solana | 900 | USDC | Separate hook (useSolanaPaymentOptions) |
| Rozo Stellar | 1500 | USDC/XLM | Separate hook (useStellarPaymentOptions) |

### Deposit Address Options (Level 3)

| Chain | Chain ID | Support Type |
|-------|----------|--------------|
| Base | 8453 | Unconditional |
| Polygon | 137 | Unconditional |
| BSC | 56 | Conditional (MP apps) |
| Worldchain | 480 | Conditional (World apps) |

### All Defined Chains (Level 1)

EVM chains with full definitions but not active in payment options:
- Arbitrum (42161)
- Celo (42220)
- Ethereum (1)
- Linea (59144)
- Mantle (5000)
- Optimism (10)

---

## Code Examples

### Example 1: Adding Avalanche with Unconditional Support

```typescript
// 1. packages/pay-common/src/chain.ts
export const avalanche: Chain = {
  type: "evm",
  chainId: 43114,
  name: "Avalanche",
  cctpDomain: 1,
};

export const supportedChains: Chain[] = [
  arbitrum,
  avalanche,
  base,
  // ...
];

// 2. packages/pay-common/src/token.ts
export const avalancheAVAX = nativeToken({
  chainId: avalanche.chainId,
  name: "Avalanche",
  symbol: "AVAX",
  logoURI: TokenLogo.AVAX,
});

export const avalancheUSDC: Token = token({
  chainId: avalanche.chainId,
  token: getAddress("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"),
  name: "USD Coin",
  symbol: "USDC",
  fiatISO: "USD",
  decimals: 6,
  logoURI: TokenLogo.USDC,
});

const avalancheTokens: Token[] = [avalancheAVAX, avalancheUSDC];

const knownTokensByChain = new Map<number, Token[]>([
  [avalanche.chainId, avalancheTokens],
  // ... other chains
]);

// 3. packages/connectkit/src/assets/chains.tsx
const Avalanche = () => (
  <svg viewBox="0 0 1503 1504">
    {/* Your SVG path */}
  </svg>
);

export const chainToLogo = {
  [avalanche.chainId]: <Avalanche />,
  // ... other chains
};

// 4. packages/connectkit/src/hooks/useSupportedChains.tsx
import { avalanche, avalancheUSDC } from "@rozoai/intent-common";

const supportedChainsList = [base, polygon, avalanche];
const supportedTokens = [baseUSDC, polygonUSDC, avalancheUSDC];
```

### Example 2: Adding Optimism with Conditional Support

```typescript
// 1-3: Same foundation steps as Example 1

// 4. packages/connectkit/src/hooks/useSupportedChains.tsx
import { 
  optimism, 
  optimismUSDC,
  // ... other imports
} from "@rozoai/intent-common";

export function useSupportedChains(
  appId: string,
  preferredChains: number[] = []
) {
  // Add conditional logic
  const showOptimismUSDC = useMemo(
    () => preferredChains?.includes(optimism.chainId),
    [preferredChains]
  );

  return {
    chains: [
      ...supportedChainsList,
      ...(showOptimismUSDC ? [optimism] : []),
    ].filter(Boolean),
    tokens: [
      ...supportedTokens,
      ...(showOptimismUSDC ? [optimismUSDC] : []),
    ].filter(Boolean),
  };
}

// Usage in RozoPayButton:
<RozoPayButton
  preferredChains={[optimism.chainId]}  // Enable Optimism
  // ... other props
/>
```

### Example 3: Non-EVM Chain (Similar to Solana/Stellar)

Non-EVM chains require separate wallet provider integration:

```typescript
// 1. Define chain with custom type
export const cosmos: Chain = {
  type: "cosmos",  // New type - requires provider support
  chainId: 20000,  // Custom chain ID
  name: "Cosmos Hub",
  cctpDomain: null,
};

// 2. Create custom provider (like SolanaProvider/StellarProvider)
// packages/connectkit/src/provider/CosmosProvider.tsx

// 3. Create custom hook for payment options
// packages/connectkit/src/hooks/useCosmosPaymentOptions.ts

// 4. Add to payment state management
// packages/connectkit/src/hooks/usePaymentState.ts
const cosmosPaymentOptions = useCosmosPaymentOptions({
  trpc,
  address: cosmosAddress,
  usdRequired: pay.order?.destFinalCallTokenAmount.usd,
  // ...
});
```

---

## Notes & Considerations

### Backend Requirements

Adding a new chain to the SDK **does not automatically enable backend support**. You must ensure:

1. **API Support**: The RozoAI payment API (`intentapiv2.rozo.ai`) must support the chain
2. **Bridge Support**: Cross-chain routing must be configured on the backend
3. **Balance Fetching**: The tRPC endpoint must return balances for the chain
4. **Deposit Addresses**: The API must generate deposit addresses for the chain

### Performance Considerations

- **Chain Logo File Size**: Keep SVG logos small (<10KB) for fast loading
- **Token List Size**: Large token lists can impact initial load time
- **Balance Fetching**: More chains = more RPC calls = slower balance loading

### User Experience

- **Conditional Chains**: Use conditional enablement to avoid overwhelming users with too many options
- **Minimum Amounts**: Set appropriate `minimumUsd` values for deposit address options based on gas costs
- **Logo Quality**: Ensure chain and token logos are high quality and recognizable

### Migration Notes

When updating from existing SDK versions:

1. Check if the chain already exists in Level 1 (defined but not active)
2. Review existing conditional logic patterns before adding new ones
3. Test backward compatibility with existing `preferredChains` configurations

---

## Support & References

- **SDK Repository**: [RozoAI Intent Pay GitHub](https://github.com/RozoAI/intent-pay)
- **Circle CCTP Domains**: https://developers.circle.com/stablecoins/supported-domains
- **Chain IDs**: https://chainlist.org/
- **Viem Chains**: https://viem.sh/docs/chains/introduction.html

For questions or issues, refer to the SDK documentation or create an issue in the GitHub repository.

---

**End of Document**

