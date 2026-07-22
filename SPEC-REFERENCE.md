# SPEC — RozoPayCard (Original — §G/§C/§V Format)

> Reference copy. Current spec is in SPEC.md (PRD format).

## §G — Goal

Inline payment card component. Embed Rozo checkout flow directly in page layout. No modal, no redirect. Two-panel layout: wallet list on left, action on right.

## §C — Constraints

- **CheckoutMode only** (payId). BridgeMode and Deposit are later.
- **Wallet sources:** Recently Used (cookie) + Available (existing wagmi/solana/stellar connectors) + Others (Reown AppKit — lazy-loaded only when "Others" clicked)
- **Recently used wallets:** cookie `rk_recent_wallets`, JSON format `{name, method, icon}`, max 5 entries, 30-day expiry, graceful degradation on rejection
- **Dark/light mode:** inherited from `RozoPayProvider` context. No per-card overrides.
- **Supported chains:** EVM, Solana, Stellar, DepositAddress only. No external/QR payment methods.
- **Token selection:** show ALL tokens across all connected networks, sorted by USD balance descending. **Ignores `paymentOptions` wallet constraints** for display.
- **Multi-network wallets** (MetaMask, Phantom): show network choice buttons (Ethereum/Solana) on selection
- **Single-network wallets:** show "Launch Extension" only
- **Footer:** Powered by Rozo (left) + Intercom [? Help] (right)
- **No "Switch" button:** network inferred from token selection in STATE 2
- **Responsive:** two-column desktop, stacked mobile
- **Reuse existing code:** Pages, hooks, payment FSM, theme system — no duplication
- **Dependencies:** `@reown/appkit` + `@reown/appkit-adapter-wagmi` — lazy-loaded only when "Others" clicked. No wagmi conflict. Requires Reown `projectId`.
- **Provider requirement:** RozoPayCard MUST be inside RozoPayProvider. Throws if context missing.
- **No modal:** RozoPayProvider renders RozoPayModal by default. Use `suppressModal` prop when using RozoPayCard exclusively.
- **Direct FSM:** RozoPayCard initiates payment directly via FSM transitions, bypasses `showPayment()`.

## §I — Interfaces

### Component: `RozoPayCard`

```tsx
import { RozoPayCard } from '@rozoai/intent-pay';

// Mode/theme inherited from RozoPayProvider — no per-card overrides
// suppressModal prevents RozoPayModal from rendering
<RozoPayProvider payApiUrl="..." theme="auto" mode="auto" suppressModal>
  <RozoPayCard
    payId="pay_abc123"
    // Card-specific props:
    width?: number | string      // card width, default 480px
    className?: string           // wrapper class
    style?: React.CSSProperties  // wrapper inline styles
  />
</RozoPayProvider>
```

### Card Layout — Two-Panel (Pattern B)

```
┌─────────────────────────────────────────────────────┐
│  Pay 10.50 USDC to OpenRouter, Inc                  │
├────────────────────┬────────────────────────────────┤
│                    │                                │
│  Left Panel        │  Right Panel                   │
│  (context)         │  (action)                      │
│                    │                                │
│  Always visible    │  Updates per state             │
│  Editable via      │  No back buttons               │
│  [Change] links    │  Just [Change] on left         │
│                    │                                │
├────────────────────┴────────────────────────────────┤
│  Powered by Rozo                         [? Help]  │
└─────────────────────────────────────────────────────┘
```

### Footer

```tsx
<footer>
  <span>Powered by Rozo</span>
  <button onClick={() => window.Intercom?.('show')}>? Help</button>
</footer>
```

## §V — Invariants

