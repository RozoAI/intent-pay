// All values are atomic units. Reserve one unit beyond the quoted transfer
// and estimated network fee so native payments never intentionally drain gas.
export function assertNativeSpendable(
  balance: bigint,
  amount: bigint,
  fee: bigint,
  symbol: string,
): void {
  if (amount <= 0n || fee < 0n || balance <= amount + fee) {
    throw new Error(`Insufficient spendable ${symbol} for payment and network fee`);
  }
}
