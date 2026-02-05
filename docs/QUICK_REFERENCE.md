# Quick Reference - RozoAI Intent Pay SDK

> Fast lookup for common operations and code patterns.

## Payment State Transitions

```typescript
// ✅ CORRECT: Full state transition flow
await createPreviewOrder(params);
// State: idle → preview

await setPaymentUnpaid(paymentId, order);
// State: preview → payment_unpaid

await setPaymentStarted(paymentId, hydratedOrder);
// State: payment_unpaid → payment_started

await setPaymentCompleted();
// State: payment_started → payment_completed
```

```typescript
// ❌ WRONG: Skipping states
await createPreviewOrder(params);
await setPaymentStarted(paymentId, hydratedOrder); // ERROR!
// Cannot skip payment_unpaid state
```

```typescript
// ✅ CORRECT: Error recovery
// From error state, MUST provide order
if (store.getState().type === "error") {
  await setPaymentUnpaid(paymentId, order); // Both params required
} else {
  await setPaymentUnpaid(paymentId); // Order optional
}
```

---

## Cross-Chain Payment Flow

```typescript
// User selects token on different chain than destination
const isCrossChain =
  order.preferredChainId !== selectedToken.chainId;

if (isCrossChain) {
  // 1. Create cross-chain payment via API
  const payment = await createPayment({
    toChain: 8453, // Base (destination)
    toToken: "0x...", // USDC on Base
    toUnits: "1000000",
    preferredChain: 137, // Polygon (source)
    preferredTokenAddress: "0x...", // USDC on Polygon
    appId: "your-app",
  });

  // 2. Hydrate order with payment response
  const hydratedOrder = formatPaymentResponseToHydratedOrder(payment);

  // 3. Check if switching from active payment
  if (store.getState().type === "payment_started") {
    // Must reset old payment first
    await setPaymentUnpaid(currentPaymentId);
  }

  // 4. Start new payment
  await setPaymentStarted(payment.id, hydratedOrder);

  // 5. Execute wallet transaction to depositAddress
  // User sends to depositAddress on Polygon
  // Backend bridges to Base automatically
}
```

---

## Wallet Payment Execution

### EVM Chains
```typescript
import { payWithToken } from './payment/payWithToken';

const handleEvmPayment = async (option: WalletPaymentOption) => {
  // 1. Switch chain if needed
  if (walletChainId !== option.required.token.chainId) {
    await switchChainAsync({
      chainId: option.required.token.chainId
    });
  }

  // 2. Execute payment
  const result = await payWithToken(option, store);

  if (result.success) {
    // Payment successful, FSM auto-transitions to completed
    setRoute(ROUTES.CONFIRMATION);
  }
};
```

### Solana
```typescript
import { payWithSolanaToken } from './payment/payWithSolanaToken';

const handleSolanaPayment = async (option: SolanaTokenOption) => {
  // 1. Ensure wallet connected
  if (!wallet.connected || !wallet.publicKey) {
    await wallet.connect();
  }

  // 2. Execute payment
  const result = await payWithSolanaToken(
    option,
    wallet,
    connection,
    destinationAddress,
    hydratedOrder
  );

  if (result.success) {
    setRoute(ROUTES.CONFIRMATION);
  }
};
```

### Stellar
```typescript
import { payWithStellarToken } from './payment/payWithStellarToken';

const handleStellarPayment = async (option: StellarTokenOption) => {
  // 1. Get Stellar kit from context
  const { kit } = useStellar();

  // 2. Determine destination address
  const { destinationAddress } = useStellarDestination(payParams);

  // 3. Execute payment
  const result = await payWithStellarToken(
    option,
    kit,
    destinationAddress,
    hydratedOrder,
    payParams
  );

  if (result.success) {
    setRoute(ROUTES.CONFIRMATION);
  }
};
```

---

## Error Handling Patterns

### Standard Error Handling
```typescript
try {
  setPayState(PayState.RequestingPayment);
  const result = await payWithToken(option, store);

  if (result.success) {
    setPayState(PayState.RequestSuccessful);
  } else {
    setPayState(PayState.RequestFailed);
  }
} catch (e) {
  // Update UI state
  setPayState(PayState.RequestCancelled);

  // CRITICAL: Also reset FSM state
  if (rozoPaymentId && order) {
    try {
      await setPaymentUnpaid(rozoPaymentId, order);
    } catch (resetError) {
      console.error("Failed to reset FSM state:", resetError);
    }
  }

  console.error("Payment failed:", e);
}
```

### Wallet-Specific Error Handling
```typescript
try {
  const result = await payWithToken(option, store);
} catch (e: any) {
  // Rainbow wallet chain mismatch bug
  if (e?.name === "ConnectorChainMismatchError") {
    const switched = await trySwitchingChain(option, true);
    if (switched) {
      // Retry after successful switch
      return await payWithToken(option, store);
    }
  }

  // Phantom timeout on mobile
  if (e?.message === "Signature timeout") {
    alert("Please check your wallet to complete transaction");
    return;
  }

  // User rejected
  if (e?.code === 4001 || e?.message.includes("rejected")) {
    setPayState(PayState.RequestCancelled);
    return;
  }

  // Unknown error
  setPayState(PayState.RequestFailed);
  throw e;
}
```

