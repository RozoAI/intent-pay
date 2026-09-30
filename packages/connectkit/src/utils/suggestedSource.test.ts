import {
  base,
  getChainNativeToken,
  getChainWrappedNativeToken,
  ethereum,
  polygon,
  stellar,
  rozoStellar,
  baseUSDC,
  baseUSDT,
  bsc,
  bscUSDT,
  rozoSolana,
  rozoSolanaUSDC,
  solana,
} from "@rozoai/intent-common";
import { describe, expect, it } from "vitest";
import { suggestedSourceRank } from "./suggestedSource";

describe("suggestedSourceRank", () => {
  it.each([ethereum, base, bsc, polygon, solana, stellar, rozoSolana, rozoStellar])(
    "matches Native to the registered native asset on $name",
    (chain) => {
      const native = getChainNativeToken(chain.chainId);
      expect(suggestedSourceRank(chain.chainId, native.token, {
        chainId: chain.chainId, symbol: "nAtIvE",
      })).toBe(0);
    },
  );

  it("does not treat wrapped native or stablecoins as Native", () => {
    const s = { chainId: base.chainId, symbol: "Native" };
    expect(suggestedSourceRank(base.chainId, baseUSDC.token, s)).toBe(1);
    expect(suggestedSourceRank(base.chainId, getChainWrappedNativeToken(base.chainId).token, s)).toBe(1);
    expect(suggestedSourceRank(bsc.chainId, getChainNativeToken(bsc.chainId).token, s)).toBe(2);
    expect(suggestedSourceRank(999999999, "unknown", { chainId: 999999999, symbol: "Native" })).toBe(1);
  });

  it.each([[solana, rozoSolana], [stellar, rozoStellar]])(
    "matches Native across native and Rozo chain aliases",
    (chain, alias) => {
      const native = getChainNativeToken(chain.chainId);
      expect(suggestedSourceRank(chain.chainId, native.token, { chainId: alias.chainId, symbol: "Native" })).toBe(0);
      expect(suggestedSourceRank(alias.chainId, native.token, { chainId: chain.chainId, symbol: "Native" })).toBe(0);
    },
  );

  it("ranks exact chain and symbol first, same chain next, others last", () => {
    const s = { chainId: base.chainId, symbol: "usdc" };
    expect(suggestedSourceRank(base.chainId, baseUSDC.token, s)).toBe(0);
    expect(suggestedSourceRank(base.chainId, baseUSDT.token, s)).toBe(1);
    expect(suggestedSourceRank(bsc.chainId, bscUSDT.token, s)).toBe(2);
  });

  it("treats every option equally when there is no suggestion", () => {
    expect(suggestedSourceRank(base.chainId, baseUSDC.token, undefined)).toBe(2);
    expect(suggestedSourceRank(bsc.chainId, bscUSDT.token, undefined)).toBe(2);
  });

  it("matches chain only when no symbol is given", () => {
    const s = { chainId: bsc.chainId };
    expect(suggestedSourceRank(bsc.chainId, bscUSDT.token, s)).toBe(1);
    expect(suggestedSourceRank(base.chainId, baseUSDC.token, s)).toBe(2);
  });

  it("matches Solana across native and Rozo chain IDs", () => {
    const s = { chainId: solana.chainId, symbol: "USDC" };
    expect(suggestedSourceRank(rozoSolana.chainId, rozoSolanaUSDC.token, s)).toBe(0);
  });
});
