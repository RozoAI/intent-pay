# Payment Flow Documentation

## Overview

This document describes the payment flow architecture in the ConnectKit payment system, including state management, payment methods, and cross-chain payment handling.

---

## Payment States

The system manages payment state through a centralized state machine:

```mermaid
stateDiagram-v2
    [*] --> preview: createPreviewOrder()
    preview --> payment_unpaid: setPaymentUnpaid()
    payment_unpaid --> payment_started: setPaymentStarted()
    payment_started --> payment_completed: setPaymentCompleted()
    payment_started --> error: Payment fails
    payment_started --> payment_unpaid: Cancel/Reset
    error --> payment_unpaid: Retry
    payment_completed --> [*]

    note right of preview
        Order created but not initiated
        User can modify parameters
    end note

    note right of payment_unpaid
        Payment ID assigned
        Ready to start payment
    end note

    note right of payment_started
        Payment in progress
        Transaction being processed
    end note
```

---

## Main Payment Flow

### 1. Initial Setup

```mermaid
flowchart TD
    Start([User Initiates Payment]) --> CheckParams{Valid PayParams?}
    CheckParams -->|No| Error[Show Error]
    CheckParams -->|Yes| CreatePreview[createPreviewOrder]
    CreatePreview --> RouteSelect[Route to SELECT_METHOD]
    RouteSelect --> SelectMethod[User Selects Payment Method]

    SelectMethod --> CheckChain{Payment Chain?}
    CheckChain -->|EVM Chain| TokenFlow[Token Payment Flow]
    CheckChain -->|Stellar| StellarFlow[Stellar Payment Flow]
    CheckChain -->|Solana| SolanaFlow[Solana Payment Flow]
```

### 2. Token Payment Flow (EVM Chains)

```mermaid
flowchart TD
    Start([PayWithToken Component]) --> SelectToken[User Selects Token Option]
    SelectToken --> CheckCrossChain{Cross-chain<br/>payment?}

    CheckCrossChain -->|No| DirectPayment[Direct Payment]
    CheckCrossChain -->|Yes| CreateRozoPayment[Create Rozo Payment]

    CreateRozoPayment --> HydrateOrder[Hydrate Order]
    DirectPayment --> HydrateOrder

    HydrateOrder --> StateTransition{Current State?}
    StateTransition -->|preview| SetUnpaid[setPaymentUnpaid]
    StateTransition -->|payment_unpaid| SetStarted[setPaymentStarted]
    StateTransition -->|payment_started| CheckSwitch{Chain switch?}

    CheckSwitch -->|Yes| ResetOld[setPaymentUnpaid old]
    CheckSwitch -->|No| SetStarted
    ResetOld --> SetStarted

    SetUnpaid --> SetStarted
    SetStarted --> WaitWallet[Wait for Wallet Confirmation]
    WaitWallet --> Complete[setPaymentCompleted]
    Complete --> ConfirmRoute[Route to CONFIRMATION]
```

### 3. Stellar Payment Flow

