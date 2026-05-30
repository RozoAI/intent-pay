"use client";

import { createPayment } from "@rozoai/intent-common";
import { RozoPayButton } from "@rozoai/intent-pay";
import { useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeSnippet } from "./CodeSnippet";
import { EventLog, type LogEntry } from "./EventLog";
import { ParamForm, type ParamFormValues } from "./ParamForm";
import { PreviewPane } from "./PreviewPane";
import { usePlaygroundConfig } from "@/hooks/usePlaygroundConfig";
import { generateCheckoutSnippet } from "@/lib/snippets";

const APP_ID = "rozoDemo";

const DEFAULTS: ParamFormValues = {
  toChain: 8453,
  toToken: "",
  toAddress: "",
  toUnits: "",
};

export function CheckoutMode() {
  const [config, setConfig] = usePlaygroundConfig<ParamFormValues>(
    "playground-checkout",
    DEFAULTS,
  );
  const [paymentId, setPaymentId] = useState<string | null>(null);
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

  const handleConfigChange = useCallback(
    (values: ParamFormValues) => {
      setConfig(values);
      // Config change clears paymentId — user must re-click Create Payment
      setPaymentId(null);
      setError(null);
    },
    [setConfig],
  );

  const handleCreatePayment = useCallback(async () => {
    setCreating(true);
    setError(null);
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
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <RozoPayButton.Custom
                key={paymentId}
                appId={APP_ID}
                payId={paymentId}
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
              <p className="text-xs text-muted-foreground font-mono break-all max-w-xs text-center">
                paymentId: {paymentId}
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Fill in all fields to create a payment.
        </p>
      )}
      <div className="w-full">
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          Events
        </p>
        <EventLog entries={logs} />
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6">
      <aside className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Configuration
        </p>
        <ParamForm values={config} onChange={handleConfigChange} showAmount />
      </aside>
      <main>
        <PreviewPane
          preview={preview}
          code={snippet ? <CodeSnippet code={snippet} /> : null}
        />
      </main>
    </div>
  );
}
