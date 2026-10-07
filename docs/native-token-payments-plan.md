# Plan: expose and safely pay with native source tokens

**Status:** local SDK/proxy implementation in worktree; upstream and funded rollout gates pending. **Scope:** `intent-pay` widget + sibling `../api-proxy-only` option service; ETH on supported EVM chains, BNB, POL, SOL, XLM as **payment sources**. Destination asset selection and merchant provisioning are separate. Research/evidence: [native-token-branch-research.md](./native-token-branch-research.md). No live wallet request or funded transaction is authorized by this plan.

## Outcome and current blockers

User with supported native balance, eligible merchant, and sufficient amount should see a native source option and complete a payment using the **checkout-quoted source amount**. Merchant without opt-in must not see opted-in native sources. Stablecoin flows must remain unchanged.

The supplied batch has `input[0].appId = "rozoBridgeStellar"` but **no** `input[1].appId`. Proxy reads each request independently, so its deposit catalog hides opt-in EVM/SOL natives; XLM remains (exempt). Widget currently omits `appId` in its deposit query. Wallet endpoint can discover nonzero EVM native balances, but proxy additionally needs merchant opt-in and a price; widget's supported-token registry and explicit stablecoin-only `preferredTokens` then suppress EVM natives. SOL wallet option uses a different sentinel from SDK. None of these observations proves this wallet has native balance, this merchant is opted in, or production backend accepts its quote. [Evidence: research](./native-token-branch-research.md#answer-for-supplied-batch).

```text
RozoPayButton (merchant appId, preferred source tokens)
   ├─ getWalletPaymentOptions(input[0]: EVM address, appId) ── RPC balances + prices
   ├─ getSolanaPaymentOptions / getStellarPaymentOptions ────── chain balances
   └─ getDepositAddressOptions(input[1]: appId) ─────────────── static catalog
                                      ↓
                     proxy merchant-native allowlist (XLM exempt)
                                      ↓
                 SDK supported-source + explicit preference filters
                                      ↓
                 selected option → create/checkout source quote
                                      ↓
                   EVM value / Solana transfer / Stellar native payment
```

## Phase 0 — prove upstream contract before widening UI