```mermaid
flowchart TD
    Start([PayWithStellarToken Component]) --> ValidateParams{Valid payParams?}
    ValidateParams -->|No| Skip[Skip transfer - stale state]
    ValidateParams -->|Yes| ValidateDest{Valid destination<br/>address?}

    ValidateDest -->|No| ErrorMsg[Throw Error: Address Required]
    ValidateDest -->|Yes| CheckOrder{Order<br/>initialized?}

    CheckOrder -->|No| ErrorMsg2[Throw Error: Order Not Init]
    CheckOrder -->|Yes| CheckCrossChain{Cross-chain<br/>payment?}

    CheckCrossChain -->|Yes| CreatePayment[createPayment]
    CheckCrossChain -->|No| CheckState{Current<br/>State?}

    CreatePayment --> FormatOrder[formatPaymentResponseToHydratedOrder]
    CheckState -->|payment_unpaid or<br/>payment_started| UseExisting[Use Existing Order]
    CheckState -->|Other| HydrateExisting[hydrateOrder]

    FormatOrder --> ValidateHydrated{Hydrated<br/>Order Valid?}
    UseExisting --> ValidateHydrated
    HydrateExisting --> ValidateHydrated

    ValidateHydrated -->|No| ErrorMsg3[Throw Error: Payment Not Found]
    ValidateHydrated -->|Yes| SetPaymentId[setRozoPaymentId]

    SetPaymentId --> StateCheck{Check Store State}
    StateCheck -->|payment_started<br/>+ new payment| TransitionUnpaid[setPaymentUnpaid old]
    StateCheck -->|preview| PreviewToUnpaid[setPaymentUnpaid → setPaymentStarted]
    StateCheck -->|payment_unpaid| DirectStart[setPaymentStarted]
    StateCheck -->|Already started| Continue[Continue]

    TransitionUnpaid --> StartNew[setPaymentStarted new]
    PreviewToUnpaid --> RequestPayment
    DirectStart --> RequestPayment
    StartNew --> RequestPayment
    Continue --> RequestPayment

    RequestPayment[Request Payment: payWithStellarToken] --> SignTx[Sign Transaction]
    SignTx --> WaitConfirm[Wait for User Confirmation]
    WaitConfirm --> Submit[Submit to Stellar Network]
    Submit --> CheckSuccess{Transaction<br/>Successful?}

    CheckSuccess -->|Yes| SetCompleted[setPaymentCompleted]
    CheckSuccess -->|No| HandleError[Handle Error]

    HandleError --> CheckOrderExists{Order & Payment ID<br/>exist?}
    CheckOrderExists -->|Yes| ResetToUnpaid[setPaymentUnpaid with order]
    CheckOrderExists -->|No| LogError[Log: Cannot set unpaid]

    ResetToUnpaid --> CheckRejected{User<br/>Rejected?}
    LogError --> CheckRejected
    CheckRejected -->|Yes| StateCancelled[State: RequestCancelled]
    CheckRejected -->|No| StateFailed[State: RequestFailed]

    SetCompleted --> RouteConfirm[Route to CONFIRMATION]
```

### 4. Solana Payment Flow

The Solana payment flow is identical to the Stellar flow, with these differences:
- Uses `PayWithSolanaToken` component
- Uses `payWithSolanaToken` instead of `payWithStellarToken`
- Validates Solana addresses instead of Stellar addresses
- Submits to Solana network instead of Stellar

---

## Reset Payment Flow

```mermaid
flowchart TD
    Start([resetPayment Called]) --> MergeParams[Merge New PayParams with Current]
    MergeParams --> ClearState[Clear Old State]

    ClearState --> ClearOptions[setSelectedStellarTokenOption undefined<br/>setSelectedSolanaTokenOption undefined<br/>setSelectedTokenOption undefined]
    ClearOptions --> ClearWallet[setSelectedWallet undefined<br/>setSelectedWalletDeepLink undefined]
    ClearWallet --> ResetPay[pay.reset]

    ResetPay --> CheckNewParams{New PayParams<br/>Provided?}
    CheckNewParams -->|No| RouteSelect[Route to SELECT_METHOD]
    CheckNewParams -->|Yes| ConvertSymbols[Convert preferredSymbol to preferredTokens]

    ConvertSymbols --> CheckChain{Destination<br/>Chain?}
    CheckChain -->|Stellar| SetStellarAddr[toStellarAddress = toAddress<br/>toAddress = 0x0<br/>toSolanaAddress = undefined]
    CheckChain -->|Solana| SetSolanaAddr[toSolanaAddress = toAddress<br/>toAddress = 0x0<br/>toStellarAddress = undefined]
    CheckChain -->|EVM| ClearSpecial[toStellarAddress = undefined<br/>toSolanaAddress = undefined]

    SetStellarAddr --> CreatePreview[createPreviewOrder]
    SetSolanaAddr --> CreatePreview
    ClearSpecial --> CreatePreview

    CreatePreview --> UpdateParams[setCurrPayParams]
    UpdateParams --> RouteSelect
```

---

## State Transition Rules

### From Preview State
- Can transition to: `payment_unpaid`
- Requires: Order data
- Action: `setPaymentUnpaid(paymentId, order)`

### From Payment Unpaid State
- Can transition to: `payment_started`
- Requires: Payment ID and order
- Action: `setPaymentStarted(paymentId, hydratedOrder)`

### From Payment Started State
- Can transition to:
  - `payment_completed` (success)
  - `payment_unpaid` (cancel/reset)
  - `error` (failure)
- Special case: Cross-chain switch requires transition to `payment_unpaid` first

### From Error State
- Cannot call `setPaymentUnpaid` without providing order
- Must provide both `paymentId` and `order` parameters

---

## Cross-Chain Payment Handling

