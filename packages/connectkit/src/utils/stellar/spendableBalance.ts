const STROOPS_PER_XLM = 10_000_000n;
const STROOPS_PER_RESERVE_ENTRY = 5_000_000n;

export type StellarNativeBalance = {
  balance: string;
  selling_liabilities?: string;
};

function xlmToStroops(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(value);
  if (!match) {
    throw new Error("Could not determine XLM balance");
  }

  const [, whole, fraction = ""] = match;
  return BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction.padEnd(7, "0"));
}

export function calculateStellarSpendableStroops({
  nativeBalance,
  subentryCount = 0,
  numSponsored = 0,
  numSponsoring = 0,
}: {
  nativeBalance: StellarNativeBalance;
  subentryCount?: number;
  numSponsored?: number;
  numSponsoring?: number;
}): bigint {
  const reserveEntries = 2 + subentryCount - numSponsored + numSponsoring;
  if (!Number.isSafeInteger(reserveEntries) || reserveEntries < 0) {
    throw new Error("Could not determine XLM balance");
  }

  return (
    xlmToStroops(nativeBalance.balance) -
    BigInt(reserveEntries) * STROOPS_PER_RESERVE_ENTRY -
    xlmToStroops(nativeBalance.selling_liabilities ?? "0")
  );
}

export function calculateStellarSpendableXlm(input: {
  nativeBalance: StellarNativeBalance;
  subentryCount?: number;
  numSponsored?: number;
  numSponsoring?: number;
}): number {
  return Number(calculateStellarSpendableStroops(input)) / Number(STROOPS_PER_XLM);
}
