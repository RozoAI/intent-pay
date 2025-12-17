# @rozoai/intent-common

Shared types and utilities for RozoAI Intent Pay SDK - enabling seamless cross-chain crypto payments.

## 📦 Installation

```bash
npm install @rozoai/intent-common
# or
yarn add @rozoai/intent-common
# or
pnpm add @rozoai/intent-common
```

## 🚀 Quick Start

### Basic Payment Flow

```typescript
import {
  createPayment,
  getPayment,
  PaymentStatus,
} from "@rozoai/intent-common";

// 1. Create a payment
const payment = await createPayment({
  appId: "your-app-id",
  toChain: 8453, // Base
  toToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
  toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // Recipient address
  preferredChain: 137, // Polygon (user pays from)
  preferredTokenAddress: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // Polygon USDC
  toUnits: "10", // 10 USDC
  title: "Product Purchase",
  description: "Payment for Premium Plan",
});

// 2. Extract bridge details
const bridgeAddress = payment.source.receiverAddress;
const bridgeMemo = payment.source.receiverMemo; // For Stellar/Solana
const amountToPay = payment.source.amount;

console.log(`Send ${amountToPay} to ${bridgeAddress}`);
if (bridgeMemo) {
  console.log(`Include memo: ${bridgeMemo}`);
}

// 3. User sends funds to bridge address (via wallet)
// ... your wallet integration code ...

// 4. Poll payment status
const checkStatus = async () => {
  const response = await getPayment(payment.id);
  const paymentData = response.data;

  switch (paymentData.status) {
    case PaymentStatus.PaymentUnpaid:
      console.log("Waiting for payment...");
      break;
    case PaymentStatus.PaymentStarted:
      console.log("Payment received, processing...");
      break;
    case PaymentStatus.PaymentCompleted:
      console.log("Payment completed!");
      break;
    case PaymentStatus.PaymentBounced:
      console.log("Payment failed:", paymentData.errorCode);
      break;
  }
};
```

> **⚠️ Critical:** After creating a payment, funds MUST be sent to `payment.source.receiverAddress`. If `payment.source.receiverMemo` exists (Stellar/Solana), it MUST be included or the payment will fail.

---

## 📖 API Reference

### `createPayment(params)`

Creates a new cross-chain payment intent.

#### Parameters

| Parameter               | Type     | Required | Description                                             |
| ----------------------- | -------- | -------- | ------------------------------------------------------- |
| `appId`                 | `string` | ✅       | Your application ID                                     |
| `toChain`               | `number` | ✅       | Destination chain ID (where recipient receives funds)   |
| `toToken`               | `string` | ✅       | Destination token address                               |
| `toAddress`             | `string` | ✅       | Recipient wallet address                                |
| `preferredChain`        | `number` | ✅       | Source chain ID (where user pays from)                  |
| `preferredTokenAddress` | `string` | ✅       | Source token address (what user pays with)              |
| `toUnits`               | `string` | ✅       | Amount in human-readable units (e.g., "10" for 10 USDC) |
| `title`                 | `string` | ❌       | Payment title for display                               |
| `description`           | `string` | ❌       | Payment description                                     |
| `metadata`              | `object` | ❌       | Custom metadata (max 4KB recommended)                   |
| `orderId`               | `string` | ❌       | Your order reference ID (for idempotency)               |
| `feeType`               | `enum`   | ❌       | `"exactIn"` or `"exactOut"` (default: `"exactIn"`)      |
| `webhookUrl`            | `string` | ❌       | URL to receive payment status updates                   |
| `webhookSecret`         | `string` | ❌       | Secret for HMAC-SHA256 webhook verification             |
| `receiverMemo`          | `string` | ❌       | Memo for Stellar/Solana destinations                    |

#### Response: `PaymentResponse`

```typescript
{
  id: string;                    // Payment ID
  appId: string;                 // Your app ID
  status: PaymentStatus;         // Current payment status
  type: FeeType;                 // Fee calculation type

  source: {
    receiverAddress: string;     // ⚠️ BRIDGE ADDRESS - Send funds here
    receiverMemo?: string;       // ⚠️ REQUIRED for Stellar/Solana
    amount: string;              // Amount user must send
    chainId: number;             // Source chain ID
    tokenAddress: string;        // Source token address
    tokenSymbol: string;         // Token symbol (e.g., "USDC")
    fee?: string;                // Fee amount
    amountReceived?: string;     // Actual amount received (after deposit)
    senderAddress?: string;      // User's wallet address (after deposit)
    txHash?: string;             // Deposit transaction hash
    confirmedAt?: Date;          // Deposit confirmation time
  };

  destination: {
    receiverAddress: string;     // Final recipient address
    amount: string;              // Amount recipient will receive
    chainId: number;             // Destination chain ID
    tokenAddress: string;        // Destination token address
    tokenSymbol: string;         // Token symbol
    txHash?: string;             // Payout transaction hash
    confirmedAt?: Date;          // Payout confirmation time
    receiverMemo?: string;       // Memo for Stellar/Solana
  };

  display: {
    title: string;               // Payment title
    description?: string;        // Payment description
    currency: string;            // Display currency (e.g., "USD")
  };

  orderId: string | null;        // Your order reference ID
  metadata: object | null;       // Custom metadata
  errorCode: string | null;      // Error code (if status is payment_bounced)
  webhookSecret: string | null;  // Webhook verification secret
  createdAt: Date;               // Creation timestamp
  updatedAt: Date;               // Last update timestamp
  expiresAt: Date;               // Expiration timestamp
}
```

