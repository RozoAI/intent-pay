import { ROUTES } from "../../constants/routes";

export type WalletPaymentState = "idle" | "waiting" | "processing";

type PaymentFsmState =
  | "idle"
  | "preview"
  | "unhydrated"
  | "payment_unpaid"
  | "payment_started"
  | "payment_completed"
  | "payment_bounced"
  | "payout_completed"
  | "error";

export const WALLET_REQUEST_MESSAGE =
  "Wallet still needs your action. Reject or close it in your wallet first.";

export function isWalletWaiting(walletPaymentState: WalletPaymentState) {
  return walletPaymentState === "waiting";
}

export function isWalletProcessing(walletPaymentState: WalletPaymentState) {
  return walletPaymentState === "processing";
}

export function isCloseable({
  route,
  walletPaymentState,
  paymentFsmState,
  isDepositAddressReady,
  enforceSupportedChains,
  isEthConnected,
  chainIsSupported,
}: {
  route: string;
  walletPaymentState: WalletPaymentState;
  paymentFsmState: PaymentFsmState;
  isDepositAddressReady: boolean;
  enforceSupportedChains: boolean | undefined;
  isEthConnected: boolean;
  chainIsSupported: boolean | null;
}) {
  const actionLocked =
    (route === ROUTES.PAY_WITH_TOKEN && !isWalletWaiting(walletPaymentState)) ||
    route === ROUTES.WAITING_WALLET ||
    route === ROUTES.WAITING_EXTERNAL ||
    isWalletProcessing(walletPaymentState) ||
    (route === ROUTES.CONFIRMATION && paymentFsmState === "payment_started");

  return !(
    enforceSupportedChains &&
    isEthConnected &&
    chainIsSupported === false
  ) &&
    !actionLocked &&
    !isDepositAddressReady;
}

export function showsBackButton({
  route,
  walletPaymentState,
  paymentFsmState,
}: {
  route: string;
  walletPaymentState: WalletPaymentState;
  paymentFsmState: PaymentFsmState;
}) {
  return route === ROUTES.WAITING_DEPOSIT_ADDRESS ||
    (route !== ROUTES.SELECT_METHOD &&
      route !== ROUTES.CONFIRMATION &&
      route !== ROUTES.SELECT_TOKEN &&
      route !== ROUTES.ERROR &&
      paymentFsmState !== "error" &&
      !isWalletProcessing(walletPaymentState));
}