```mermaid
flowchart TD
    Start([User Selects Token]) --> CheckPreferred{Order has<br/>preferredChainId?}
    CheckPreferred -->|No| DirectPayment[Direct Payment on Selected Chain]
    CheckPreferred -->|Yes| CheckMatch{preferredChainId ==<br/>selectedToken.chainId?}

    CheckMatch -->|Yes| DirectPayment
    CheckMatch -->|No| CrossChain[Cross-Chain Payment Required]

    CrossChain --> CreateRozo[createPayment via Rozo]
    CreateRozo --> GetNewId[Get New Payment ID]
    GetNewId --> CheckCurrentState{Current State?}

    CheckCurrentState -->|payment_started| HandleSwitch[Handle Chain Switch]
    CheckCurrentState -->|Other| NormalFlow[Normal Flow]

    HandleSwitch --> UnpaidOld[setPaymentUnpaid old payment]
    UnpaidOld --> StartNew[setPaymentStarted new payment]

    NormalFlow --> StartNew
    DirectPayment --> UseExisting[Use Existing Order]
```

---

## Key Components

### usePaymentState Hook
- **Location**: `packages/connectkit/src/hooks/usePaymentState.ts`
- **Responsibilities**:
  - Manages `currPayParams` state
  - Handles `resetOrder` logic
  - Clears selected options on reset
  - Routes to appropriate payment flow

### useStellarDestination Hook
- **Location**: `packages/connectkit/src/hooks/useStellarDestination.ts`
- **Responsibilities**:
  - Derives destination address from `payParams`
  - Determines payment direction (Stellar → Base, Base → Stellar, etc.)
  - Returns memoized values based on `payParams`

### Payment Components
1. **PayWithToken** - EVM chain payments
2. **PayWithStellarToken** - Stellar network payments
3. **PayWithSolanaToken** - Solana network payments

---

## Common Issues & Solutions

### Issue: Stale Destination Address After Reset

**Symptom**: After `resetPayment`, component uses old destination address from previous payment attempt.

**Root Cause**:
- `destinationAddress` from `useStellarDestination(payParams)` is memoized
- React batches state updates, so component may not re-render with new `payParams` before `useEffect` triggers

**Solution**:
1. Validate `payParams` exists before processing transfer
2. Add logging to track destination address and chain info
3. Check for stale state and skip processing if detected

```typescript
// Validate we have current payParams - if not, component has stale state
if (!payParams) {
  log?.("[Component] No payParams available, skipping transfer");
  setIsLoading(false);
  return;
}
```

### Issue: setPaymentUnpaid Error When State is "error"

**Symptom**: `Error: Cannot set payment unpaid: Order must be provided when state is error`

**Root Cause**:
- Error handler calls `setPaymentUnpaid(paymentId)` without order parameter
- When state is "error", order must be provided

**Solution**:
```typescript
if (rozoPaymentId && order && 'org' in order) {
  try {
    await setPaymentUnpaid(rozoPaymentId, order as any);
  } catch (e) {
    console.error("Failed to set payment unpaid:", e);
  }
} else {
  log?.(`Cannot set payment unpaid - missing requirements`);
}
```

---

## Payment State Validation

### Required Checks Before Payment
1. ✅ `payParams` exists and is current
2. ✅ `destinationAddress` is valid for target chain
3. ✅ `order` is initialized
4. ✅ Selected token option matches payment parameters
5. ✅ Wallet is connected (for blockchain payments)

### State Transition Validation
1. ✅ Cannot go from `error` to `payment_unpaid` without order
2. ✅ Cannot go from `preview` to `payment_started` without going through `payment_unpaid`
3. ✅ Cross-chain switch requires resetting old payment before starting new one

---

## Debugging Tips

### Enable Logging
Look for log statements in the components:
```typescript
log?.(`[PayWithStellarToken] Payment setup - destAddress: ${finalDestAddress}, toChain: ${payParams.toChain}, token chain: ${option.required.token.chainId}`);
```

### Check State Transitions
Monitor the payment state in Redux DevTools or logs:
```typescript
const currentState = store.getState().type;
console.log('Current payment state:', currentState);
```

### Validate payParams
Check if `payParams` are being updated correctly:
```typescript
console.log('payParams:', JSON.stringify(payParams, null, 2));
```

### Check Destination Address
Verify destination address derivation:
```typescript
const { destinationAddress } = useStellarDestination(payParams);
console.log('Destination:', destinationAddress);
console.log('ToChain:', payParams?.toChain);
console.log('ToStellarAddress:', payParams?.toStellarAddress);
```
