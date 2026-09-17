import { describe, expect, it } from "vitest";
import { ROUTES } from "../../constants/routes";
import {
  isCloseable,
  showsBackButton,
  WALLET_REQUEST_MESSAGE,
  type WalletPaymentState,
} from "./guards";

const PAYMENT_ROUTES = [
  ROUTES.PAY_WITH_TOKEN,
  ROUTES.SOLANA_PAY_WITH_TOKEN,
  ROUTES.STELLAR_PAY_WITH_TOKEN,
];

function closeable(route: ROUTES, walletPaymentState: WalletPaymentState) {
  return isCloseable({
    route,
    walletPaymentState,
    paymentFsmState: "payment_unpaid",
    isDepositAddressReady: false,
    enforceSupportedChains: false,
    isEthConnected: true,
    chainIsSupported: true,
  });
}

function back(route: ROUTES, walletPaymentState: WalletPaymentState) {
  return showsBackButton({
    route,
    walletPaymentState,
    paymentFsmState: "payment_unpaid",
  });
}

describe("RozoPayModal wallet confirmation guards", () => {
  it("keeps wallet exit confirmation copy short and user-facing", () => {
    expect(WALLET_REQUEST_MESSAGE).toBe(
      "Wallet still needs your action. Reject or close it in your wallet first.",
    );
    expect(WALLET_REQUEST_MESSAGE).not.toContain("SDK");
  });

  it.each(PAYMENT_ROUTES)("allows Back/Close confirmation while waiting on %s", (route) => {
    expect(back(route, "waiting")).toBe(true);
    expect(closeable(route, "waiting")).toBe(true);
  });

  it.each(PAYMENT_ROUTES)("hides Back/Close while processing on %s", (route) => {
    expect(back(route, "processing")).toBe(false);
    expect(closeable(route, "processing")).toBe(false);
  });

  it("keeps EVM active payment route locked outside wallet-waiting state", () => {
    expect(closeable(ROUTES.PAY_WITH_TOKEN, "idle")).toBe(false);
  });

  it.each([ROUTES.SOLANA_PAY_WITH_TOKEN, ROUTES.STELLAR_PAY_WITH_TOKEN])(
    "does not over-lock %s before wallet wait/processing state",
    (route) => {
      expect(back(route, "idle")).toBe(true);
      expect(closeable(route, "idle")).toBe(true);
    },
  );
});