---

## Token Options Management

### Fetching Available Tokens
```typescript
import { useTokenOptions } from './hooks/useTokenOptions';

const Component = () => {
  const {
    optionsList,      // All available tokens
    isLoading,        // Still fetching balances
    refreshOptions    // Manual refresh trigger
  } = useTokenOptions();

  // optionsList contains:
  // - EVM tokens (Base, Polygon, etc.)
  // - Solana tokens (SOL, USDC, etc.)
  // - Stellar assets (XLM, USDC, etc.)

  return (
    <>
      {isLoading && <Spinner />}
      {optionsList.map(option => (
        <TokenOption key={getRozoTokenKey(option)} option={option} />
      ))}
      <button onClick={refreshOptions}>Refresh</button>
    </>
  );
};
```

### Filtering by Chain
```typescript
const evmOptions = optionsList.filter(opt =>
  opt.type === 'wallet' &&
  opt.required.token.chainId !== 'solana' &&
  opt.required.token.chainId !== 'stellar'
);

const solanaOptions = optionsList.filter(opt =>
  opt.type === 'solana-wallet'
);

const stellarOptions = optionsList.filter(opt =>
  opt.type === 'stellar-wallet'
);
```

### Manual Refresh on Wallet Change
```typescript
useEffect(() => {
  if (isConnected) {
    // Refresh balances when wallet connects
    walletPaymentOptions.refreshOptions();
  }
}, [isConnected]);
```

---

## Payment Parameter Validation

### Before Creating Payment
```typescript
const validatePayParams = (params: PayParams) => {
  // 1. Check required fields
  if (!params.appId) throw new Error("appId required");
  if (!params.toAddress) throw new Error("toAddress required");
  if (!params.toChain) throw new Error("toChain required");
  if (!params.toToken) throw new Error("toToken required");
  if (!params.toUnits) throw new Error("toUnits required");

  // 2. Validate address format
  if (params.toChain === 'solana') {
    if (!isValidSolanaAddress(params.toAddress)) {
      throw new Error("Invalid Solana address");
    }
  } else if (params.toChain === 'stellar') {
    if (!isValidStellarAddress(params.toAddress)) {
      throw new Error("Invalid Stellar address");
    }
  } else {
    // EVM chain
    if (!isValidEvmAddress(params.toAddress)) {
      throw new Error("Invalid EVM address");
    }
  }

  // 3. Check minimum amount
  const MIN_USD = 1.0;
  const token = getKnownToken(params.toChain, params.toToken);
  const amountUSD = parseFloat(params.toUnits) / 10 ** token.decimals;

  if (amountUSD < MIN_USD) {
    throw new Error(`Minimum payment: $${MIN_USD}`);
  }
};
```

### Preventing Stale State
```typescript
const handlePayment = async () => {
  // ALWAYS validate state freshness before payment
  if (!payParams) {
    console.warn("No payParams - stale state detected");
    return;
  }

  if (!order?.externalId) {
    console.warn("No order initialized");
    return;
  }

  const { destinationAddress } = useStellarDestination(payParams);
  if (!destinationAddress) {
    throw new Error("No destination address");
  }

  // Safe to proceed
  await executePayment();
};
```

---

## Reset & Restart Payment

```typescript
import { usePaymentState } from './hooks/usePaymentState';

const Component = () => {
  const { resetPayment, currPayParams } = usePaymentState();

  const handleReset = () => {
    // Option 1: Full reset (clears all state)
    resetPayment();
    // State transitions: current → preview
    // Modal routes to: SELECT_METHOD

    // Option 2: Reset with new params
    resetPayment({
      ...currPayParams,
      toUnits: newAmount, // Change amount
      toAddress: newAddress, // Change destination
    });
    // Creates new preview order with updated params
  };

  return <button onClick={handleReset}>Start Over</button>;
};
```

---

## Checking Payment Status

```typescript
import { useRozoPayStatus } from './hooks/useDaimoPayStatus';

const Component = () => {
  const status = useRozoPayStatus();
  // Returns: "payment_unpaid" | "payment_started" | "payment_completed" | "payment_bounced"

  useEffect(() => {
    if (status === "payment_completed") {
      // Payment successful
      console.log("Payment completed!");
    } else if (status === "payment_bounced") {
      // Payment failed on backend
      console.error("Payment bounced");
    }
  }, [status]);
};
```

---

## API Integration

