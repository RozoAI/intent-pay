# RozoPayButton Props Reference

This reference documents all props for `RozoPayButton` and `RozoPayButton.Custom`, including which are required and how to use them.

## Payment Input Modes

This doc covers inline params mode: `appId` + `toChain` + `toAddress` + `toToken` (with optional `toUnits`, etc.).

## Payment Props

| Prop                   | Type                             | Required | Description                                                                              |
| ---------------------- | -------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `appId`                | `string`                         | Yes      | Public app ID from Rozo.                                                                 |
| `toChain`              | `number`                         | Yes      | Destination chain ID.                                                                    |
| `toAddress`            | `string`                         | Yes      | Recipient address (`0x...` for EVM, base58 for Solana, `G...` for Stellar).              |
| `toToken`              | `string`                         | Yes      | Destination token (EVM token address; Solana/Stellar token string or `"native"`).        |
| `toUnits`              | `string`                         | No       | Exact destination amount (USD/EUR style display amount). If omitted, user enters amount. |
| `intent`               | `string`                         | No       | Verb label like `"Pay"`, `"Deposit"`, `"Purchase"`.                                      |
| `feeType`              | `FeeType`                        | No       | `exactIn` (default) or `exactOut`.                                                       |
| `paymentOptions`       | `ExternalPaymentOptionsString[]` | No       | Limit/enable external payment methods.                                                   |
| `preferredChains`      | `number[]`                       | No       | Prioritize source assets from these chains.                                              |
| `preferredTokens`      | `Token[]`                        | No       | Prioritize specific source tokens.                                                       |
| `preferredSymbol`      | `TokenSymbol[]`                  | No       | Prioritize symbols (`USDC`, `USDT`, `EURC`).                                             |
| `metadata`             | `Record<string, any>`            | No       | Arbitrary metadata for tracking.                                                         |
| `defaultOpen`          | `boolean`                        | No       | Open modal by default.                                                                   |
| `closeOnSuccess`       | `boolean`                        | No       | Auto-close modal after successful payment.                                               |
| `resetOnSuccess`       | `boolean`                        | No       | Reset payment state after success.                                                       |
| `connectedWalletOnly`  | `boolean`                        | No       | Restrict to already-connected Ethereum/Solana wallets only.                              |
| `confirmationMessage`  | `string`                         | No       | Custom message on confirmation page.                                                     |
| `showProcessingPayout` | `boolean`                        | No       | Show payout processing state after payment complete.                                     |

## Event + Behavior Props

| Prop                 | Type              | Required | Description                                     |
| -------------------- | ----------------- | -------- | ----------------------------------------------- |
| `onPaymentStarted`   | `(event) => void` | No       | Called when payment tx is seen on chain.        |
| `onPaymentCompleted` | `(event) => void` | No       | Called when destination transfer/call succeeds. |
| `onPayoutCompleted`  | `(event) => void` | No       | Called when payout completes.                   |
| `onOpen`             | `() => void`      | No       | Called when modal opens.                        |
| `onClose`            | `() => void`      | No       | Called when modal closes.                       |

## Visual Props (`RozoPayButton` only)

| Prop          | Type                          | Required | Description           |
| ------------- | ----------------------------- | -------- | --------------------- |
| `mode`        | `"light" \| "dark" \| "auto"` | No       | UI color mode.        |
| `theme`       | `Theme`                       | No       | Built-in named theme. |
| `customTheme` | `CustomTheme`                 | No       | Custom theme object.  |
| `disabled`    | `boolean`                     | No       | Disable interaction.  |

## Usage Examples

### 1) Standard button (inline params)

```tsx
<RozoPayButton
  appId={APP_ID}
  toChain={8453}
  toAddress="0xRecipient..."
  toToken="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  toUnits="10" // 10 USDC
  feeType={FeeType.ExactOut}
  preferredSymbol={["USDC", "USDT"]}
  metadata={{ orderId: "order_123" }}
  onPaymentCompleted={(e) => console.log("completed", e)}
/>
```

### 2) Custom trigger button

```tsx
<RozoPayButton.Custom
  appId={APP_ID}
  toChain={parsedConfig.chainId}
  toAddress={parsedConfig.recipientAddress}
  toToken={parsedConfig.tokenAddress}
  toUnits={parsedConfig.amount}
  feeType={FeeType.ExactOut}
  preferredSymbol={preferredSymbol}
  metadata={metadata}
  resetOnSuccess
  showProcessingPayout
>
  {({ show }) => <button onClick={show}>Make Payment</button>}
</RozoPayButton.Custom>
```

## Notes

- For EVM destinations, pass checksummed `0x...` addresses where possible.
- `toUnits` is an exact payment amount string (for example, `"10"` or `"10.50"`), not token-decimal base units.