**Owner:** merchant/backend integration; no frontend edits. Confirm `rozoBridgeStellar` (or test merchant) has native-source entries in Intents `GET /payment-api/payments/supported?appId=...`; record symbol + chain pair, e.g. `ETH@8453`, `SOL@900`. Confirm create/checkout supports each proposed native *source* chain/address and returns usable `source.amount`/token units, receiving address, fee type, and destination payout. Backend input contract clarified by integration owner: native EVM source uses zero address (`0x0000000000000000000000000000000000000000`), native Solana source uses `"native"` on Intents chain 900. Proxy/UI sentinels (`0xEeee…`, Solana System Program) are not outbound source addresses. Destination payout tokens remain separately validated; do not assume native destination payouts are supported. Confirm production proxy and SDK versions before attributing a live response to this checkout. Upstream provisioning is external to these two repos; if unconfirmed, leave that route gated and label it blocked, not complete. Proxy allowlist: sibling `../api-proxy-only/src/lib/nativeAllowlist.ts`; see [research](./native-token-branch-research.md#request-shapes-and-practical-use).

**Exit:** written accepted source identifiers per chain, opted-in test app, known-good **non-funded** quote for each target route (when separately authorized), plus documented unavailable combinations. Do not use supplied personal addresses in shared fixtures or make paid transactions for discovery.

## Phase 1 — fix per-call merchant identity (small independent patch)

1. `packages/connectkit/src/hooks/useDepositAddressOptions.ts`: include `appId: payParams?.appId` in `getDepositAddressOptions.query`, and include `appId` in React Query `queryKey` to prevent cached options crossing merchants. If appId is unavailable, fail closed through proxy; do **not** synthesize native options in static fallback. Existing wallet hook already sends appId (`useWalletPaymentOptions.ts`). Keep proxy's `getAllowedNativeAssets(data?.appId)` and XLM exemption intact (`../api-proxy-only/src/server.ts`, `src/lib/nativeAllowlist.ts`).
2. Add a minimal hook/query assertion with mocked tRPC: same USD/mode, two merchant IDs produce separate requests and lists; request for missing/non-opted-in app never receives opt-in native entries. Reuse current Vitest setup; proxy tests in `../api-proxy-only/src/__tests__/unit/nativeAllowlist.test.ts` already cover fail-closed behavior.

**Exit:** raw batch sends appId in **both** numeric inputs; opted-in catalog shows eligible native assets, missing appId does not; query cache cannot leak options across merchants. This alone does **not** fix native EVM widget filtering.

## Phase 2 — recognize source natives without opening catalog bypass

1. Inspect `packages/pay-common/src/token.ts` (`supportedTokens`, `getKnownToken`, native-by-chain entries), `packages/connectkit/src/hooks/useSupportedChains.tsx`, `useWalletPaymentOptions.ts`, and `src/utils/token.ts`. Today EVM native tokens exist in native-by-chain data but not `supportedTokens`; default `preferredSymbol` conversion iterates only `supportedTokens`, and wallet `isSupported` rejects EVM native options. Reuse `getChainNativeToken(chainId)` for supported source chains in widget recognition and symbol conversion, normalizing the proxy's EVM source sentinel against common's zero-address native token only at the boundary; avoid a second hand-maintained token registry. Preserve chain-aware EVM case normalization and exact `(chainId, token)` matching for explicit preferences; a caller explicitly allowing only stablecoins must still see only stablecoins. Distinguish source sentinel from destination zero-address convention. Extend `getKnownToken` only if required by demonstrated source-quote/display use; do not expand payout assets accidentally.
2. **Do not blindly add EVM natives to `supportedTokens`.** Sibling proxy's `src/lib/deposit.ts` constructs stablecoin deposit rows by iterating that map *and* explicitly adds native rows. A dependency update could then duplicate native rows under an unfiltered address and bypass merchant opt-in. If shared registry changes are unavoidable, change proxy catalog to exclude natives and add assertions for exactly one native entry per supported chain and none without opt-in. Deploy proxy safety fix **before** upgrading its `@rozoai/intent-common` dependency.
3. Check caller configuration: supplied `preferredTokens` list contains only ERC-20 stablecoins. To opt a caller into an eligible native **source**, include correct chain+native sentinel in that explicit list (or omit restriction); `preferredTokenAddress` is only proxy ranking. Make examples/docs demonstrate both defaults and explicit allowlist behavior. Never override merchant allowlist from the UI.

**Tests:** add small Vitest cases for returned EVM native vs unsupported token, EIP-55 casing, explicit stablecoin-only preferences, default ETH/BNB/POL symbol conversion, and proxy catalog de-duplication/opt-in gating if its dependency changes. `packages/connectkit/src/hooks/useWalletPaymentOptions.ts:113-149`, `src/utils/token.ts:7-75`, `../api-proxy-only/src/lib/deposit.ts:81-121` are current decision points.

**Exit:** opted-in/native-funded EVM source visible in widget with correct label/decimals; unopted merchant or explicitly stablecoin-only caller cannot see it; no unfiltered/duplicate catalog entry. Wallet balance/price availability remains a legitimate reason for omission.

## Phase 3 — settle SOL identity at service boundary

Proxy currently returns SOL `11111111111111111111111111111112`, chain `501`; intent-common recognizes `11111111111111111111111111111111`, with an additional public chain `900`. Decide one **canonical external representation** from Phase 0, then normalize only native SOL at the adapter boundary, not every Solana token. Align `packages/connectkit/src/hooks/useSolanaPaymentOptions.ts`, `packages/pay-common/src/token.ts` native recognition/preference comparisons, `packages/connectkit/src/payment/createPaymentPayload.ts` outbound source chain/address, and proxy `src/lib/token.ts`/`src/lib/nativeAllowlist.ts` as required. Keep original quote identity for checkout validation; never silently turn WSOL mint into SOL or change stablecoin mint strings. Ensure `SystemProgram.transfer` path is taken for native SOL only. [Evidence](./native-token-branch-research.md#request-shapes-and-practical-use).

**Tests:** `packages/pay-common/test/token.test.ts` for native aliases vs WSOL; `packages/connectkit/test/createPaymentPayload.test.ts` for quoted native source chain/address/atomic units; proxy unit test for `SOL@900` opt-in while local options use `501`. Check SOL, USDC and WSOL selection independently.

**Exit:** SOL wallet option survives supported/preferred filters, quote uses backend-accepted source identifier, and transfer remains native; WSOL stays SPL. No global replacement of `501` with `900`.

## Phase 4 — safety pass before any funded flow

Trace `packages/connectkit/src/payment/createPaymentPayload.ts` → `src/hooks/usePaymentState.ts` for EVM/SOL/XLM. Existing transfer branches use checkout `source.amount`; retain atomic units (`bigint`/strings), never derive sent native amount from `usdRequired` or preliminary `required.usd`. Verify source chain/token, positive amount, fee semantics, and receiving address against checkout response before wallet submission; add only missing guards. Confirm amount plus gas/rent/reserve can be paid, and that insufficient spendable balance yields a disabled option or safe preflight error rather than transaction surprise. Do not subtract destination payout to pay source fee. Check native deposit address flow's source price and fee-inclusive units separately; that is not same as wallet option estimate. [Execution paths](./native-token-branch-research.md#end-to-end-path-and-limits).

**Tests:** mock a valid native quote and mismatched/missing source; assert exact atomic transfer amount, correct EVM `value` / Solana native instruction / Stellar `Asset.native()`, and no submission for invalid or insufficient-spendable quote. Reuse current connectkit Vitest tests and proxy unit tests rather than adding a test framework.

**Exit:** wrong quote cannot trigger transaction; stablecoin/other wallet paths unchanged.

## Verification, rollout and rollback

| Gate | Command / evidence | Pass criterion |
| --- | --- | --- |
| Proxy unit | `cd ../api-proxy-only && npm run test:unit` | Merchant opt-in/fail-closed and deposit uniqueness assertions pass. |
| Shared/SDK unit | `pnpm --filter @rozoai/intent-common test` and `pnpm --filter @rozoai/intent-pay test` | New source identity/amount/filters assertions pass. |
| Types/build/lint | `pnpm run build:common && pnpm run build:pay && pnpm --filter examples/nextjs-app typecheck && pnpm run lint` | No new errors; lint warnings recorded separately. |
| E2E inventory | `node examples/nextjs-app/e2e/run.cjs --list` | Target native bridge/checkout/deposit/merchant projects present; README `test:e2e:list` is stale. |
| Manual (separate approval) | Funded E2E against opted-in staging/test wallet | ETH, SOL, XLM plus supported BNB/POL routes quote and settle correctly; stablecoin regression and unsupported merchant fail-closed verified. Do not run using supplied addresses without consent. |

Recommended order: upstream contract/merchant opt-in → proxy safety contract if shared registry changes → Phase 1 SDK request → Phase 2 source recognition → Phase 3 SOL mapping → Phase 4 quote safety → tests → limited opted-in rollout. Gate each chain independently. If Phase 0 reveals backend incompatibility, stop that chain rather than showing an unpayable option. Release requires aligned proxy/backend + SDK versions; an SDK-only rollout cannot repair production catalog filtering or backend quote rejection. Rollback: disable affected merchant native opt-ins or revert native UI recognition; keep proxy fail-closed logic and stablecoins intact.

**Not in scope:** new chains, destination-native payout support, changing global ERC-20 catalog policy, or rewriting all payment flows.

## Execution record (local worktree)

- Implemented: deposit query `appId` and merchant-specific cache key; source-only EVM native recognition; proxy/source aliases for ETH, SOL, XLM; canonical Solana System Program address in proxy; stablecoin-only catalog guard; checkout source amount positivity and chain/token checks; native EVM/SOL/XLM spendable-balance preflights; native EVM/SOL deposit QR formats; example native E2E selectors; SDK usage docs.
- Implemented outbound address mapping in the shared `getFee`/`createPayment` request builder: source EVM native → zero address, SOL → `"native"`, XLM unchanged; both `source.tokenAddress` and `destination.tokenAddress` always included on successful requests. SDK source-quote validation accepts backend SOL `"native"` without changing UI/proxy identity.
- Verified locally: common 107 tests, connectkit 129 tests, proxy 49 unit tests; common/pay builds, example typecheck, proxy typecheck, root `pnpm run lint`, 38 E2E projects listed. Mocked transport tests assert identical getFee/createPayment bodies and both token addresses for ETH/BNB/POL/SOL/XLM. Existing warnings are non-fatal. No funded payment executed; live backend quote acceptance remains unverified.
- **Merchant opt-in diagnosed:** a read-only call using the proxy's configured Axios endpoint returned HTTP 200 with 18 supported assets for `rozoBridgeStellar`: no ETH/BNB/POL/SOL rows (XLM is present and exempt). Direct unfiltered `getEvmTokensBalance` returned 13 options, including five nonzero native balances (Base/Arbitrum/Ethereum ETH, Polygon POL, BSC BNB); `getAllowedNativeAssets` returned `[]`. The local `getWalletPaymentOptions` response contains eight stablecoins because `filterPaymentOptionsForApp` removes those five natives. Earlier standalone Python requests returned 403, but this successful proxy-equivalent call resolves the local cause. Merchant native source pairs must be provisioned upstream; never bypass the fail-closed filter. Backend quote acceptance and funded E2E remain unverified and require separate approval/test credentials.
