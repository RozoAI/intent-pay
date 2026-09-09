export function resolveConfirmedPayoutTxHash(
  payinTxHash: string | undefined,
  payoutTxHash: string | undefined,
  sameTxPayout: boolean,
): string | undefined {
  return sameTxPayout ? payinTxHash : payoutTxHash;
}
