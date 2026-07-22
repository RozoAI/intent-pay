# RozoPayCard — PRD

## Problem Statement

RozoPayButton requires users to click a button, which opens a modal overlay, then navigate through multiple pages to complete payment. This adds friction — the modal blocks page content, requires dismissal, and feels disconnected from the host application. Merchants want an embedded payment experience that sits naturally within their page layout, like Coinbase Payment Links, without the modal overhead.

## Solution

Introduce `RozoPayCard` — an inline payment card component that embeds the Rozo checkout flow directly in the page. Two-panel layout: wallet selector on left, payment action on right. No modal, no portal, no redirect. Same props as RozoPayButton, different UX surface. Supports EVM, Solana, Stellar, and DepositAddress flows. Uses Reown AppKit for expanded wallet discovery in the "Others" section.

## User Stories

1. As a merchant, I want to embed a payment card directly in my checkout page, so that users don't need to open a modal to pay
2. As a merchant, I want the card to inherit my theme settings from RozoPayProvider, so that the card matches my app's design
3. As a merchant, I want to pass a `payId` to RozoPayCard, so that the card shows the correct payment details
4. As a merchant, I want to customize the card width, className, and style, so that I can fit it into my layout
5. As a user, I want to see my payment amount and recipient in the card header, so that I know what I'm paying for
6. As a user, I want to see my recently used wallets at the top of the list, so that I can quickly reconnect
7. As a user, I want to see all detected wallets (MetaMask, Phantom, Coinbase, etc.), so that I can choose my preferred wallet
8. As a user, I want to see WalletConnect and other mobile wallets in an "Others" section, so that I can pay from my phone
9. As a user, when I select MetaMask, I want to choose between Ethereum and Solana networks, so that I can pay on my preferred chain
10. As a user, when I select a single-network wallet (e.g., Coinbase), I want to see "Launch Extension" to connect via browser
11. As a user, I want to scan a QR code to connect my mobile wallet, so that I don't need to install a browser extension
12. As a user, after connecting my wallet, I want to see all available tokens across all networks, sorted by balance, so that I can choose the best token to pay with
13. As a user, I want to see my token balance and USD value for each token, so that I can make an informed decision
14. As a user, I want to see which network each token is on (Base, Polygon, Solana, etc.), so that I know where the funds will come from
15. As a user, after selecting a token, I want to see a payment breakdown (amount, fee, total, recipient), so that I can confirm before paying
16. As a user, I want to see an "Approve & Pay" button that handles ERC-20 approval and transfer in one flow, so that I don't need multiple clicks
17. As a user, if I'm on the wrong network, I want to see a prompt to switch, so that I can complete the payment
18. As a user, after paying, I want to see a success state with transaction hash and status, so that I know the payment is processing
19. As a user, I want to see the payment status update in real-time (payment_started → payment_completed → payout_completed), so that I know when the payment is final
20. As a user, I want to click "Pay Again" after completion, so that I can make another payment
21. As a user, I want to click "Change" on the left panel to modify my wallet or token selection, so that I don't need back buttons
22. As a user, I want the card to be responsive — two-column on desktop, stacked on mobile, so that it works on all devices
23. As a user, I want dark/light mode to match my system preference or the app's theme, so that the card feels native
24. As a user, I want a "Help" button in the footer that opens Intercom, so that I can get support if something goes wrong
25. As a user, I want the card to show a loading spinner while fetching payment details, so that I know the card is working
26. As a user, if the payment fails or bounces, I want to see an error state with retry options, so that I can try again
27. As a Solana user, I want to connect my Phantom wallet and see Solana tokens (USDC, SOL), so that I can pay on Solana
28. As a Stellar user, I want to connect my Freighter wallet and see Stellar tokens (USDC, XLM), so that I can pay on Stellar
29. As a user depositing to an address, I want to see a deposit address and QR code, so that I can send funds manually
30. As a developer, I want the card to use the same payment FSM as RozoPayButton, so that payment state is consistent across components
31. As a developer, I want recently used wallets stored in a cookie, so that they persist across sessions and are shared across SDK installations
32. As a developer, I want the card to fire the same payment events (onPaymentStarted, onPaymentCompleted, etc.) as RozoPayButton, so that my event handlers work identically

## Implementation Decisions

### Component Architecture

- **RozoPayCard** is a new component exported from `@rozoai/intent-pay`
- Props interface extends payment props (payId, appId, toChain, etc.) plus card-specific props (width, className, style)
- Theme/mode inherited from `RozoPayProvider` context — no per-card overrides
- Card shares the same payment FSM instance as RozoPayButton — no separate state machine
- **MUST be rendered inside RozoPayProvider** — throws if context is missing
- **Does NOT use showPayment()** — initiates payment directly via FSM transitions
- **RozoPayProvider renders RozoPayModal by default** — when RozoPayCard is used, pass `suppressModal` prop to provider to prevent modal rendering

### Layout — Two-Panel (Pattern B)

- **Left panel (context):** Always visible. Shows wallet list, connected wallet, network. Editable via [Change] links.
- **Right panel (action):** Updates per state. Shows QR/connect (STATE 1), token list (STATE 2), confirmation (STATE 3), completion (STATE 4).
- **No back buttons** — user clicks [Change] on left panel to modify selections.
- **Footer:** "Powered by Rozo" (left) + Intercom [? Help] (right).

