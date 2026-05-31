"use client";

import { Button } from "@/components/ui/button";
import { useSharedConfig } from "@/hooks/useSharedConfig";
import { generateCheckoutSnippet } from "@/lib/snippets";
import { createPayment } from "@rozoai/intent-common";
import { RozoPayButton } from "@rozoai/intent-pay";
import { useCallback, useId, useState } from "react";
import { CodeSnippet } from "./CodeSnippet";
import { EventLog, type LogEntry } from "./EventLog";
import { ModeDescription } from "./ModeDescription";
import { ParamForm, type ParamFormValues } from "./ParamForm";
import { PreviewPane } from "./PreviewPane";

const APP_ID = "rozoDemo";

export function CheckoutMode() {
  const [config, setConfig, hydrated] = useSharedConfig();
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [mountKey, setMountKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const uid = useId();

  const isConfigValid =
    config.toChain > 0 &&
    config.toToken !== "" &&
    config.toAddress !== "" &&
    config.toUnits !== "";

  const addLog = useCallback(
    (type: LogEntry["type"], payload: unknown) => {
      setLogs((prev) => [
        ...prev,
        { id: `${uid}-${Date.now()}`, type, payload },
      ]);
    },
    [uid],
  );

  const resetPaymentState = useCallback(() => {
    setPaymentId(null);
    setMountKey((k) => k + 1);
    setError(null);
  }, []);

  const handleConfigChange = useCallback(
    (values: ParamFormValues) => {
      setConfig(values);
      resetPaymentState();
    },
    [setConfig, resetPaymentState],
  );

  const handleCreatePayment = useCallback(async () => {
    setCreating(true);
    setError(null);
    setPaymentId(null);
    try {
      const result = await createPayment({
        appId: APP_ID,
        toChain: config.toChain,
        toToken: config.toToken,
        toAddress: config.toAddress,
        toUnits: config.toUnits,
        preferredChain: config.toChain,
        preferredTokenAddress: config.toToken,
      });
      setMountKey((k) => k + 1);
      setPaymentId(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payment");
    } finally {
      setCreating(false);
    }
  }, [config]);

  const snippet = isConfigValid ? generateCheckoutSnippet(config) : "";

  const preview = (
    <div className="flex flex-col items-center gap-6 py-4">
      {isConfigValid ? (
        <>
          {!paymentId ? (
            <div className="flex flex-col items-center gap-3">
              <Button
                onClick={handleCreatePayment}
                disabled={creating}
                size="lg"
                className="min-w-44"
              >
                {creating ? "Creating Payment…" : "Create Payment"}
              </Button>
              {error && (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={handleCreatePayment}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {paymentId && !creating && (
                <RozoPayButton.Custom
                  key={mountKey}
                  payId={paymentId}
                  intent="Checkout"
                  onPaymentStarted={(e) => addLog("started", e)}
                  onPaymentCompleted={(e) => addLog("completed", e)}
                  onPayoutCompleted={(e) => addLog("payout", e)}
                >
                  {({ show }) => (
                    <Button onClick={show} size="lg" className="min-w-40">
                      Pay Now
                    </Button>
                  )}
                </RozoPayButton.Custom>
              )}
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-xs text-muted-foreground font-mono break-all max-w-md text-center">
                  Payment ID: {paymentId}
                </p>
                <Button
                  variant="secondary"
                  className="text-muted-foreground"
                  onClick={resetPaymentState}
                >
                  Create new payment
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Fill in all fields to create a payment.
        </p>
      )}
      <div className="w-full">
        <EventLog entries={logs} onClear={() => setLogs([])} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <ModeDescription
        title="Online Checkout"
        summary="Server-side payment creation flow. Your backend calls createPayment() to generate a unique payment ID, then passes it to the SDK. This separates order creation from the payment UI, making it suitable for e-commerce and invoicing."
        steps={[
          { step: 1, label: "Set destination chain, token, address & amount" },
          { step: 2, label: 'Click "Create Payment" to call createPayment() API' },
          { step: 3, label: "API returns a paymentId tied to this order" },
          { step: 4, label: "SDK opens with payId; user pays against that order" },
        ]}
        note="In production, createPayment() runs on your server so users can't tamper with the amount or destination."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <aside className="space-y-4" aria-label="Configuration">
          <p className="text-xs font-medium text-muted-foreground">
            Configuration
          </p>
          <ParamForm values={config} onChange={handleConfigChange} showAmount hydrated={hydrated} />
        </aside>
        <main>
          <PreviewPane
            preview={preview}
            code={snippet ? <CodeSnippet code={snippet} /> : null}
          />
        </main>
      </div>
    </div>
  );
}