### `getPayment(paymentId)`

Retrieves payment details and status.

#### Parameters

| Parameter   | Type     | Required | Description                       |
| ----------- | -------- | -------- | --------------------------------- |
| `paymentId` | `string` | ✅       | Payment ID from `createPayment()` |

#### Returns

Same `PaymentResponse` object as `createPayment()`.

---

## 🔄 Payment Status Flow

```
PaymentUnpaid → PaymentStarted → PaymentPayinCompleted → PaymentPayoutCompleted → PaymentCompleted
                                                        ↓
                                                  PaymentBounced (on error)
                                                        ↓
                                                  PaymentRefunded (if applicable)
```

### Status Definitions

| Status                     | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `payment_unpaid`           | Payment created, waiting for user deposit         |
| `payment_started`          | Deposit detected, processing                      |
| `payment_payin_completed`  | Deposit confirmed, preparing payout               |
| `payment_payout_completed` | Payout sent, waiting for confirmation             |
| `payment_completed`        | Payment fully completed                           |
| `payment_bounced`          | Payment failed (check `errorCode`)                |
| `payment_refunded`         | Payment refunded to user                          |
| `payment_expired`          | Payment expired (not paid within expiration time) |

### Error Codes (when status is `payment_bounced`)

| Error Code              | Description                       |
| ----------------------- | --------------------------------- |
| `amountTooHigh`         | Payment amount exceeds maximum    |
| `amountTooLow`          | Payment amount below minimum      |
| `chainUnavailable`      | Chain temporarily unavailable     |
| `insufficientLiquidity` | Insufficient bridge liquidity     |
| `invalidRecipient`      | Invalid recipient address         |
| `missingTrustline`      | Stellar trustline not established |
| `networkError`          | Network/RPC error                 |
| `providerError`         | External provider error           |
| `serviceMaintenance`    | Service under maintenance         |

---

## 💡 Usage Examples

### Example 1: Same-Chain Payment (Base → Stellar)

```typescript
const payment = await createPayment({
  appId: "my-app",
  toChain: 1500, // Base
  toToken: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", // Base USDC
  toAddress: "GDATMUNQEPN4TPETV47LAKGJELK4DUHHDRPMGD3K5LOHUPXX2DI623KY",
  preferredChain: 8453, // User pays from Base
  preferredTokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // Base USDC
  toUnits: "5", // 5 USDC
  title: "Coffee Purchase",
});

// User sends 5 USDC to payment.source.receiverAddress on Base
```

### Example 3: Stellar Payment (with Memo)

```typescript
const payment = await createPayment({
  appId: "my-app",
  toChain: 8453, // Base (destination)
  toToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // Base USDC
  toAddress: "0xRecipientAddress",
  preferredChain: 1500, // Stellar (source)
  preferredTokenAddress:
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  toUnits: "50", // 50 USDC
  title: "Invoice #12345",
});

// ⚠️ CRITICAL: Must include memo in Stellar transaction
const stellarMemo = payment.source.receiverMemo; // Required!
// User sends 50 USDC to payment.source.receiverAddress WITH memo
```

### Example 4: With Webhooks

```typescript
const payment = await createPayment({
  appId: "my-app",
  toChain: 8453,
  toToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  toAddress: "0xRecipientAddress",
  preferredChain: 137,
  preferredTokenAddress: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
  toUnits: "25",
  title: "Order #789",
  webhookUrl: "https://yourdomain.com/api/webhooks/payment",
  webhookSecret: "your-secret-key", // Use to verify webhook signatures
  metadata: {
    orderId: "789",
    customerId: "user_123",
  },
});

// Store payment.webhookSecret securely to verify incoming webhooks
```

### Example 5: Using Chain/Token Constants