### State Machine

Four states within the card:

1. **STATE 1 — Select Method:** Wallet list with QR + network choice buttons
2. **STATE 2 — Select Token:** All tokens across all networks, sorted by balance
3. **STATE 3 — Confirmation:** Payment breakdown + Approve & Pay
4. **STATE 4 — Completed:** Success state with tx hash + status polling

### Wallet Architecture

Three wallet sources:

1. **Recently Used:** Cookie storage `{name, method, icon}`, max 5 entries. Cookie name: `rk_recent_wallets`, 30-day expiry, JSON format. Graceful degradation on cookie rejection.
2. **Available:** Existing wagmi/solana/stellar connectors. Detected wallets shown with "Installed" badge.
3. **Others:** Reown AppKit — **lazy-loaded** only when "Others" section is clicked. No wagmi conflict. Initializes in separate React root with own config. Provides WalletConnect QR + 400+ mobile wallets.

### Multi-Network Wallets

- MetaMask and Phantom support both EVM and Solana
- When selected, show network choice buttons: "Ethereum" | "Solana"
- Single-network wallets show "Launch Extension" only
- Network choice determines which token list is shown in STATE 2

### Token Selection

- Show ALL tokens across ALL connected networks
- **Ignores `paymentOptions` wallet constraints** for display — always shows all tokens. `paymentOptions` only affects which payment methods are available, not token visibility.
- Sort by USD balance descending
- Each token shows: name, icon, balance, USD value, network badge
- No "Switch" button — network inferred from token selection

### Chain-Specific Flows

- **EVM:** switchChain → approve → payWithToken
- **Solana:** build transaction → signTransaction → sendTransaction
- **Stellar:** build transaction → signTransaction → submit
- **DepositAddress:** show deposit address + QR → poll for detection

### Dependencies

- `@reown/appkit` + `@reown/appkit-adapter-wagmi` — lazy-loaded only when "Others" section is clicked
- Requires Reown `projectId` from dashboard.reown.com
- **No wagmi conflict:** Reown is initialized in a separate React root when needed, not at provider level
- Recently used wallet cookie: name `rk_recent_wallets`, JSON format, 30-day expiry, max 5 entries

### Responsive Design

- Desktop (> 640px): Two-column grid (left: 200px, right: flex)
- Mobile (< 640px): Stacked vertically (wallet list above, action below)
- Uses existing `styled-components` + CSS custom properties (`--ck-*` vars)

## Testing Decisions

### Test Approach

- **Unit tests:** Component rendering, state transitions, cookie storage
- **Integration tests:** Payment flow with mock wallet connections
- **Visual tests:** Responsive layout, theme variants (dark/light)
- **Conflict tests:** Verify no wagmi config conflicts when Reown is lazy-loaded
- **Provider tests:** Verify RozoPayCard throws when used outside RozoPayProvider

### Key Test Seams

1. **RozoPayCard component:** Render with mock payId, verify state transitions
2. **Wallet list:** Mock wagmi connectors, verify Recently Used / Available / Others sections
3. **Token selection:** Mock wallet balances, verify sorting and network badges
4. **Payment execution:** Mock FSM states, verify EVM/Solana/Stellar flows
5. **Cookie storage:** Verify recently used wallet persistence

### Prior Art

- Existing tests in `packages/pay-common` (tape framework)
- RozoPayButton integration tests in example app
- Payment FSM state transition tests

## Out of Scope

- **BridgeMode** (toUnits, toAddress, toChain params) — later phase
- **Deposit flow** — later phase
- **Exchange/ZKP2P payment methods** (Coinbase, Binance, Venmo, etc.) — not in v1
- **External/QR payment methods** — not in v1
- **Custom theme per card** — theme inherited from provider only
- **Multi-step modal flows** — card is single-step after wallet selection
- **Desktop wallet QR** — QR is for mobile connection only
- **WalletConnect v2 direct integration** — using Reown AppKit instead
- **Modal rendering** — RozoPayProvider still renders RozoPayModal; use `suppressModal` prop to disable when using RozoPayCard exclusively

## Further Notes

### Reference: Coinbase Payment Links

The card layout is inspired by Coinbase Payment Links (https://payments.coinbase.com/payment-links). Key differences:
- Coinbase forces EVM + USDC; RozoPayCard supports EVM, Solana, Stellar, DepositAddress
- Coinbase shows "Launch Extension" only; RozoPayCard shows network choice for multi-network wallets
- Coinbase has no "Recently Used" section; RozoPayCard remembers last-used wallets via cookie
- Coinbase has no Intercom help; RozoPayCard includes support trigger

### Migration Path

RozoPayCard is additive — RozoPayButton and RozoPayModal remain unchanged. Merchants can adopt RozoPayCard incrementally without modifying existing integrations.

### Future Considerations

- Deposit flow integration (v2)
- Exchange/ZKP2P payment methods (v2)
- Custom theme per card (if merchant demand)
- Cross-domain recently used sync via BroadcastChannel
