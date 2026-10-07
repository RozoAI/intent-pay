/**
 * Native source tokens — E2E fixtures.
 *
 * Payload builders for the tRPC `getDepositAddressOptions` endpoint. The shapes
 * mirror the live `intentapiv4.rozo.ai` response exactly (captured empirically):
 * a tRPC batch envelope `[{ result: { data: DepositAddressPaymentOptionMetadata[] } }]`
 * whose rows are `{ id, logoURI, minimumUsd, chainId, token }`.
 *
 * Deliberately plain objects (no `@rozoai/intent-common` import): the published
 * package ships extensionless ESM subpaths that Playwright's transform cannot
 * resolve, and hardcoded payloads are what the backend actually returns.
 */

const LOGO = "https://imagedelivery.net/AKLvTMvIg6yc9W08fHl1Tg/rozo/public"

/** Canonical EVM native sentinel the API quotes (zero address). */
export const EVM_NATIVE_SENTINEL = "0x0000000000000000000000000000000000000000"
/** Legacy proxy/UI EVM native sentinel (EIP-7528). */
export const EVM_NATIVE_SENTINEL_LEGACY =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
/** Solana System Program — the proxy's native SOL sentinel. */
export const SOL_NATIVE_SENTINEL = "11111111111111111111111111111112"
/** Wrapped SOL SPL mint — must NOT be treated as native. */
export const WSOL_MINT = "So11111111111111111111111111111111111111112"

export type TestToken = {
  chainId: number
  token: string
  name: string
  symbol: string
  decimals: number
  fiatISO?: string
}

export type TestDepositOption = {
  id: string
  logoURI: string
  minimumUsd: number
  chainId: number
  token: TestToken & {
    logoURI: string
    logoSourceURI: string
    minimumUsd: number
  }
}

function decorate(
  token: TestToken,
  minimumUsd = 0.01
): TestDepositOption["token"] {
  return { ...token, logoURI: LOGO, logoSourceURI: LOGO, minimumUsd }
}

/** Build one deposit option row exactly as the API returns it. */
export function depositOption(
  id: string,
  chainId: number,
  token: TestToken,
  minimumUsd = 0.01
): TestDepositOption {
  return {
    id,
    logoURI: LOGO,
    minimumUsd,
    chainId,
    token: decorate(token, minimumUsd),
  }
}

// ── Native source rows (one per opt-in chain) ────────────────────────────────

export const nativeEthEthereum = depositOption("ETH on Ethereum", 1, {
  chainId: 1,
  token: EVM_NATIVE_SENTINEL,
  name: "Ether",
  symbol: "ETH",
  decimals: 18,
})

export const nativeEthBase = depositOption("ETH on Base", 8453, {
  chainId: 8453,
  token: EVM_NATIVE_SENTINEL_LEGACY,
  name: "Ether",
  symbol: "ETH",
  decimals: 18,
})

export const nativeEthArbitrum = depositOption("ETH on Arbitrum", 42161, {
  chainId: 42161,
  token: EVM_NATIVE_SENTINEL,
  name: "Ether",
  symbol: "ETH",
  decimals: 18,
})

export const nativePolPolygon = depositOption("POL on Polygon", 137, {
  chainId: 137,
  token: EVM_NATIVE_SENTINEL,
  name: "Polygon Ecosystem Token",
  symbol: "POL",
  decimals: 18,
})

export const nativeBnbBsc = depositOption("BNB on BNB", 56, {
  chainId: 56,
  token: EVM_NATIVE_SENTINEL,
  name: "BNB",
  symbol: "BNB",
  decimals: 18,
})

/** Proxy sentinel (`1111…1112`), not canonical `solanaSOL.token` — must normalize. */
export const nativeSolProxySentinel = depositOption("SOL on Solana", 501, {
  chainId: 501,
  token: SOL_NATIVE_SENTINEL,
  name: "Solana",
  symbol: "SOL",
  decimals: 9,
})

/** XLM is exempt from merchant opt-in and always surfaced. */
export const nativeXlmStellar = depositOption("XLM on Stellar", 1500, {
  chainId: 1500,
  token: "XLM",
  name: "Stellar Lumens",
  symbol: "XLM",
  decimals: 7,
})

export const ALL_NATIVE_ROWS: TestDepositOption[] = [
  nativeEthEthereum,
  nativeEthBase,
  nativeEthArbitrum,
  nativePolPolygon,
  nativeBnbBsc,
  nativeSolProxySentinel,
  nativeXlmStellar,
]

// ── Stablecoin rows (must keep rendering unchanged) ──────────────────────────

export const stableUsdcBase = depositOption("USDC on Base", 8453, {
  chainId: 8453,
  token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
})

export const stableUsdtEthereum = depositOption("USDT on Ethereum", 1, {
  chainId: 1,
  token: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  name: "Tether USD",
  symbol: "USDT",
  decimals: 6,
})

export const ALL_STABLE_ROWS: TestDepositOption[] = [
  stableUsdcBase,
  stableUsdtEthereum,
]

/**
 * Number of batched calls in a tRPC httpBatchLink request. The SDK batches the
 * deposit-address hook twice (StrictMode double-invoke), so the URL path lists
 * the procedure more than once and the client expects one result per input.
 * Returning the wrong length makes tRPC throw `Missing result`, which the SDK
 * swallows into the static fallback catalog.
 */
export function batchCount(url: string): number {
  const input = new URL(url).searchParams.get("input")
  if (!input) return 1
  try {
    const parsed = JSON.parse(input) as Record<string, unknown>
    return Math.max(1, Object.keys(parsed).length)
  } catch {
    return 1
  }
}

/** Wrap rows in the tRPC batch envelope the SDK's httpBatchLink expects. */
export function trpcBatch(rows: TestDepositOption[], count = 1): string {
  return JSON.stringify(
    Array.from({ length: count }, () => ({ result: { data: rows } }))
  )
}
