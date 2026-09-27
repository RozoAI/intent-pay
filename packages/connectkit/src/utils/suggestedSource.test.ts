import {
  base,
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
