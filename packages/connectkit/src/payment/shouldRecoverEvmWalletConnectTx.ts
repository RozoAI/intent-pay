export function shouldRecoverEvmWalletConnectTx(
  connectorId: string | undefined,
  paymentId: string | undefined,
): paymentId is string {
  return connectorId === "walletConnect" && paymentId != null;
}