```typescript
import {
  base,
  rozoStellar,
  baseUSDC,
  rozoStellarUSDC,
  createPayment,
} from "@rozoai/intent-common";

const payment = await createPayment({
  appId: "my-app",
  toChain: base.chainId, // 8453
  toToken: baseUSDC.token, // Base USDC address
  toAddress: "0xRecipientAddress",
  preferredChain: rozoStellar.chainId, // 137
  preferredTokenAddress: rozoStellarUSDC.token, // Polygon USDC address
  toUnits: "15",
  title: "Payment with Constants",
});
```

---

## 🔗 Supported Chains & Tokens

Based on [ROZO API Documentation](https://docs.rozo.ai/integration/api-doc/supported-tokens-and-chains).

### Pay In Chains (Source - Where Users Can Pay From)

| Chain        | Chain ID | Constant      | Type    | USDC Support | USDT Support |
| ------------ | -------- | ------------- | ------- | ------------ | ------------ |
| Ethereum     | `1`      | `ethereum`    | EVM     | ✅           | ✅           |
| Arbitrum     | `42161`  | `arbitrum`    | EVM     | ✅           | ✅           |
| Base         | `8453`   | `base`        | EVM     | ✅           | ❌           |
| BSC          | `56`     | `bsc`         | EVM     | ✅ (18 dec)  | ✅ (18 dec)  |
| Polygon      | `137`    | `polygon`     | EVM     | ✅           | ✅           |
| Rozo Solana  | `900`    | `rozoSolana`  | Solana  | ✅           | ✅           |
| Rozo Stellar | `1500`   | `rozoStellar` | Stellar | ✅ (7 dec)   | ❌           |

### Pay Out Chains (Destination - Where Recipients Can Receive)

| Chain        | Chain ID | Constant      | Type    | USDC Support |
| ------------ | -------- | ------------- | ------- | ------------ |
| Base         | `8453`   | `base`        | EVM     | ✅           |
| Rozo Stellar | `1500`   | `rozoStellar` | Stellar | ✅ (7 dec)   |

---

## 🛠️ Utility Functions

### Chain Utilities

```typescript
import { getChainById, getChainByName } from "@rozoai/intent-common";

// Get chain by ID
const baseChain = getChainById(8453);
console.log(baseChain.name); // "Base"

// Get chain by name
const polygonChain = getChainByName("polygon");
console.log(polygonChain.chainId); // 137
```

### Token Utilities

```typescript
import { getKnownToken, getTokensByChain } from "@rozoai/intent-common";

// Get specific token
const token = getKnownToken(8453, "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
console.log(token.symbol); // "USDC"
console.log(token.decimals); // 6

// Get all tokens for a chain
const baseTokens = getTokensByChain(8453);
console.log(baseTokens); // Array of token objects
```

### Payment Bridge Configuration

```typescript
import { createPaymentBridgeConfig } from "@rozoai/intent-common";

const config = createPaymentBridgeConfig({
  toChain: 8453,
  toToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  toAddress: "0xRecipient",
  toUnits: "100",
  preferredChain: 137,
  preferredTokenAddress: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
});

console.log(config.preferred); // Source payment details
console.log(config.destination); // Destination payment details
```

## 📚 TypeScript Support

Full TypeScript definitions included. All exports are typed.

```typescript
import type {
  PaymentResponse,
  PaymentStatus,
  FeeType,
  CreatePaymentRequest,
  DestinationRequest,
  SourceRequest,
  PaymentErrorCode,
} from "@rozoai/intent-common";
```

---

## ⚠️ Important Notes

### Bridge Address & Memo

- **Always** send funds to `payment.source.receiverAddress` after creating a payment
- **For Stellar (chainId: 1500)**: `payment.source.receiverMemo` is **REQUIRED** - transaction will fail without it
- **For Solana (chainId: 900)**: Include `payment.source.receiverMemo` if present
- **For EVM chains**: No memo required

### Amount Format

- Use human-readable units (e.g., `"10"` for 10 USDC, not `"10000000"`)
- The SDK handles decimal conversion automatically
- Example: For 1.5 USDC, use `toUnits: "1.5"`

### Fee Types

- **`exactIn`** (default): Fee deducted from input. Recipient receives `amount - fee`
- **`exactOut`**: Fee added to input. Recipient receives exact `amount`, user pays `amount + fee`

### Expiration

- Payments expire after a set period (check `expiresAt` field)
- Expired payments cannot be completed
- Always check payment status before displaying to users

---

## 🔗 Links

- [ROZO Documentation](https://docs.rozo.ai)
- [Supported Chains & Tokens](https://docs.rozo.ai/integration/api-doc/supported-tokens-and-chains)
- [API Documentation](https://docs.rozo.ai/integration/api-doc)

---

## 📄 License

BSD-2-Clause
