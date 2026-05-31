import { getChainById } from "@rozoai/intent-common";

export interface BridgeConfig {
  toChain: number;
  toToken: string;
  toAddress: string;
  toUnits: string;
}

export type CheckoutConfig = BridgeConfig;

export interface DepositConfig {
  toChain: number;
  toToken: string;
  toAddress: string;
}

const APP_ID = "rozoDemo";

function isEvm(chainId: number): boolean {
  return getChainById(chainId)?.type === "evm";
}

function addrExpr(address: string, chainId: number): string {
  return isEvm(chainId) ? `getAddress("${address}")` : `"${address}"`;
}

function tokExpr(token: string, chainId: number): string {
  return isEvm(chainId) ? `getAddress("${token}")` : `"${token}"`;
}

function viemImport(chainId: number): string {
  return isEvm(chainId) ? `import { getAddress } from "viem";\n` : "";
}

export function generateBridgeSnippet(config: BridgeConfig): string {
  const addr = addrExpr(config.toAddress, config.toChain);
  const tok = tokExpr(config.toToken, config.toChain);

  return `${viemImport(config.toChain)}import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay";
import { useEffect, useState } from "react";

const APP_ID = "${APP_ID}";

export default function BridgePayment() {
  const { resetPayment } = useRozoPayUI();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    resetPayment({
      toChain: ${config.toChain},
      toToken: ${tok},
      toAddress: ${addr},
      toUnits: "${config.toUnits}",
    }).then(() => setReady(true));
  }, [resetPayment]);

  return (
    <RozoPayButton.Custom
      appId={APP_ID}
      toChain={${config.toChain}}
      toToken={${tok}}
      toAddress={${addr}}
      toUnits="${config.toUnits}"
      intent="Bridge"
      onPaymentStarted={(e) => console.log("started", e)}
      onPaymentCompleted={(e) => console.log("completed", e)}
      onPayoutCompleted={(e) => console.log("payout", e)}
    >
      {({ show }) => (
        <button onClick={show} disabled={!ready}>
          Pay Now
        </button>
      )}
    </RozoPayButton.Custom>
  );
}`;
}

export function generateCheckoutSnippet(config: CheckoutConfig): string {
  const addr = addrExpr(config.toAddress, config.toChain);
  const tok = tokExpr(config.toToken, config.toChain);

  return `${viemImport(config.toChain)}import { RozoPayButton } from "@rozoai/intent-pay";
import { createPayment } from "@rozoai/intent-common";
import { useState } from "react";

const APP_ID = "${APP_ID}";

export default function OnlineCheckout() {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreatePayment() {
    setLoading(true);
    try {
      const result = await createPayment({
        appId: APP_ID,
        toChain: ${config.toChain},
        toToken: ${tok},
        toAddress: ${addr},
        toUnits: "${config.toUnits}",
        preferredChain: ${config.toChain},
        preferredTokenAddress: ${tok},
      });
      setPaymentId(result.id);
    } finally {
      setLoading(false);
    }
  }

  if (!paymentId) {
    return (
      <button onClick={handleCreatePayment} disabled={loading}>
        {loading ? "Creating..." : "Create Payment"}
      </button>
    );
  }

  return (
    <RozoPayButton.Custom
      key={paymentId}
      payId={paymentId}
      intent="Checkout"
      onPaymentStarted={(e) => console.log("started", e)}
      onPaymentCompleted={(e) => console.log("completed", e)}
      onPayoutCompleted={(e) => console.log("payout", e)}
    >
      {({ show }) => <button onClick={show}>Pay Now</button>}
    </RozoPayButton.Custom>
  );
}`;
}

export function generateDepositSnippet(config: DepositConfig): string {
  const addr = addrExpr(config.toAddress, config.toChain);
  const tok = tokExpr(config.toToken, config.toChain);

  return `${viemImport(config.toChain)}import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay";
import { useEffect, useState } from "react";

const APP_ID = "${APP_ID}";

export default function WalletDeposit() {
  const { resetPayment } = useRozoPayUI();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    resetPayment({
      toChain: ${config.toChain},
      toToken: ${tok},
      toAddress: ${addr},
      // No toUnits — user enters amount inside the modal
    }).then(() => setReady(true));
  }, [resetPayment]);

  return (
    <RozoPayButton.Custom
      appId={APP_ID}
      toChain={${config.toChain}}
      toToken={${tok}}
      toAddress={${addr}}
      intent="Deposit"
      onPaymentStarted={(e) => console.log("started", e)}
      onPaymentCompleted={(e) => console.log("completed", e)}
      onPayoutCompleted={(e) => console.log("payout", e)}
    >
      {({ show }) => (
        <button onClick={show} disabled={!ready}>
          Deposit
        </button>
      )}
    </RozoPayButton.Custom>
  );
}`;
}
