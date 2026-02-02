# Troubleshooting Guide - RozoAI Intent Pay SDK

> Common issues, root causes, and solutions for developers working with the Intent Pay SDK.

## Table of Contents

1. [Payment State Issues](#payment-state-issues)
2. [Cross-Chain Payment Problems](#cross-chain-payment-problems)
3. [Wallet Connection Issues](#wallet-connection-issues)
4. [Token Balance & Loading](#token-balance--loading)
5. [API & Network Errors](#api--network-errors)
6. [Performance & Optimization](#performance--optimization)
7. [Development Environment Issues](#development-environment-issues)

---

## Payment State Issues

### Error: "Cannot set payment unpaid: Order must be provided when state is error"

**Symptom:**
```
Error: Cannot set payment unpaid: Order must be provided when state is error
```

**Root Cause:**
The payment FSM is in the `error` state, and you're trying to call `setPaymentUnpaid(paymentId)` without providing the `order` parameter.

**Location:** `packages/connectkit/src/payment/paymentFsm.ts`

**Why This Happens:**
When the FSM is in the `error` state, it requires both the `paymentId` AND the `order` object to transition back to `payment_unpaid`. This prevents data loss and ensures the order context is preserved.

**Solution:**
```typescript
// ❌ WRONG
await setPaymentUnpaid(paymentId);

// ✅ CORRECT
if (rozoPaymentId && order && 'org' in order) {
  await setPaymentUnpaid(rozoPaymentId, order);
} else {
  console.error("Cannot set payment unpaid - missing order");
}
```

**Prevention:**
Always check the current FSM state before calling `setPaymentUnpaid()`:
```typescript
const currentState = store.getState();
if (currentState.type === "error") {
  // Must provide order when recovering from error
  await setPaymentUnpaid(paymentId, currentState.order);
} else {
  // Can omit order in other states
  await setPaymentUnpaid(paymentId);
}
```

---

### Error: "Cannot skip from preview to payment_started"

**Symptom:**
Payment gets stuck at `preview` state, or you get an FSM transition error.

**Root Cause:**
The FSM enforces a strict transition path: `preview` → `payment_unpaid` → `payment_started`. You cannot skip states.

**Solution:**
Always call `setPaymentUnpaid()` before `setPaymentStarted()`:

```typescript
// ❌ WRONG
await createPreviewOrder(params);
await setPaymentStarted(paymentId, hydratedOrder); // ERROR!

// ✅ CORRECT
await createPreviewOrder(params);
await setPaymentUnpaid(paymentId, order);
await setPaymentStarted(paymentId, hydratedOrder);
```

**When This Matters:**
- Hydrating an order after cross-chain payment creation
- Resuming a payment from an external ID
- Retrying a failed payment

---

### Payment Stuck in "payment_started" After Error

**Symptom:**
User rejects wallet transaction, but payment state remains `payment_started`. Retrying fails.

**Root Cause:**
Component-level error handling updates UI state (`PayState.RequestCancelled`) but doesn't update FSM state.

**Code Location:** `packages/connectkit/src/components/Pages/PayWithToken/index.tsx:131-172`

**State Divergence:**
```typescript
// Component state
payState === PayState.RequestCancelled // ✅ Updated

// FSM state
store.getState().type === "payment_started" // ❌ NOT updated
```

**Solution:**
Explicitly reset FSM state in error handler:

```typescript
try {
  const result = await payWithToken(option, store);
  // ... handle success
} catch (e) {
  setPayState(PayState.RequestCancelled); // UI state

  // ALSO update FSM state
  if (rozoPaymentId && order) {
    try {
      await setPaymentUnpaid(rozoPaymentId, order);
    } catch (resetError) {
      console.error("Failed to reset payment state:", resetError);
    }
  }
}
```

**Verification:**
Check both states are synchronized:
```typescript
console.log("Component state:", payState);
console.log("FSM state:", store.getState().type);
// Should both be "unpaid" or both be "started"
```

---

### Stale Destination Address After Reset

**Symptom:**
After calling `resetPayment()`, the component uses the old destination address from the previous payment attempt.

**Root Cause:**
React batches state updates. The component's `useEffect` may trigger with stale `payParams` before the new state propagates.

**Code Location:** `packages/connectkit/src/components/Pages/Stellar/PayWithStellarToken/index.tsx`

**Debug Steps:**
1. Add logging before payment execution:
```typescript
const handleTransfer = async () => {
  console.log("[DEBUG] Current payParams:", payParams);
  console.log("[DEBUG] Current destinationAddress:", destinationAddress);
  console.log("[DEBUG] Current toChain:", payParams?.toChain);

  // Validate we have current payParams
  if (!payParams) {
    console.warn("[STALE STATE] No payParams available, skipping transfer");
    setIsLoading(false);
    return;
  }

  // Proceed with transfer
};
```

2. Check if destination address matches expected chain:
```typescript
if (payParams.toChain === 8453 && destinationAddress.startsWith("G")) {
  console.error("[STALE STATE] Base chain payment but Stellar address!");
  return;
}
```

**Solution:**
Add validation guards at the start of payment handlers:
```typescript
useEffect(() => {
  if (!payParams) {
    log?.("[Component] No payParams available, skipping transfer");
    setIsLoading(false);
    return; // Prevent execution with stale state
  }

  if (!order?.externalId) {
    log?.("[Component] No order initialized, skipping transfer");
    setIsLoading(false);
    return;
  }

  // Safe to proceed with fresh state
  handleTransfer();
}, [payParams, order]);
```

---

## Cross-Chain Payment Problems

### Cross-Chain Switch Creates Duplicate Payments

**Symptom:**
User selects "Pay with Solana USDC", then switches to "Pay with Base USDC". Two payments are created on the backend.

**Expected Behavior:**
Old payment should be reset to `payment_unpaid` before new payment starts.

**Code Location:** `packages/connectkit/src/hooks/usePaymentState.ts:673`

**Verification:**
Check if the old payment is being reset:
```typescript
// When user switches chains during payment_started
if (store.getState().type === "payment_started") {
  const oldPaymentId = rozoPaymentId;
  console.log("[SWITCH] Resetting old payment:", oldPaymentId);

  await setPaymentUnpaid(oldPaymentId);
  console.log("[SWITCH] Old payment reset, starting new payment");
}
```

**Solution:**
Ensure cross-chain switch logic explicitly resets old payment:
```typescript
const handleCrossChainSwitch = async (newOption) => {
  const currentPaymentId = rozoPaymentId;
  const currentState = store.getState().type;

  if (currentState === "payment_started" && currentPaymentId) {
    // Reset old payment before creating new one
    await setPaymentUnpaid(currentPaymentId);
  }

  // Now safe to create new payment
  const newPayment = await createPayment({ ... });
  await setPaymentStarted(newPayment.id, newPayment);
};
```

---

### Cross-Chain Payment Shows Wrong Chain in Wallet

**Symptom:**
User selects "Pay with USDC on Base → Merchant on Polygon", but wallet prompts for Polygon transaction instead of Base.

**Root Cause:**
Confusion between `preferredChain` (what user pays with) and `toChain` (where merchant receives).

**Verification:**
Log the payment parameters before wallet prompt:
```typescript
console.log("User will pay on chain:", preferredChain); // Should be Base
console.log("Merchant receives on chain:", toChain);    // Should be Polygon
console.log("Wallet should prompt for chain:", preferredChain);
```

**Solution:**
Ensure wallet chain switch targets the **source chain** (preferredChain), not destination:
```typescript
// Switch to the chain user is paying FROM
await switchChainAsync({ chainId: preferredChain });

// NOT the chain merchant is receiving ON
// await switchChainAsync({ chainId: toChain }); ❌ WRONG
```

---

### Backend Returns 404 for Cross-Chain Payment

**Symptom:**
`createPayment()` API call returns 404 or 500 error.

**Debug Steps:**

1. **Check API version:**
```typescript
console.log("API version:", getApiConfig().version);
console.log("API base URL:", getApiConfig().baseUrl);
```

2. **Verify request payload:**
```typescript
const paymentData = {
  appId,
  source: { chainId, tokenSymbol, amount },
  destination: { chainId, receiverAddress, tokenSymbol, amount },
  // ...
};
console.log("Payment request:", JSON.stringify(paymentData, null, 2));
```

3. **Check for unsupported chains:**
```typescript
// Verify both chains are supported
const sourceChain = getChainById(preferredChain);
const destChain = getChainById(toChain);

if (!sourceChain) {
  console.error("Unsupported source chain:", preferredChain);
}
if (!destChain) {
  console.error("Unsupported destination chain:", toChain);
}
```

**Common Causes:**
- Using v1 API with v2-only chains
- Invalid token symbols (typo in "USDC" vs "usdc")
- Missing `appId` parameter
- Unsupported chain combination

**Solution:**
```typescript
// Force v2 API for cross-chain
setApiConfig({ version: "v2" });

// Verify token symbols are correct
const supportedTokens = ["USDC", "USDT", "DAI", "ETH"];
if (!supportedTokens.includes(tokenSymbol)) {
  console.error("Unsupported token:", tokenSymbol);
}
```

---

## Wallet Connection Issues

### Rainbow Wallet: ConnectorChainMismatchError

**Symptom:**
```
Error: ConnectorChainMismatchError
```

**Root Cause:**
Rainbow wallet bug - user switches chain in wallet UI, but Wagmi still reports old chain ID.

**Code Location:** `packages/connectkit/src/components/Pages/PayWithToken/index.tsx:132-168`

**Automatic Recovery:**
The SDK has built-in retry logic for this specific error:

```typescript
try {
  await payWithToken(option, store);
} catch (e) {
  if (e?.name === "ConnectorChainMismatchError") {
    // Workaround: Force chain switch and retry
    log("Chain mismatch detected, attempting to switch and retry");
    const switchSuccessful = await trySwitchingChain(option, true);

    if (switchSuccessful) {
      const retryResult = await payWithToken(option, store);
      // Payment should succeed on retry
    }
  }
}
```

**Manual Fix:**
If automatic retry fails, instruct user to:
1. Manually switch to correct chain in Rainbow wallet
2. Refresh the page
3. Retry payment

---

### Phantom (Solana) - Transaction Timeout

**Symptom:**
Solana payment gets stuck at "Waiting for signature" indefinitely.

**Root Cause:**
Phantom wallet on mobile doesn't always return to browser after signing.

**Debug Steps:**
```typescript
try {
  const signature = await wallet.signAndSendTransaction(transaction);
  console.log("Transaction signature:", signature);

  // Wait for confirmation
  const confirmation = await connection.confirmTransaction(signature);
  console.log("Confirmation:", confirmation);
} catch (e) {
  console.error("Signature error:", e.message);
  // Check if user rejected vs timeout
}
```

**Solution:**
Add timeout with user-friendly message:
```typescript
const signWithTimeout = (transaction, timeout = 60000) => {
  return Promise.race([
    wallet.signAndSendTransaction(transaction),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Signature timeout")), timeout)
    )
  ]);
};

try {
  const signature = await signWithTimeout(transaction);
  // ...
} catch (e) {
  if (e.message === "Signature timeout") {
    alert("Please check your Phantom wallet to complete the transaction");
  }
}
```

---

### Stellar Wallet Not Connecting

**Symptom:**
Stellar wallet connection button does nothing or throws error.

**Debug Steps:**

1. **Check if Stellar is enabled:**
```typescript
const { stellarPaymentOptions } = usePaymentOptions();
console.log("Stellar options:", stellarPaymentOptions);
```

2. **Verify wallet kit is initialized:**
```typescript
const { kit } = useStellar();
console.log("Stellar kit:", kit);
console.log("Supported wallets:", kit?.getSupportedWallets());
```

3. **Check browser compatibility:**
```typescript
// Freighter wallet requires Chrome/Firefox
const isSupported = window.chrome || window.firefox;
console.log("Browser supports Stellar wallets:", isSupported);
```

**Common Issues:**
- Freighter extension not installed
- Using Safari (not supported by most Stellar wallets)
- Wallet kit not initialized in RozoPayProvider

**Solution:**
```typescript
// Ensure Stellar is included in payment options
<RozoPayButton
  paymentOptions={{
    includeWallets: {
      evm: true,
      solana: true,
      stellar: true, // ✅ Must be enabled
    }
  }}
/>
```

---

## Token Balance & Loading

### Token Options Show as "Loading" Indefinitely

**Symptom:**
Modal opens but token options never appear. Shows spinner forever.

**Root Cause:**
One of the three chain providers is stuck fetching balances.

**Debug Steps:**

1. **Check which provider is loading:**
```typescript
const { isLoading, optionsList } = useTokenOptions();

console.log("Total options fetched:", optionsList.length);
console.log("Is still loading:", isLoading);
```

2. **Check individual chain loading states:**
```typescript
// In useTokenOptions.tsx
console.log("EVM loading:", evmOptionsRaw.isLoading);
console.log("Solana loading:", solanaOptionsRaw.isLoading);
console.log("Stellar loading:", stellarOptionsRaw.isLoading);
```

3. **Verify RPC connectivity:**
```typescript
// Test EVM RPC
const provider = useProvider();
const blockNumber = await provider.getBlockNumber();
console.log("Latest block:", blockNumber); // Should return number

// Test Solana RPC
const connection = new Connection(SOLANA_RPC_URL);
const version = await connection.getVersion();
console.log("Solana version:", version); // Should return object

// Test Stellar RPC
const server = new Server(STELLAR_RPC_URL);
const account = await server.loadAccount(address);
console.log("Stellar account:", account); // Should return account data
```

**Common Causes:**
- RPC endpoint down or rate-limited
- Wallet not connected (if `connectedWalletOnly=true`)
- Network request blocked by CORS/firewall

**Solution:**

**For RPC issues:**
```typescript
// Configure custom RPC endpoints
<RozoPayProvider
  config={{
    ...wagmiConfig,
    publicClient: createPublicClient({
      transport: http("https://your-rpc-url.com"),
    }),
  }}
  solanaRpcUrl="https://your-solana-rpc.com"
  stellarRpcUrl="https://your-stellar-rpc.com"
/>
```

**For wallet issues:**
```typescript
// Allow token display without wallet connection
<RozoPayButton
  paymentOptions={{
    connectedWalletOnly: false, // Show all tokens
  }}
/>
```

---

### Token Balances Show as $0 Despite Having Funds

**Symptom:**
User has USDC in wallet, but SDK shows balance as $0 or token doesn't appear.

**Debug Steps:**

1. **Verify token is in preferred list:**
```typescript
const preferredTokens = [
  { chainId: 8453, token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" } // USDC on Base
];
console.log("Preferred tokens:", preferredTokens);
```

2. **Check if balance query succeeded:**
```typescript
// For EVM tokens
const { data: balance } = useBalance({
  address: userAddress,
  token: tokenAddress,
  chainId,
});
console.log("Token balance:", balance?.formatted);

// For Solana tokens
const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
  publicKey,
  { programId: TOKEN_PROGRAM_ID }
);
console.log("Solana token accounts:", tokenAccounts);
```

3. **Verify token decimals:**
```typescript
const token = getKnownToken(chainId, tokenAddress);
console.log("Token decimals:", token?.decimals); // Should be 6 for USDC
console.log("Raw balance:", rawBalance); // Should be in smallest units
console.log("Formatted balance:", rawBalance / 10 ** token.decimals);
```

**Common Causes:**
- Token address typo (wrong checksum)
- Wrong chain ID
- Token not in SDK's known tokens list
- Balance below display threshold

**Solution:**

**Add custom token:**
```typescript
// If token not recognized, add to preferred tokens
<RozoPayButton
  preferredTokens={[
    {
      chainId: 8453,
      token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Correct checksum
      symbol: "USDC",
      decimals: 6,
    }
  ]}
/>
```

---

## API & Network Errors

### Error: "Payment creation failed"

**Symptom:**
`createPayment()` returns error without specific message.

**Debug Steps:**

1. **Check API response:**
```typescript
const response = await apiClient.post("/payment-api", paymentData);
console.log("API response:", response);
console.log("Error details:", response.error);
console.log("Status code:", response.status);
```

2. **Verify request payload:**
```typescript
console.log("Request payload:", JSON.stringify(paymentData, null, 2));

// Check required fields
const required = ["appId", "source", "destination", "display"];
required.forEach(field => {
  if (!paymentData[field]) {
    console.error(`Missing required field: ${field}`);
  }
});
```

3. **Test API endpoint directly:**
```bash
curl -X POST https://intentapiv4.rozo.ai/functions/v1/payment-api \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "appId": "test",
    "source": { "chainId": 137, "tokenSymbol": "USDC", "amount": "1000000" },
    "destination": { "chainId": 8453, "receiverAddress": "0x...", "tokenSymbol": "USDC", "amount": "1000000" }
  }'
```

**Common Causes:**
- Invalid `appId` (not registered with Rozo)
- Unsupported chain/token combination
- Amount below minimum ($1 USD)
- Invalid destination address format

**Solution:**
```typescript
// Validate before API call
const MIN_AMOUNT_USD = 1.0;
const amountUSD = parseFloat(toUnits) / 10 ** token.decimals;

if (amountUSD < MIN_AMOUNT_USD) {
  throw new Error(`Minimum payment amount is $${MIN_AMOUNT_USD}`);
}

// Validate address format
if (toChain === "solana" && !isValidSolanaAddress(toAddress)) {
  throw new Error("Invalid Solana address");
}
if (toChain === "stellar" && !isValidStellarAddress(toAddress)) {
  throw new Error("Invalid Stellar address");
}
```

---

### CORS Error When Calling API

**Symptom:**
```
Access to fetch at 'https://intentapiv4.rozo.ai/...' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**Root Cause:**
Rozo API has CORS restrictions. Localhost is usually allowed, but some configurations aren't.

**Debug Steps:**

1. **Check request origin:**
```typescript
console.log("Request origin:", window.location.origin);
```

2. **Verify API endpoint:**
```typescript
console.log("API base URL:", getApiConfig().baseUrl);
```

3. **Test from allowed origin:**
```bash
# Try from production domain
curl -H "Origin: https://yourdomain.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization" \
  -X OPTIONS \
  https://intentapiv4.rozo.ai/functions/v1/payment-api
```

**Solutions:**

**For development:**
```bash
# Use local proxy
# In next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/payment/:path*',
        destination: 'https://intentapiv4.rozo.ai/functions/v1/:path*',
      },
    ];
  },
};
```

**For production:**
Register your domain with Rozo support to whitelist CORS.

---

## Performance & Optimization

### Modal Takes 5+ Seconds to Open

**Symptom:**
Clicking "Pay" button shows spinner for 5+ seconds before modal appears.

**Root Cause:**
Token balance fetching is blocking modal render.

**Debug Steps:**

1. **Profile balance fetching:**
```typescript
console.time("Token options load");
const { optionsList, isLoading } = useTokenOptions();
console.timeEnd("Token options load"); // Should be < 2 seconds
```

2. **Check RPC call count:**
```typescript
// Intercept fetch calls
const originalFetch = window.fetch;
let fetchCount = 0;

window.fetch = async (...args) => {
  fetchCount++;
  console.log(`Fetch #${fetchCount}:`, args[0]);
  return originalFetch(...args);
};
```

**Solutions:**

**Pre-fetch balances:**
```typescript
// Fetch balances on page load, not on modal open
useEffect(() => {
  if (isConnected) {
    walletPaymentOptions.refreshOptions();
  }
}, [isConnected]);
```

**Use progressive loading:**
```typescript
// Show modal immediately with "Loading..." state
const [showModal, setShowModal] = useState(false);
const [tokensReady, setTokensReady] = useState(false);

const handlePayClick = () => {
  setShowModal(true); // Open modal immediately
  walletPaymentOptions.refreshOptions().then(() => {
    setTokensReady(true); // Update when ready
  });
};
```

**Reduce token list:**
```typescript
// Only show specific tokens
<RozoPayButton
  preferredTokens={[
    { chainId: 8453, token: "USDC" }, // Only USDC on Base
  ]}
  paymentOptions={{
    includeWallets: { evm: true, solana: false, stellar: false }
  }}
/>
```

---

### Payment Polling Consumes Too Much Bandwidth

**Symptom:**
Network tab shows hundreds of API requests during payment.

**Root Cause:**
SDK polls every 2 seconds for payment status updates.

**Calculation:**
```
Payment duration: 60 seconds
Poll interval: 2 seconds
Total requests: 60 / 2 = 30 requests
```

**Solutions:**

**Increase polling interval:**
```typescript
// In paymentEffects.ts - modify poll interval
const POLL_INTERVAL = 5000; // 5 seconds instead of 2

const pollRefreshOrder = (paymentId) => {
  const interval = setInterval(async () => {
    await getPayment(paymentId);
  }, POLL_INTERVAL);
};
```

**Use exponential backoff:**
```typescript
let pollInterval = 2000; // Start at 2 seconds
const MAX_INTERVAL = 10000; // Cap at 10 seconds

const pollWithBackoff = (paymentId) => {
  const poll = async () => {
    const response = await getPayment(paymentId);

    if (response.status === "completed") {
      return; // Stop polling
    }

    // Increase interval for next poll
    pollInterval = Math.min(pollInterval * 1.5, MAX_INTERVAL);
    setTimeout(poll, pollInterval);
  };

  poll();
};
```

---

## Development Environment Issues

### Infinite Re-renders in Development

**Symptom:**
React warns about infinite re-render loop. Component keeps re-mounting.

**Root Cause:**
Inline object/array in dependency array causes new reference on every render.

**Code Location:** Fixed in v0.0.22, but check for new instances.

**Example Problem:**
```typescript
useEffect(() => {
  // ...
}, [{ toChain, toAddress }]); // ❌ New object every render!
```

**Solution:**
```typescript
// Use JSON.stringify for object dependencies
useEffect(() => {
  // ...
}, [JSON.stringify({ toChain, toAddress })]);

// Or use primitive dependencies
useEffect(() => {
  // ...
}, [toChain, toAddress]);
```

---

### Hot Reload Breaks Wallet Connection

**Symptom:**
After code change, wallet shows as disconnected. Must refresh page.

**Root Cause:**
Wagmi/Solana wallet state doesn't persist through hot module replacement (HMR).

**Solution:**
```typescript
// In _app.tsx or layout.tsx
if (typeof window !== "undefined") {
  // Preserve wallet state through HMR
  window.__WALLET_STATE__ = {
    connector: connector?.name,
    address: address,
  };
}
```

**Or:** Just refresh page after code changes that affect providers.

---

### Build Fails with "Cannot find module 'viem'"

**Symptom:**
```
Error: Cannot find module 'viem'
```

**Root Cause:**
Wagmi v2 requires viem v2 as peer dependency.

**Solution:**
```bash
# Ensure viem is installed
pnpm add viem@^2.0.0

# Clear cache and reinstall
pnpm clean
pnpm install
```

---

### Example App Not Using Local SDK Changes

**Symptom:**
Changes to `packages/connectkit/src` don't appear in example app.

**Root Cause:**
Example app not configured to use local packages.

**Verification:**
```bash
# Check if local linking is enabled
cd examples/nextjs-app
cat .env.local

# Should contain:
# NEXT_USE_LOCAL_PACKAGES=true
```

**Solution:**
```bash
# Terminal 1: Build SDK in watch mode
cd packages/connectkit
pnpm dev

# Terminal 2: Run example app
cd examples/nextjs-app
echo "NEXT_USE_LOCAL_PACKAGES=true" > .env.local
pnpm dev
```

Changes to SDK should now hot-reload in example app.

---

## Getting Help

If your issue isn't covered here:

1. **Check the logs:**
   - Enable logging: `RozoPayProvider` has `log` prop
   - Check browser console for errors
   - Inspect network tab for failed API calls

2. **Search existing issues:**
   - GitHub: https://github.com/RozoAI/intent-pay/issues

3. **Provide debugging info:**
   - SDK version: `pnpm list @rozoai/intent-pay`
   - Browser/wallet: Chrome + MetaMask v11.0.0
   - Reproduction steps
   - Full error message + stack trace
   - Network request/response (if API issue)

4. **Contact support:**
   - Email: support@rozo.ai
   - Discord: (if available)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-02
**Codebase Version:** v0.1.15+