### Creating Cross-Chain Payment
```typescript
import { createPayment } from '@rozoai/intent-common';

const payment = await createPayment({
  // Destination (where merchant receives)
  toChain: 8453, // Base
  toAddress: "0x...",
  toToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  toUnits: "1000000", // 1 USDC (6 decimals)

  // Source (what user pays with)
  preferredChain: 137, // Polygon
  preferredTokenAddress: "0x...", // USDC on Polygon

  // App identification
  appId: "your-app-id",

  // Optional metadata
  metadata: {
    orderId: "order_123",
    userId: "user_456",
  },

  // Optional webhooks
  webhookUrl: "https://your-backend.com/webhook",
  webhookSecret: "your-secret",

  // API version
  apiVersion: "v2", // or "v1"
});

// Response structure:
// {
//   id: "payment_xyz",
//   status: "pending",
//   depositAddress: "0x...", // User sends here (Polygon)
//   payoutAddress: "0x...", // Merchant receives here (Base)
//   expiresAt: "2026-02-02T12:00:00Z",
// }
```

### Polling for Status
```typescript
import { getPayment } from '@rozoai/intent-common';

const pollPaymentStatus = async (paymentId: string) => {
  const maxAttempts = 30;
  const interval = 2000; // 2 seconds

  for (let i = 0; i < maxAttempts; i++) {
    const payment = await getPayment(paymentId);

    if (payment.status === "completed") {
      return payment; // Success!
    }

    if (payment.status === "failed") {
      throw new Error("Payment failed on backend");
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error("Payment timeout");
};
```

---

## Component Integration

### Basic Integration
```typescript
import { RozoPayProvider, RozoPayButton } from '@rozoai/intent-pay';
import { WagmiConfig } from 'wagmi';
import { config } from './wagmi-config';

function App() {
  return (
    <WagmiConfig config={config}>
      <RozoPayProvider>
        <RozoPayButton
          appId="your-app-id"
          toChain={8453} // Base
          toAddress="0x..." // Your address
          toToken="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC
          toUnits="1000000" // 1 USDC
          onPaymentCompleted={(event) => {
            console.log("Payment completed:", event.paymentId);
          }}
        />
      </RozoPayProvider>
    </WagmiConfig>
  );
}
```

### Advanced Configuration
```typescript
<RozoPayButton
  // Required
  appId="your-app-id"
  toChain={8453}
  toAddress="0x..."
  toToken="USDC"
  toUnits="1000000"

  // Optional: Preferred payment methods
  preferredTokens={[
    { chainId: 8453, token: "USDC" }, // USDC on Base
    { chainId: 137, token: "USDC" },  // USDC on Polygon
  ]}

  // Optional: Payment options
  paymentOptions={{
    includeWallets: {
      evm: true,
      solana: true,
      stellar: true,
    },
    connectedWalletOnly: false, // Show all tokens
  }}

  // Optional: UI customization
  theme="midnight"

  // Optional: Event handlers
  onPaymentStarted={(event) => {
    console.log("Payment started:", event);
  }}
  onPaymentCompleted={(event) => {
    console.log("Payment completed:", event);
    // Verify on your backend
    fetch('/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentId: event.paymentId }),
    });
  }}
  onPaymentError={(error) => {
    console.error("Payment error:", error);
  }}

  // Optional: Metadata
  metadata={{
    orderId: "order_123",
    customField: "custom_value",
  }}
/>
```

---

## Debugging Checklist

### Payment Stuck?
1. Check FSM state: `console.log(store.getState().type)`
2. Check component state: `console.log(payState)`
3. Enable logging: Look for `log?.()` calls
4. Verify wallet connected: `console.log(isConnected, address)`
5. Check network: Browser DevTools → Network tab

### Wallet Not Connecting?
1. Check wallet extension installed
2. Verify chain supported: `console.log(walletChainId)`
3. Check provider initialized: `console.log(provider)`
4. Test on different browser/wallet

### Tokens Not Loading?
1. Check RPC connectivity: Try balance query manually
2. Verify wallet connected (if `connectedWalletOnly=true`)
3. Check `preferredTokens` configuration
4. Look for errors in console

### Cross-Chain Payment Failed?
1. Check API response: `console.log(paymentResponse)`
2. Verify both chains supported
3. Check token symbols match exactly (case-sensitive)
4. Ensure minimum amount met ($1 USD)
5. Test with direct payment (same chain) first

---

## File Locations Quick Ref

| Feature | File Location |
|---------|--------------|
| FSM Logic | `packages/connectkit/src/payment/paymentFsm.ts` |
| Payment Store | `packages/connectkit/src/payment/paymentStore.ts` |
| Side Effects | `packages/connectkit/src/payment/paymentEffects.ts` |
| EVM Payment | `packages/connectkit/src/components/Pages/PayWithToken/index.tsx` |
| Solana Payment | `packages/connectkit/src/components/Pages/Solana/PayWithSolanaToken/index.tsx` |
| Stellar Payment | `packages/connectkit/src/components/Pages/Stellar/PayWithStellarToken/index.tsx` |
| Token Options | `packages/connectkit/src/hooks/useTokenOptions.tsx` |
| Payment State | `packages/connectkit/src/hooks/usePaymentState.ts` |
| API Client | `packages/pay-common/src/api/payment.ts` |
| Providers | `packages/connectkit/src/provider/` |
| Routes | `packages/connectkit/src/constants/routes.ts` |

---

**Quick Reference Version:** 1.0
**Last Updated:** 2026-02-02
