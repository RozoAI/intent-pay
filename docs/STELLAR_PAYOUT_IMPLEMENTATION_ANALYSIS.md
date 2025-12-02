# Stellar Pay Out Implementation Analysis (toStellarAddress)

## Overview

This document provides a comprehensive analysis of the Stellar payment integration, specifically focusing on the **Pay Out to USDC Stellar** functionality via the `toStellarAddress` parameter. This analysis serves as a reference for understanding the architecture and for implementing similar functionality for other chains (e.g., `toSolanaAddress`).

---

## Table of Contents

1. [Core Props & Parameters](#1-core-props--parameters)
2. [Destination Logic Hook](#2-destination-logic-hook)
3. [Routes Configuration](#3-routes-configuration)
4. [Context Provider](#4-context-provider)
5. [Payment Options](#5-payment-options)
6. [UI Components](#6-ui-components)
7. [Payment State Management](#7-payment-state-management)
8. [Constants & Configuration](#8-constants--configuration)
9. [Payment Effects & FSM](#9-payment-effects--fsm)
10. [External Payment Options](#10-external-payment-options)
11. [Modal Integration](#11-modal-integration)
12. [Key Dependencies](#12-key-dependencies)
13. [Complete Payment Flow](#13-complete-payment-flow)
14. [Implementation Checklist](#14-implementation-checklist)

---

## 1. Core Props & Parameters

### 1.1 RozoPayButton Props

**File:** `/packages/connectkit/src/components/DaimoPayButton/index.tsx`

The `toStellarAddress` prop is defined in the `PayButtonPaymentProps` interface:

```typescript
export type PayButtonPaymentProps =
  | {
      /**
       * Your public app ID. Specify either (payId) or (appId + parameters).
       */
      appId: string;
      /**
       * Destination chain ID.
       */
      toChain: number;
      /**
       * The destination token to send, completing payment. Must be an ERC-20
       * token or the zero address, indicating the native token / ETH.
       */
      toToken: Address;
      /**
       * The amount of destination token to send (transfer or approve).
       * If not provided, the user will be prompted to enter an amount.
       */
      toUnits?: string;
      /**
       * The destination address to transfer to, or contract to call.
       */
      toAddress: Address;
      /**
       * The destination stellar address to transfer to.
       */
      toStellarAddress?: string;
      /**
       * The destination solana address to transfer to.
       */
      toSolanaAddress?: string;
      // ... other props
    }
  | {
      /** The payment ID, generated via the Rozo Pay API. Replaces params above. */
      payId: string;
      /** Payment options. By default, all are enabled. */
      paymentOptions?: ExternalPaymentOptionsString[];
    };
```

**Key Points:**
- `toStellarAddress` is an optional string parameter
- Works alongside `toAddress` (EVM) and `toSolanaAddress` (Solana)
- Used to specify the final payout destination on Stellar network
- Part of the primary payment configuration, not the payId mode

### 1.2 PayParams Interface

**File:** `/packages/connectkit/src/payment/paymentFsm.ts`

The `toStellarAddress` is included in the PayParams interface used by the payment finite state machine:

```typescript
/** Payment parameters. The payment is created only after user taps pay. */
export interface PayParams {
  /** App ID, for authentication. */
  appId: string;
  /** Destination chain ID. */
  toChain: number;
  /** The destination token to send. */
  toToken: Address;
  /**
   * The amount of the token to send.
   * If not provided, the user will be prompted to enter an amount.
   */
  toUnits?: string;
  /** The final address to transfer to or contract to call. */
  toAddress: Address;
  /** The final stellar address to transfer to. */
  toStellarAddress?: string;
  /** The final solana address to transfer to. */
  toSolanaAddress?: string;
  /** Calldata for final call, or empty data for transfer. */
  toCallData?: Hex;
  // ... other fields
}
```

**Flow:**
1. User provides `toStellarAddress` in RozoPayButton props
2. Props are converted to `PayParams` in the button component
3. PayParams are passed to the payment FSM
4. FSM uses the address throughout the payment flow

---

## 2. Destination Logic Hook

### 2.1 useStellarDestination Hook

**File:** `/packages/connectkit/src/hooks/useStellarDestination.ts`

This hook is the **core logic** for determining the correct destination address and payment scenario for Stellar transactions.

```typescript
/**
 * Return type for the useStellarDestination hook
 */
interface StellarDestinationResult {
  /** The middleware address to use for the transaction */
  readonly destinationAddress: string | undefined;
  /** Whether this is a Stellar payment (Pay In Stellar scenarios) */
  readonly isStellarPayment: boolean;
  /** Pay In Stellar, Pay out Stellar scenario */
  readonly isPayInStellarOutStellar: boolean;
  /** Pay In Stellar, Pay Out Base scenario */
  readonly isPayInStellarOutBase: boolean;
  /** Whether toStellarAddress is provided and not empty */
  readonly hasToStellarAddress: boolean;
  /** Whether the payout destination is Base USDC */
  readonly isPayOutToBase: boolean;
  /** Pay In Base, Pay Out Stellar scenario */
  readonly isPayInBaseOutStellar: boolean;
}
```

**Hook Implementation:**

```typescript
export function useStellarDestination(
  payParams?: PayParams
): StellarDestinationResult {
  const hasToStellarAddress = useMemo((): boolean => {
    const address = payParams?.toStellarAddress;
    return Boolean(address && address.trim() !== "");
  }, [payParams?.toStellarAddress]);

  const isPayOutToBase = useMemo((): boolean => {
    return payParams?.toChain === baseUSDC.chainId;
  }, [payParams?.toChain]);

  const isPayInBaseOutStellar = useMemo((): boolean => {
    return payParams?.toChain === baseUSDC.chainId && hasToStellarAddress;
  }, [isPayOutToBase, hasToStellarAddress]);

  const isPayInStellarOutStellar = useMemo((): boolean => {
    return hasToStellarAddress;
  }, [hasToStellarAddress]);

  const isPayInStellarOutBase = useMemo((): boolean => {
    return isPayOutToBase && !hasToStellarAddress;
  }, [isPayOutToBase, hasToStellarAddress]);

  const isStellarPayment = useMemo((): boolean => {
    return isPayInStellarOutStellar || isPayInStellarOutBase;
  }, [isPayInStellarOutStellar, isPayInStellarOutBase]);

  const destinationAddress = useMemo((): string | undefined => {
    return (
      payParams?.toStellarAddress ||
      payParams?.toSolanaAddress ||
      payParams?.toAddress
    );
  }, [payParams]);

  return {
    destinationAddress,
    isStellarPayment,
    isPayInStellarOutStellar,
    isPayInStellarOutBase,
    hasToStellarAddress,
    isPayOutToBase,
    isPayInBaseOutStellar,
  } as const;
}
```

**Payment Scenarios Supported:**

| Scenario | Pay In | Pay Out | Flag |
|----------|--------|---------|------|
| Stellar → Stellar | Stellar USDC | Stellar USDC | `isPayInStellarOutStellar` |
| Stellar → Base | Stellar USDC | Base USDC | `isPayInStellarOutBase` |
| Base → Stellar | Base USDC | Stellar USDC | `isPayInBaseOutStellar` |

**Destination Address Priority:**
1. `toStellarAddress` (highest priority)
2. `toSolanaAddress`
3. `toAddress` (EVM)

---

## 3. Routes Configuration

### 3.1 Stellar-Specific Routes

**File:** `/packages/connectkit/src/constants/routes.ts`

```typescript
export enum ROUTES {
  SELECT_METHOD = "rozoPaySelectMethod",
  SELECT_TOKEN = "rozoPaySelectToken",
  // ... other routes
  
  // Stellar routes
  STELLAR_CONNECT = "rozoPayStellarConnect",
  STELLAR_CONNECTOR = "rozoPayStellarConnector",
  STELLAR_SELECT_AMOUNT = "rozoPayStellarSelectAmount",
  STELLAR_PAY_WITH_TOKEN = "rozoPayStellarPayWithToken",
  
  // ... other routes
}
```

### 3.2 Payment Flow Routes

```
┌─────────────────┐
│  SELECT_METHOD  │ ← User selects "Pay with Stellar"
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ STELLAR_CONNECT │ ← List available Stellar wallets
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│STELLAR_CONNECTOR │ ← Wallet connection confirmation
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│STELLAR_SELECT_AMOUNT │ ← Amount selection (if needed)
└────────┬─────────────┘
         │
         ▼
┌───────────────────────┐
│STELLAR_PAY_WITH_TOKEN │ ← Transaction execution
└────────┬──────────────┘
         │
         ▼
┌─────────────────┐
│  CONFIRMATION   │ ← Payment complete
└─────────────────┘
```

**Alternative Flow (already connected):**
```
SELECT_METHOD → SELECT_TOKEN (shows Stellar tokens) → STELLAR_SELECT_AMOUNT → STELLAR_PAY_WITH_TOKEN → CONFIRMATION
```

---

## 4. Context Provider

### 4.1 StellarContextProvider

**File:** `/packages/connectkit/src/provider/StellarContextProvider.tsx`

The Stellar context provider manages all Stellar wallet connections and network interactions.

**Provider Interface:**

```typescript
type StellarContextProviderValue = {
  kit: StellarWalletsKit | undefined;
  stellarWalletPersistence: boolean;
  server: Horizon.Server;
  publicKey: string | undefined;
  setPublicKey: (publicKey: string) => void;
  account: Horizon.AccountResponse | undefined;
  refreshAccount: () => Promise<Horizon.AccountResponse | undefined>;
  isAccountExists: boolean;
  isConnected: boolean;
  connector: ISupportedWallet | undefined;
  setConnector: (connector: ISupportedWallet) => void;
  setWallet: (option: ISupportedWallet) => Promise<void>;
  disconnect: () => Promise<void>;
  convertXlmToUsdc: (amount: string) => Promise<string>;
};
```

**Key Features:**

1. **Singleton Kit Instance**
   - Uses `getStellarKitInstance()` to create a single instance
   - Prevents multiple kit initializations
   - Located in `/packages/connectkit/src/utils/stellar/singleton-import.ts`

2. **Horizon Server Connection**
   ```typescript
   const server = useMemo(() => {
     const s = new Horizon.Server(rpcUrl ?? DEFAULT_STELLAR_RPC_URL);
     return s;
   }, [rpcUrl]);
   ```

3. **Wallet Persistence**
   ```typescript
   const STELLAR_WALLET_STORAGE_KEY = "rozo-stellar-wallet";
   
   // Save to localStorage
   if (stellarWalletPersistence) {
     LocalStorage.add(STELLAR_WALLET_STORAGE_KEY, {
       walletId: option.id,
       walletName: option.name,
       walletIcon: option.icon,
       publicKey: pk,
     });
   }
   ```

4. **Auto-Reconnect**
   ```typescript
   // Auto-reconnect to previously connected wallet
   useEffect(() => {
     if (kit && typeof window !== "undefined" && stellarWalletPersistence) {
       const savedWallet = LocalStorage.get(STELLAR_WALLET_STORAGE_KEY);
       if (savedWallet && savedWallet.length > 0) {
         const lastWallet = savedWallet[0];
         if (lastWallet.walletId && lastWallet.publicKey) {
           try {
             setWallet({
               id: lastWallet.walletId,
               name: lastWallet.walletName,
               icon: lastWallet.walletIcon,
               ...lastWallet,
             });
           } catch (error: any) {
             console.error("[Rozo] Auto-reconnect failed:", error);
             disconnect();
           }
         }
       }
     }
   }, [kit, stellarWalletPersistence]);
   ```

5. **XLM to USDC Conversion**
   ```typescript
   const convertXlmToUsdc = async (amount: string) => {
     try {
       const destAsset = new Asset("USDC", rozoStellarUSDC.token);
       const pathResults = await server
         .strictSendPaths(Asset.native(), amount, [destAsset])
         .call();
       if (!pathResults?.records?.length) {
         throw new Error("No exchange rate found for XLM swap");
       }
       const bestPath = pathResults.records[0];
       const estimatedDestMinAmount = (
         parseFloat(bestPath.destination_amount) * 0.94
       ).toFixed(2);
       return estimatedDestMinAmount;
     } catch (error: any) {
       console.error("[Rozo] convertXlmToUsdc error", error);
       throw error;
     }
   };
   ```

### 4.2 Usage in DaimoPayProvider

**File:** `/packages/connectkit/src/provider/DaimoPayProvider.tsx`

The StellarContextProvider is wrapped around the entire app:

```typescript
export function RozoPayProvider(props: RozoPayProviderProps) {
  return (
    <StellarContextProvider
      rpcUrl={props.stellarRpcUrl}
      kit={props.stellarKit}
      stellarWalletPersistence={props.stellarWalletPersistence}
    >
      {/* Other providers */}
    </StellarContextProvider>
  );
}
```

**Provider Props:**
```typescript
interface RozoPayProviderProps {
  stellarRpcUrl?: string;
  stellarKit?: StellarWalletsKit;
  stellarWalletPersistence?: boolean;
  // ... other props
}
```

---

## 5. Payment Options

### 5.1 useStellarPaymentOptions Hook

**File:** `/packages/connectkit/src/hooks/useStellarPaymentOptions.ts`

This hook fetches available Stellar payment options (tokens and balances) for the connected wallet.

**Hook Signature:**

```typescript
export function useStellarPaymentOptions({
  trpc,
  address,
  usdRequired,
  isDepositFlow,
  payParams,
}: {
  trpc: TrpcClient;
  address: string | undefined;
  usdRequired: number | undefined;
  isDepositFlow: boolean;
  payParams: PayParams | undefined;
})
```

**API Call:**

```typescript
const fetchBalances = useCallback(async () => {
  if (address == null || usdRequired == null || stableAppId == null) return;

  setOptions(null);
  setIsLoading(true);

  try {
    const newOptions = await trpc.getStellarPaymentOptions.query({
      stellarAddress: address,
      // API expects undefined for deposit flow.
      usdRequired: isDepositFlow ? undefined : usdRequired,
      appId: stableAppId,
    });
    setOptions(newOptions);
  } catch (error) {
    console.error(error);
    setOptions([]);
  } finally {
    isApiCallInProgress.current = false;
    setIsLoading(false);
  }
}, [address, usdRequired, isDepositFlow, trpc, stableAppId]);
```

**Token Filtering:**

```typescript
const filteredOptions = useMemo(() => {
  if (!options) return [];

  return options
    .filter(
      (option) =>
        option.balance.token.token === `USDC:${rozoStellarUSDC.token}`
    )
    .map((item) => {
      const usd = isDepositFlow ? 0 : usdRequired || 0;

      const value: WalletPaymentOption = {
        ...item,
        required: {
          ...item.required,
          usd,
        },
      };

      // Set `disabledReason` manually
      if (item.balance.usd < usd) {
        value.disabledReason = `Balance too low: $${item.balance.usd.toFixed(2)}`;
      }

      return value;
    }) as WalletPaymentOption[];
}, [options, isDepositFlow, usdRequired]);
```

**Key Points:**
- Only shows Stellar USDC tokens (filters by `USDC:${rozoStellarUSDC.token}`)
- Checks balance sufficiency and sets `disabledReason`
- Handles both deposit flow and payment flow
- Uses refresh utilities to prevent duplicate API calls

### 5.2 Integration with useTokenOptions

**File:** `/packages/connectkit/src/hooks/useTokenOptions.tsx`

The Stellar payment options are integrated into the main token options hook:

```typescript
export function useTokenOptions(mode: "evm" | "solana" | "stellar" | "all"): {
  options: TokenOption[];
  isLoading: boolean;
  hasAnyData: boolean;
  // ...
} {
  const { stellarPaymentOptions } = paymentState;

  // Include Stellar options
  if (["stellar", "all"].includes(mode)) {
    const stellarOptions = stellarPaymentOptions.isLoading
      ? []
      : getStellarTokenOptions(
          stellarPaymentOptions.options ?? [],
          paymentState,
          setSelectedStellarTokenOption,
        );
    optionsList.push(...stellarOptions);
    isLoading ||= stellarPaymentOptions.isLoading;
    hasAnyData ||= (stellarPaymentOptions.options?.length ?? 0) > 0;
  }
}
```

**Token Option Generation:**

```typescript
function getStellarTokenOptions(
  options: WalletPaymentOption[],
  paymentState: PaymentState,
  setSelectedStellarTokenOption: (option: WalletPaymentOption) => void,
): TokenOption[] {
  return options.map((option) => {
    const titlePrice = formatUsd(option.balance.usd);
    const title = `${titlePrice} ${option.balance.token.symbol} on Stellar`;

    return {
      // ... option fields
      onClick: () => {
        setSelectedStellarTokenOption(option);
        logEvent({
          event: "click-stellar-token",
          // ...
        });
        if (isDepositFlow) {
          setRoute(ROUTES.STELLAR_SELECT_AMOUNT, meta);
        } else {
          setRoute(ROUTES.STELLAR_PAY_WITH_TOKEN, meta);
        }
      },
    };
  });
}
```

---

## 6. UI Components

### 6.1 ConnectStellar Component

**File:** `/packages/connectkit/src/components/Pages/Stellar/ConnectStellar/index.tsx`

**Purpose:** Lists available Stellar wallets for the user to connect.

**Key Features:**

1. **Fetch Available Wallets**
   ```typescript
   useEffect(() => {
     const fetchStellarWallets = async () => {
       if (!kit || typeof window === "undefined") return;
       setIsLoading(true);
       try {
         const wallets = await kit.getSupportedWallets();
         setStellarWallets(wallets);
       } catch (error) {
         console.error("Error fetching Stellar wallets:", error);
         setStellarWallets([]);
       } finally {
         setIsLoading(false);
       }
     };

     fetchStellarWallets();
   }, [kit]);
   ```

2. **Create Wallet Options**
   ```typescript
   const stellarOptions = useMemo(() => {
     return stellarWallets
       .filter((wallet) => wallet.isAvailable)
       .map((wallet) => ({
         id: wallet.id,
         title: wallet.name
           .toLowerCase()
           .split(" ")
           .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
           .join(" "),
         icons: [
           <SquircleIcon key={wallet.id} icon={wallet.icon} alt={wallet.name} />,
         ],
         onClick: async () => {
           await kit?.setWallet(wallet.id);
           kit?.getAddress().then(({ address }) => {
             // Stellar Provider
             setPublicKey(address);
             setConnector(wallet);

             // Save wallet connection to localStorage
             LocalStorage.add(STELLAR_WALLET_STORAGE_KEY, {
               walletId: wallet.id,
               walletName: wallet.name,
               walletIcon: wallet.icon,
               publicKey: address,
             });

             // PayContext
             setStellarConnector(wallet.id);
             setRoute(ROUTES.STELLAR_CONNECTOR, {
               event: "click-stellar-wallet",
               walletName: wallet.name,
             });
           });
         },
       }));
   }, [stellarWallets, kit]);
   ```

3. **Render Options**
   ```typescript
   return (
     <PageContent>
       {isLoading || !kit ? (
         <WalletPaymentSpinner
           logo={<Stellar />}
           logoShape="circle"
           loading={true}
           unavailable={false}
         />
       ) : (
         <>
           {stellarOptions.length === 0 && (
             <ModalContent>
               <ModalH1>No Stellar wallets detected.</ModalH1>
               <SelectAnotherMethodButton />
             </ModalContent>
           )}
           {stellarOptions.length > 0 && (
             <>
               <OrderHeader minified show="stellar" />
               <OptionsList options={stellarOptions} />
             </>
           )}
         </>
       )}
     </PageContent>
   );
   ```

### 6.2 SelectStellarAmount Component

**File:** `/packages/connectkit/src/components/Pages/Stellar/SelectStellarAmount/index.tsx`

**Purpose:** Allows user to select/confirm the payment amount for Stellar transactions.

**Implementation:**

```typescript
const SelectStellarAmount: React.FC = () => {
  const { paymentState } = usePayContext();
  const { selectedStellarTokenOption, setSelectedStellarTokenOption } =
    paymentState;

  if (selectedStellarTokenOption == null) {
    return <PageContent></PageContent>;
  }

  return (
    <MultiCurrencySelectAmount
      selectedTokenOption={selectedStellarTokenOption}
      setSelectedTokenOption={setSelectedStellarTokenOption}
      nextPage={ROUTES.STELLAR_PAY_WITH_TOKEN}
    />
  );
};
```

**Key Points:**
- Reuses the common `MultiCurrencySelectAmount` component
- Sets next page to `STELLAR_PAY_WITH_TOKEN`
- Handles both fixed amount and user-entered amount scenarios

### 6.3 PayWithStellarToken Component

**File:** `/packages/connectkit/src/components/Pages/Stellar/PayWithStellarToken/index.tsx`

**Purpose:** Executes the Stellar payment transaction.

**Payment States:**

```typescript
enum PayState {
  PreparingTransaction = "Preparing Transaction",
  RequestingPayment = "Waiting for Payment",
  WaitingForConfirmation = "Waiting for Confirmation",
  ProcessingPayment = "Processing Payment",
  RequestCancelled = "Payment Cancelled",
  RequestFailed = "Payment Failed",
  RequestSuccessful = "Payment Successful",
}
```

**Main Flow:**

1. **handleTransfer** - Prepares transaction and creates order
   ```typescript
   const handleTransfer = async (option: WalletPaymentOption) => {
     setIsLoading(true);
     try {
       if (!destinationAddress) {
         throw new Error("Stellar destination address is required");
       }

       if (!order) {
         throw new Error("Order not initialized");
       }

       const { required } = option;

       const needRozoPayment =
         "payinchainid" in order.metadata &&
         Number(order.metadata.payinchainid) !== required.token.chainId;

       let hydratedOrder: RozoPayHydratedOrderWithOrg;
       let paymentId: string | undefined;

       if (state === "payment_unpaid" && !needRozoPayment) {
         hydratedOrder = order;
       } else if (needRozoPayment) {
         const res = await createPayment(option, store as any);

         if (!res) {
           throw new Error("Failed to create Rozo payment");
         }

         paymentId = res.id;
         hydratedOrder = formatResponseToHydratedOrder(res);
       } else {
         // Hydrate existing order
         const res = await hydrateOrderRozo(undefined, option);
         hydratedOrder = res.order;
       }

       if (!hydratedOrder) {
         throw new Error("Payment not found");
       }

       const newId = paymentId ?? hydratedOrder.externalId;
       if (newId) {
         setRozoPaymentId(newId);
         setPaymentStarted(String(newId), hydratedOrder);
       }

       setPayState(PayState.RequestingPayment);

       const paymentData = {
         destAddress:
           (hydratedOrder.destFinalCall.to as string) || destinationAddress,
         usdcAmount: String(hydratedOrder.destFinalCallTokenAmount.usd),
         stellarAmount: roundTokenAmount(
           hydratedOrder.destFinalCallTokenAmount.amount,
           hydratedOrder.destFinalCallTokenAmount.token
         ),
       };

       if (hydratedOrder.metadata?.memo) {
         Object.assign(paymentData, {
           memo: hydratedOrder.metadata.memo as string,
         });
       }

       const result = await payWithStellarTokenImpl(option, paymentData);
       setSignedTx(result.signedTx);
       setPayState(PayState.WaitingForConfirmation);
     } catch (error) {
       // Error handling
     } finally {
       setIsLoading(false);
     }
   };
   ```

2. **handleSubmitTx** - Signs and submits transaction
   ```typescript
   const handleSubmitTx = async () => {
     if (signedTx && stellarServer && stellarKit) {
       try {
         // Sign and submit transaction
         const signedTransaction = await stellarKit.signTransaction(signedTx, {
           address: stellarPublicKey,
           networkPassphrase: Networks.PUBLIC,
         });

         setIsLoading(true);
         setPayState(PayState.ProcessingPayment);

         const tx = TransactionBuilder.fromXDR(
           signedTransaction.signedTxXdr,
           Networks.PUBLIC
         );

         const response = await stellarServer.submitTransaction(
           tx as Transaction | FeeBumpTransaction
         );

         if (response.successful) {
           setPayState(PayState.RequestSuccessful);
           setTxHash(response.hash);
           setTxURL(getChainExplorerTxUrl(stellar.chainId, response.hash));
           setTimeout(() => {
             setSignedTx(undefined);
             setPaymentRozoCompleted(true);
             setPaymentCompleted(response.hash, rozoPaymentId);
             setRoute(ROUTES.CONFIRMATION, { event: "wait-pay-with-stellar" });
           }, 200);
         } else {
           setPayState(PayState.RequestFailed);
         }
       } catch (error) {
         // Error handling
       } finally {
         setIsLoading(false);
       }
     }
   };
   ```

3. **Auto-execution**
   ```typescript
   useEffect(() => {
     if (!selectedStellarTokenOption) return;

     // Give user time to see the UI before opening
     const transferTimeout = setTimeout(
       () => handleTransfer(selectedStellarTokenOption),
       100
     );
     return () => clearTimeout(transferTimeout);
   }, [selectedStellarTokenOption]);

   useEffect(() => {
     if (signedTx) {
       submitButtonRef.current?.click();
     }
   }, [signedTx]);
   ```

**UI Rendering:**

```typescript
return (
  <PageContent>
    <button
      ref={submitButtonRef}
      style={{ display: "none" }}
      onClick={handleSubmitTx}
    />
    {selectedStellarTokenOption && (
      <TokenLogoSpinner
        token={selectedStellarTokenOption.required.token}
        loading={isLoading}
      />
    )}
    <ModalContent style={{ paddingBottom: 0 }}>
      {txURL ? (
        <ModalH1>
          <Link href={txURL} target="_blank" rel="noopener noreferrer">
            {payState}
          </Link>
        </ModalH1>
      ) : (
        <ModalH1>{payState}</ModalH1>
      )}
      <PaymentBreakdown paymentOption={selectedStellarTokenOption} />
      {payState === PayState.WaitingForConfirmation && signedTx && (
        <Button variant="primary" onClick={handleSubmitTx}>
          Confirm Payment
        </Button>
      )}
      {/* Error states with retry buttons */}
    </ModalContent>
  </PageContent>
);
```

---

## 7. Payment State Management

### 7.1 usePaymentState Hook - Stellar Integration

**File:** `/packages/connectkit/src/hooks/usePaymentState.ts`

**Stellar Wallet State:**

```typescript
// Stellar wallet state.
const {
  publicKey: stellarPublicKey,
  account: stellarAccount,
  kit: stellarKit,
  connector: stellarConnector,
  server: stellarServer,
} = useStellar();
const stellarPubKey = stellarPublicKey;
```

**Stellar Payment Options:**

```typescript
const stellarPaymentOptions = useStellarPaymentOptions({
  trpc,
  address: stellarPubKey,
  usdRequired,
  isDepositFlow,
  payParams,
});
```

**Show Stellar Payment Method:**

```typescript
const showStellarPaymentMethod = useMemo(() => {
  return (
    (paymentOptions === undefined ||
      paymentOptions.includes(ExternalPaymentOptions.Stellar)) &&
    order != null &&
    payParams != null
  );
}, [paymentOptions, order, payParams]);
```

**Selected Stellar Token Option:**

```typescript
const [selectedStellarTokenOption, setSelectedStellarTokenOption] =
  useState<WalletPaymentOption | undefined>(undefined);
```

**Pay With Stellar Token Implementation:**

```typescript
const payWithStellarToken = async (
  option: WalletPaymentOption,
  rozoPayment: {
    destAddress: string;
    usdcAmount: string;
    stellarAmount: string;
  }
) => {
  try {
    if (!stellarPublicKey) {
      throw new Error("Stellar Public key is null");
    }

    if (!stellarAccount) {
      throw new Error("Stellar Account is null");
    }

    if (!stellarServer || !stellarKit) {
      throw new Error("Stellar services not initialized");
    }

    log?.("[PAY STELLAR] Creating transaction...");

    // Setup Stellar payment
    await stellarKit.setWallet(String(stellarConnector?.id ?? "freighter"));
    const sourceAccount = await stellarServer.loadAccount(stellarPublicKey);
    const destAsset = new Asset("USDC", rozoStellarUSDC.token);
    const fee = String(await stellarServer.fetchBaseFee());

    // Build transaction
    const transactionBuilder = new TransactionBuilder(sourceAccount, {
      fee,
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(
        Operation.payment({
          destination: rozoPayment.destAddress,
          asset: destAsset,
          amount: String(rozoPayment.stellarAmount),
          source: stellarPublicKey,
        })
      )
      .setTimeout(300);

    log("[PAY STELLAR] Transaction built", transactionBuilder.toXDR());

    return {
      signedTx: transactionBuilder.toXDR(),
    };
  } catch (error) {
    log?.("[PAY STELLAR] Error", error);
    throw error;
  }
};
```

**State Management Return:**

```typescript
return {
  // ... other state
  selectedStellarTokenOption,
  setSelectedStellarTokenOption,
  showStellarPaymentMethod,
  stellarPaymentOptions,
  payWithStellarToken,
  stellarPubKey,
  // ... other methods
};
```

### 7.2 Deposit Address Support

**File:** `/packages/connectkit/src/hooks/usePaymentState.ts`

Stellar is also supported as a deposit address option:

```typescript
const selectPaymentMethod = async (
  option: DepositAddressPaymentOptions
) => {
  let token: TokenInfo | undefined;

  if (option === DepositAddressPaymentOptions.BASE_MAINNET) {
    token = baseUSDC;
  } else if (option === DepositAddressPaymentOptions.SOLANA) {
    token = rozoSolanaUSDC;
  } else if (option === DepositAddressPaymentOptions.STELLAR) {
    token = rozoStellarUSDC;
  } else {
    throw new Error("Unsupported deposit address option");
  }

  // ... rest of implementation
};
```

---

## 8. Constants & Configuration

### 8.1 Stellar Token Configuration

**File:** `/packages/connectkit/src/constants/rozoConfig.ts`

```typescript
import { rozoStellar, rozoStellarUSDC, TokenLogo } from "@rozoai/intent-common";

// --- Stellar ---
export const DEFAULT_STELLAR_RPC_URL = "https://horizon.stellar.org";

// --- ⭐️ Updated Static Token Information to match JSON structure ---
export const STELLAR_XLM_TOKEN_INFO = {
  chainId: rozoStellar.chainId,
  token: "native",
  name: "Stellar Lumens",
  symbol: "XLM",
  decimals: 7,
  logoSourceURI: TokenLogo.XLM,
  logoURI: TokenLogo.XLM,
  usd: 0.1, // Default/fallback price
  priceFromUsd: 10,
  displayDecimals: 4,
  fiatSymbol: "$",
  maxAcceptUsd: 100000,
  maxSendUsd: 100000,
};

export const STELLAR_USDC_TOKEN_INFO = {
  chainId: rozoStellar.chainId, // Placeholder for Stellar Mainnet
  token: rozoStellarUSDC.token,
  name: "USD Coin",
  symbol: "USDC",
  decimals: 7,
  logoSourceURI: TokenLogo.USDC,
  logoURI: TokenLogo.USDC,
  usd: 1,
  priceFromUsd: 1,
  displayDecimals: 2,
  fiatSymbol: "$",
  maxAcceptUsd: 100000,
  maxSendUsd: 0,
};
```

**Key Points:**
- Uses `rozoStellar` and `rozoStellarUSDC` from `@rozoai/intent-common`
- XLM has 7 decimals (native token)
- USDC has 7 decimals on Stellar network
- Default RPC URL points to public Horizon server

### 8.2 Chain Logo Mapping

**File:** `/packages/connectkit/src/assets/chains.tsx`

```typescript
import { rozoStellar } from "@rozoai/intent-common";

export const chainToLogo: Record<number, React.ReactNode> = {
  // ... EVM chains
  [rozoStellar.chainId]: <Stellar />,
  // ... other chains
};
```

---

## 9. Payment Effects & FSM

### 9.1 Payment Effects Integration

**File:** `/packages/connectkit/src/payment/paymentEffects.ts`

**Preview Order Generation:**

When creating a preview order from PayParams, `toStellarAddress` is stored:

```typescript
async function runSetPayParamsEffects(
  store: PaymentStore,
  trpc: TrpcClient,
  event: Extract<PaymentEvent, { type: "set_pay_params" }>
) {
  const payParams = event.payParams;

  // ... order preview creation

  store.dispatch({
    type: "preview_generated",
    order: orderPreview as unknown as RozoPayOrderWithOrg,
    payParamsData: {
      appId: payParams.appId ?? DEFAULT_ROZO_APP_ID,
      toStellarAddress: payParams.toStellarAddress,
      toSolanaAddress: payParams.toSolanaAddress,
      toAddress: payParams.toAddress,
      rozoAppId: payParams.appId,
    },
  });
}
```

**Order Hydration with Rozo API:**

When hydrating an order, `toStellarAddress` is passed to the payment bridge configuration:

```typescript
async function runHydratePayParamsEffects(
  store: PaymentStore,
  trpc: TrpcClient,
  prev: Extract<PaymentState, { type: "preview" }>,
  event: Extract<PaymentEvent, { type: "hydrate_order" }>,
  log: (msg: string) => void
) {
  const order = prev.order;
  const payParams = prev.payParamsData;
  const walletPaymentOption = event.walletPaymentOption;

  // ... prepare payment data

  const { preferred, destination } = createPaymentBridgeConfig({
    toChain: toChain,
    toToken: toToken,
    toAddress: toAddress,
    toSolanaAddress: payParams?.toSolanaAddress,
    toStellarAddress: payParams?.toStellarAddress,
    toUnits: toUnits,
    payInTokenAddress: walletPaymentOption?.required.token.token ?? "",
    log,
  });

  const paymentData: PaymentRequestData = {
    appId: payParams?.rozoAppId ?? payParams?.appId ?? DEFAULT_ROZO_APP_ID,
    display: {
      intent: order?.metadata?.intent ?? "",
      paymentValue: String(toUnits),
      currency: "USD",
    },
    ...preferred,
    destination,
    externalId: order?.externalId ?? "",
    metadata: {
      preferredChain: preferred.preferredChain,
      preferredToken: preferred.preferredToken,
      preferredTokenAddress: preferred.preferredTokenAddress,
      ...mergedMetadata({
        ...(payParams?.metadata ?? {}),
        ...(order?.metadata ?? {}),
        ...(order.userMetadata ?? {}),
      }),
    },
  };

  try {
    const rozoPayment = await createRozoPayment(paymentData);
    // ... handle response
  } catch (error) {
    // ... handle error
  }
}
```

**Key Points:**
- `toStellarAddress` flows through the entire payment pipeline
- Used by `createPaymentBridgeConfig` to determine destination
- Passed to Rozo API for payment creation
- Determines routing and bridging logic

---

## 10. External Payment Options

### 10.1 Stellar Exclusion

**File:** `/packages/connectkit/src/hooks/useExternalPaymentOptions.ts`

Stellar is excluded from default external payment options because it's handled as a wallet connection method:

```typescript
/**
 * EXCLUDED FROM DEFAULT LIST:
 * - Solana: Handled separately in SelectMethod component for Solana wallet integration
 * - ExternalChains: Handled separately for multi-chain wallet connections
 * - Rozo: Internal routing, not an external payment method
 * - Stellar: Handled separately in SelectMethod component for Stellar wallet integration
 */
const DEFAULT_EXTERNAL_PAYMENT_OPTIONS = Object.values(
  ExternalPaymentOptions
).filter(
  (opt) =>
    opt !== ExternalPaymentOptions.Solana &&
    opt !== ExternalPaymentOptions.ExternalChains &&
    opt !== ExternalPaymentOptions.Rozo &&
    opt !== ExternalPaymentOptions.Stellar
);
```

### 10.2 SelectMethod Integration

**File:** `/packages/connectkit/src/components/Pages/SelectMethod/index.tsx`

Stellar is shown in SelectMethod when:
1. Stellar wallet is already connected (shows connected option)
2. `showStellarPaymentMethod` is true (shows "Pay with Stellar" option)

```typescript
const SelectMethod: React.FC = () => {
  const { showStellarPaymentMethod } = paymentState;
  const { 
    connector: stellarConnector,
    isConnected: isStellarConnected,
    disconnect: disconnectStellar,
    publicKey: stellarPublicKey,
  } = useStellar();

  // Connected Stellar wallet option
  if (showConnectedStellar) {
    const stellarWalletDisplayName = getAddressContraction(
      stellarPublicKey ?? ""
    );

    const connectedStellarWalletOption = {
      id: "connectedStellarWallet",
      title: `Pay with ${stellarWalletDisplayName}`,
      icons: stellarConnector?.icon ? [/* wallet icon */] : [<Stellar />],
      onClick: () => {
        paymentState.setTokenMode("stellar");
        setRoute(ROUTES.SELECT_TOKEN, {
          event: "click-pay-with-stellar-wallet",
          walletId: stellarConnector?.id,
          chainId: "stellar",
          address: stellarPublicKey,
        });
      },
    };

    // Include if paymentOptions allows Stellar
    if (
      paymentOptions === undefined ||
      paymentOptions.includes(ExternalPaymentOptions.Stellar)
    ) {
      connectedOptions.push(connectedStellarWalletOption);
    }
  }

  // Stellar connection option
  if (showStellarPaymentMethod) {
    otherOptions.push({
      id: "stellar",
      title: "Pay with Stellar",
      icons: [<Stellar key="stellar" />],
      onClick: async () => {
        await disconnectEth();
        await disconnectSolana();
        await disconnectStellar();
        setRoute(ROUTES.STELLAR_CONNECT);
      },
    });
  }
};
```

---

## 11. Modal Integration

### 11.1 DaimoPayModal Route Handling

**File:** `/packages/connectkit/src/components/DaimoPayModal/index.tsx`

**Page Registration:**

```typescript
const pages: Record<ROUTES, React.ReactNode> = {
  [ROUTES.SELECT_METHOD]: <SelectMethod />,
  [ROUTES.SELECT_TOKEN]: <SelectToken />,
  // ... other pages
  
  [ROUTES.STELLAR_CONNECT]: <ConnectStellar />,
  [ROUTES.STELLAR_CONNECTOR]: <ConnectorStellar />,
  [ROUTES.STELLAR_SELECT_AMOUNT]: <SelectStellarAmount />,
  [ROUTES.STELLAR_PAY_WITH_TOKEN]: <PayWithStellarToken />,
  
  // ... other pages
};
```

**Back Button Navigation:**

```typescript
const onBack = () => {
  const meta = { event: "click-back" };
  
  // ... other route handling
  
  if (context.route === ROUTES.STELLAR_SELECT_AMOUNT) {
    setSelectedStellarTokenOption(undefined);
    context.setRoute(ROUTES.SELECT_TOKEN, meta);
  } else if (context.route === ROUTES.STELLAR_PAY_WITH_TOKEN) {
    if (isDepositFlow) {
      generatePreviewOrder();
      context.setRoute(ROUTES.STELLAR_SELECT_AMOUNT, meta);
    } else {
      setSelectedStellarTokenOption(undefined);
      context.setRoute(ROUTES.SELECT_TOKEN, meta);
    }
  }
  
  // ... other route handling
};
```

**Auto-navigation to Token Selection:**

```typescript
useEffect(() => {
  if (!context.open) return;
  if (context.route !== ROUTES.SELECT_METHOD) return;

  // If Stellar wallet is connected, navigate to token selection
  if (isStellarConnected && !disableMobileInjector) {
    if (context.options?.connectedWalletOnly) {
      paymentState.setTokenMode("stellar");
      context.setRoute(ROUTES.SELECT_TOKEN, {
        event: "auto-navigate-to-select-token",
        reason: "stellar-connected",
      });
    }
  }
}, [
  context.open,
  context.route,
  isStellarConnected,
  disableMobileInjector,
  context.options?.connectedWalletOnly,
]);
```

### 11.2 Modal Title & Description

**File:** `/packages/connectkit/src/components/Common/Modal/index.tsx`

Stellar-specific modal titles and descriptions:

```typescript
const getTitle = () => {
  switch (context.route) {
    case ROUTES.STELLAR_CONNECT:
      return "Connect Stellar Wallet";
    case ROUTES.STELLAR_CONNECTOR:
      return "Stellar Wallet Connected";
    case ROUTES.STELLAR_PAY_WITH_TOKEN:
      return "Confirm Payment";
    case ROUTES.STELLAR_SELECT_AMOUNT:
      return "Enter Amount";
    default:
      return defaultTitle;
  }
};

const showBackButton = () => {
  // Don't show back button on these routes
  const noBackRoutes = [
    ROUTES.SELECT_METHOD,
    ROUTES.CONFIRMATION,
    ROUTES.SELECT_TOKEN,
    ROUTES.ERROR,
  ];
  
  if (noBackRoutes.includes(context.route)) return false;
  if (paymentFsmState === "error") return false;
  
  return true;
};
```

---

## 12. Key Dependencies

### 12.1 NPM Packages

**File:** `/packages/connectkit/package.json`

```json
{
  "dependencies": {
    "@creit.tech/stellar-wallets-kit": "^1.9.5",
    "@stellar/stellar-sdk": "^14.2.0"
  },
  "peerDependencies": {
    "@creit.tech/stellar-wallets-kit": "^1.9.5",
    "@stellar/stellar-sdk": "^14.2.0"
  }
}
```

### 12.2 Key Imports

**Stellar Wallets Kit:**
- Manages wallet connections (Freighter, Albedo, Lobstr, etc.)
- Provides signing capabilities
- Handles wallet detection and availability

**Stellar SDK:**
- Transaction building (`TransactionBuilder`)
- Network operations (`Horizon.Server`)
- Asset management (`Asset`)
- Account operations (`Operation.payment`)
- Network configuration (`Networks.PUBLIC`)

### 12.3 Common Package Integration

**File:** `@rozoai/intent-common`

Stellar-related exports:
- `rozoStellar` - Chain configuration
- `rozoStellarUSDC` - USDC token configuration
- `stellar` - Chain info object
- `TokenLogo.USDC` / `TokenLogo.XLM` - Token logos
- `StellarPublicKey` - Type definition

---

## 13. Complete Payment Flow

### 13.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    RozoPayButton Initialization                  │
│  - User provides toStellarAddress prop                          │
│  - Props converted to PayParams                                 │
│  - PayParams stored in payment FSM                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Modal Opens                                │
│  - showStellarPaymentMethod checked                             │
│  - If Stellar connected, auto-navigate to SELECT_TOKEN          │
│  - Otherwise, show SELECT_METHOD                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    User Selects Method                           │
│  Option 1: "Pay with Stellar" (not connected)                   │
│    → Navigate to STELLAR_CONNECT                                │
│  Option 2: Connected Stellar wallet                             │
│    → Navigate to SELECT_TOKEN with mode="stellar"               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              STELLAR_CONNECT (if not connected)                  │
│  - Fetch available wallets via kit.getSupportedWallets()       │
│  - Show list of available Stellar wallets                       │
│  - User selects wallet                                          │
│  - Connect wallet via kit.setWallet(walletId)                   │
│  - Save connection to localStorage                              │
│  - Navigate to STELLAR_CONNECTOR                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   STELLAR_CONNECTOR                              │
│  - Show connected wallet confirmation                            │
│  - Fetch Stellar payment options via API                        │
│    trpc.getStellarPaymentOptions.query()                        │
│  - Navigate to SELECT_TOKEN or STELLAR_SELECT_AMOUNT            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SELECT_TOKEN (mode="stellar")                 │
│  - Show Stellar USDC tokens with balances                       │
│  - User selects token option                                    │
│  - Set selectedStellarTokenOption                               │
│  - Navigate based on flow:                                      │
│    • Deposit flow → STELLAR_SELECT_AMOUNT                       │
│    • Payment flow → STELLAR_PAY_WITH_TOKEN                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              STELLAR_SELECT_AMOUNT (if needed)                   │
│  - Show amount input with selected token                        │
│  - User enters/confirms amount                                  │
│  - Update selectedStellarTokenOption with amount                │
│  - Navigate to STELLAR_PAY_WITH_TOKEN                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STELLAR_PAY_WITH_TOKEN                          │
│  1. Prepare Transaction (handleTransfer)                        │
│     - Check destination address (toStellarAddress)              │
│     - Create/hydrate order:                                     │
│       • If cross-chain: createPayment() → Rozo API              │
│       • If same-chain: hydrateOrderRozo()                       │
│     - Set payment started state                                 │
│     - Build payment data with destination                       │
│     - Call payWithStellarToken()                                │
│                                                                  │
│  2. Build Stellar Transaction (payWithStellarToken)             │
│     - Load source account from Stellar network                  │
│     - Create USDC asset                                         │
│     - Build transaction:                                        │
│       TransactionBuilder                                        │
│         .addOperation(Operation.payment({                       │
│           destination: destAddress (toStellarAddress),          │
│           asset: USDC,                                          │
│           amount: stellarAmount                                 │
│         }))                                                     │
│     - Return unsigned transaction XDR                           │
│                                                                  │
│  3. Sign and Submit (handleSubmitTx)                            │
│     - Sign transaction via stellarKit.signTransaction()         │
│     - Submit to network via server.submitTransaction()          │
│     - Get transaction hash                                      │
│     - Update payment state                                      │
│     - Navigate to CONFIRMATION                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CONFIRMATION                                │
│  - Show payment successful                                       │
│  - Display transaction hash and explorer link                   │
│  - Show payment details                                         │
│  - Emit onPaymentCompleted event                                │
│  - If showProcessingPayout: watch for payout completion         │
│  - Emit onPayoutCompleted when done                             │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 Data Flow

```
toStellarAddress Prop
        │
        ▼
    PayParams
        │
        ▼
  Payment FSM State
        │
        ├──────────────────────────┐
        │                          │
        ▼                          ▼
Preview Order              useStellarDestination
payParamsData                     │
        │                          │
        ▼                          ▼
Order Hydration           destinationAddress
        │                          │
        ▼                          ▼
createPaymentBridgeConfig ─────> Rozo API
        │                          │
        ▼                          ▼
Payment Bridge           Payment Creation
  Configuration                   │
        │                          ▼
        │                  Hydrated Order
        │                          │
        └──────────┬───────────────┘
                   │
                   ▼
         PayWithStellarToken
                   │
                   ▼
        Stellar Transaction
     (destination = toStellarAddress)
                   │
                   ▼
           Stellar Network
                   │
                   ▼
         Transaction Hash
                   │
                   ▼
            Confirmation
```

### 13.3 State Transitions

```
Payment FSM States:

idle
  │
  ├─ set_pay_params → preview_generated
  │
  ▼
preview
  │
  ├─ hydrate_order (user selects token)
  │
  ▼
payment_unpaid (order hydrated, waiting for payment)
  │
  ├─ pay_stellar_source (transaction submitted)
  │
  ▼
payment_started (transaction confirmed on chain)
  │
  ├─ order_refreshed (backend processes destination)
  │
  ▼
payment_completed (destination processed successfully)
  │
  ├─ order_refreshed (if showProcessingPayout enabled)
  │
  ▼
payout_completed (payout to toStellarAddress confirmed)
```

---

## 14. Implementation Checklist

### 14.1 For Adding Stellar Support (Already Complete)

- ✅ Add `toStellarAddress` prop to RozoPayButton
- ✅ Add `toStellarAddress` to PayParams interface
- ✅ Create useStellarDestination hook
- ✅ Define Stellar routes (STELLAR_CONNECT, etc.)
- ✅ Create StellarContextProvider
- ✅ Implement useStellarPaymentOptions hook
- ✅ Create ConnectStellar component
- ✅ Create SelectStellarAmount component
- ✅ Create PayWithStellarToken component
- ✅ Integrate Stellar into usePaymentState
- ✅ Add Stellar token configuration
- ✅ Pass toStellarAddress through payment effects
- ✅ Exclude Stellar from external payment options
- ✅ Integrate Stellar into SelectMethod
- ✅ Add Stellar routes to DaimoPayModal
- ✅ Add Stellar dependencies to package.json

### 14.2 For Implementing toSolanaAddress (Pattern to Follow)

Based on the Stellar implementation, here's what should be done for Solana:

**Core Infrastructure:**
- ✅ Add `toSolanaAddress` prop to RozoPayButton (already exists)
- ✅ Add `toSolanaAddress` to PayParams interface (already exists)
- ✅ Create useSolanaDestination hook (already exists)
- ✅ Solana routes defined (SOLANA_CONNECTOR, etc.)
- ✅ SolanaContextProvider exists

**Hooks & Logic:**
- ⚠️ Verify useSolanaDestination returns correct destinationAddress priority
- ⚠️ Ensure toSolanaAddress flows through payment effects properly
- ⚠️ Check PayWithSolanaToken uses destinationAddress correctly

**UI Components:**
- ✅ Solana connector components exist
- ⚠️ Verify SelectSolanaAmount handles amounts correctly
- ⚠️ Ensure PayWithSolanaToken creates transactions with toSolanaAddress as destination

**Payment Flow:**
- ⚠️ Test cross-chain scenarios (Base → Solana payout)
- ⚠️ Test same-chain scenarios (Solana → Solana)
- ⚠️ Verify Rozo API receives toSolanaAddress correctly
- ⚠️ Test payout completion tracking

**Configuration:**
- ✅ Solana token configuration exists
- ✅ Chain logo mapping exists
- ⚠️ Verify RPC URL configuration

**Key Differences to Consider:**
1. Solana uses base58 addresses vs Stellar's G-format
2. Solana has different decimal precision (6 for USDC vs 7 for Stellar)
3. Solana transaction signing differs from Stellar
4. Solana uses different wallet adapters (@solana/wallet-adapter-react)

### 14.3 Testing Checklist

**Unit Tests:**
- [ ] useStellarDestination hook scenarios
- [ ] useStellarPaymentOptions API mocking
- [ ] Payment FSM state transitions with Stellar

**Integration Tests:**
- [ ] Connect Stellar wallet flow
- [ ] Fetch Stellar payment options
- [ ] Select token and amount
- [ ] Build and sign transaction
- [ ] Submit transaction to network
- [ ] Track payment completion

**E2E Tests:**
- [ ] Pay In Stellar, Pay Out Stellar
- [ ] Pay In Base, Pay Out Stellar
- [ ] Pay In Stellar, Pay Out Base
- [ ] Error handling (insufficient balance, rejected signature, etc.)
- [ ] Wallet persistence (reconnect on page reload)

---

## Conclusion

The Stellar Pay Out implementation (`toStellarAddress`) is a comprehensive, production-ready feature that:

1. **Accepts Stellar addresses** as payout destinations via RozoPayButton props
2. **Integrates with Stellar wallets** through the StellarContextProvider
3. **Manages token selection** with balance checking via useStellarPaymentOptions
4. **Executes payments** on the Stellar network with proper transaction building
5. **Tracks payment status** through the payment FSM with completion events
6. **Supports multiple scenarios** including cross-chain bridging and same-chain transfers

The architecture is designed to be **extensible and reusable** for other chains. The Solana implementation (`toSolanaAddress`) should follow the exact same patterns, replacing Stellar-specific components with Solana equivalents while maintaining the same state management, routing, and payment flow structure.

---

## Related Documentation

- [Adding New Chain Support](./ADDING_NEW_CHAIN_SUPPORT.md)
- [Payment FSM Documentation](../packages/connectkit/src/payment/README.md) (if exists)
- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit)

---

**Document Version:** 1.0  
**Last Updated:** November 26, 2025  
**Author:** RozoAI Intent Pay SDK Team