1. V1: RozoPayCard shares payment FSM with RozoPayButton — same order, same state machine
2. V2: Card renders inline in DOM, never in portal/overlay
3. V3: On mobile (< 640px), card stacks vertically — left panel above, right panel below
4. V4: Theme vars inherited from RozoPayProvider context — dark/light mode via existing `--ck-*` CSS vars
5. V5: RozoPayCard never opens a modal — all interaction stays within card bounds
6. V6: Payment events fire identically to RozoPayButton
7. V7: Recently used wallets persist in cookie `rk_recent_wallets`, max 5 entries, 30-day expiry, JSON format, graceful degradation
8. V8: Reown AppKit lazy-loaded only when "Others" section is clicked — no wagmi config conflict
9. V9: Multi-network wallets show network choice buttons, single-network show "Launch Extension"
10. V10: Token list shows ALL tokens across all connected networks, sorted by balance. Ignores `paymentOptions` constraints for display.
11. V11: RozoPayCard MUST be rendered inside RozoPayProvider — throws if context is missing
12. V12: RozoPayProvider `suppressModal` prop prevents RozoPayModal rendering when using RozoPayCard exclusively
13. V13: RozoPayCard initiates payment directly via FSM transitions, bypasses `showPayment()`

## §R — Research

### Coinbase Payment Links (reference)
- Full-page centered card, two-column layout
- Left: wallet selector (MetaMask, Phantom, Coinbase, etc.)
- Right: QR code + "Launch extension" fallback
- Header: "Pay {amount} {token} to {recipient}"
- Both QR and extension options available when wallet detected

### Current RozoPay architecture
- `RozoPayButton` → `show()` → `RozoPayModal` → `Modal` (portal) → `Pages`
- `Modal` component: portal, backdrop overlay, animated page transitions
- Pages: SelectMethod, SelectToken, PayWithToken, Confirmation
- Pages use `usePayContext()` for routing
- `RozoPayProvider` always renders `RozoPayModal` (needs `suppressModal` prop)
- `showPayment()` is modal-specific — RozoPayCard bypasses this

### Reusable pieces
- **Pages:** PayWithToken, PayWithSolanaToken, PayWithStellarToken — render as-is
- **Hooks:** `useRozoPay`, `usePayContext`, `useTokenOptions`, `usePaymentState`
- **FSM:** `paymentFsm.ts` — state machine, no changes
- **Theme:** `ResetContainer`, CSS vars — apply to card wrapper
- **Common:** OrderHeader, PoweredByFooter, OptionsList, ConnectorList, Spinner, Intercom
- **Wallet detection:** `useWallets()` — complex mobile/desktop logic, reuse as-is

### What changes
- **Container:** Card wrapper replaces Modal+Portal+Backdrop
- **Layout:** Two-panel grid (left: wallet list, right: action area)
- **Wallet detection:** Keep existing connectors + Reown AppKit lazy-loaded for Others
- **Token selection:** Show all tokens across all networks, sorted by balance. Ignores paymentOptions constraints.
- **Network selection:** Multi-network wallets show choice buttons, not "Switch"
- **New dependency:** `@reown/appkit` + `@reown/appkit-adapter-wagmi` (lazy-loaded)
- **New prop:** `suppressModal` on RozoPayProvider
- **New invariant:** RozoPayCard must be inside RozoPayProvider

## §T — Tasks

| id | status | task | deps |
|----|--------|------|------|
| T1 | x | Create `RozoPayCard` component directory + types | — |
| T1b | x | Add `suppressModal` prop to RozoPayProvider | T1 |
| T1c | x | Add cookie utility module (`rk_recent_wallets`, 30-day, JSON, max 5) | T1 |
| T2 | x | Implement card container (two-panel grid, responsive) | T1 |
| T3 | x | Wire payment FSM + context (direct FSM transitions, bypass showPayment) | T2, T1b |
| T4 | x | Build STATE 1: Select Method (wallet list + QR + network buttons) | T3 |
| T5 | x | Build STATE 1b: Others section (lazy-load Reown AppKit on click) | T4 |
| T6 | x | Build STATE 2: Select Token (all tokens, sorted by balance, ignore paymentOptions) | T4, T1c |
| T7 | x | Build STATE 3: Confirmation (payment breakdown + approve) | T6 |
| T8 | x | Build STATE 4: Completed (status polling + tx hash) | T7 |
| T9 | x | Add Intercom [? Help] trigger in footer (`window.Intercom('show')`) | T2 |
| T10 | x | Responsive layout (mobile stacked, desktop side-by-side) | T2 |
| T11 | x | Export from package index, update types | T1 |
| T12 | x | Integration test with example app | T11 |
| T13 | x | Consumer docs (README section) | T12 |

## §B — Bugs

| id | date | cause | fix |
|----|------|-------|-----|
