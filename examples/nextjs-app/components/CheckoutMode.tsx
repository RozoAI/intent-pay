"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSharedConfig } from "@/hooks/useSharedConfig"
import { generateCheckoutSnippet } from "@/lib/snippets"
import { createPayment } from "@rozoai/intent-common"
import { RozoPayButton } from "@rozoai/intent-pay"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { CodeSnippet } from "./CodeSnippet"
import { EventLog, type LogEntry } from "./EventLog"
import { ModeDescription } from "./ModeDescription"
import { ParamForm } from "./ParamForm"
import { PreviewPane } from "./PreviewPane"

const APP_ID = "rozoDemo"

export function CheckoutMode() {
  const [config, setConfig, hydrated] = useSharedConfig()
  const [pending, setPending] = useState(config)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [manualPayId, setManualPayId] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const uid = useId()
  // sync pending when storage hydrates
  useEffect(() => {
    if (hydrated) setPending(config)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  const isPendingValid =
    pending.toChain > 0 &&
    pending.toToken !== "" &&
    pending.toAddress !== "" &&
    pending.toUnits !== ""

  const isDirty = useMemo(
    () => JSON.stringify(pending) !== JSON.stringify(config),
    [pending, config]
  )

  const isConfigValid =
    config.toChain > 0 &&
    config.toToken !== "" &&
    config.toAddress !== "" &&
    config.toUnits !== ""

  const addLog = useCallback(
    (type: LogEntry["type"], payload: unknown) => {
      setLogs((prev) => [
        ...prev,
        { id: `${uid}-${Date.now()}`, type, timestamp: Date.now(), payload },
      ])
    },
    [uid]
  )

  const resetPaymentState = useCallback(() => {
    setPaymentId(null)
    setError(null)
    setManualPayId("")
  }, [])

  const handleUseManualPayId = useCallback(() => {
    const id = manualPayId.trim()
    if (!id) return
    setPaymentId(id)
    setError(null)
  }, [manualPayId])

  const handleConfirm = useCallback(() => {
    setConfig(pending)
    resetPaymentState()
  }, [setConfig, pending, resetPaymentState])

  const handleCreatePayment = useCallback(async () => {
    setCreating(true)
    setError(null)
    setPaymentId(null)
    try {
      const result = await createPayment({
        appId: APP_ID,
        toChain: config.toChain,
        toToken: config.toToken,
        toAddress: config.toAddress,
        toUnits: config.toUnits,
        preferredChain: config.toChain,
        preferredTokenAddress: config.toToken,
      })
      setPaymentId(result.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payment")
    } finally {
      setCreating(false)
    }
  }, [config])

  const snippet = isConfigValid ? generateCheckoutSnippet(config) : ""

  const preview = (
    <div className="flex flex-col items-center gap-6 py-4">
      {!paymentId ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          {isConfigValid && (
            <>
              <Button
                onClick={handleCreatePayment}
                disabled={creating}
                size="lg"
                className="w-full min-w-44"
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
              <div className="flex w-full items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          <div className="flex w-full flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Enter Payment ID manually
            </Label>
            <div className="flex gap-2">
              <Input
                value={manualPayId}
                onChange={(e) => setManualPayId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUseManualPayId()}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="flex-1 border-border bg-secondary font-mono text-xs"
              />
              <Button
                onClick={handleUseManualPayId}
                disabled={!manualPayId.trim()}
                variant="secondary"
                size="sm"
              >
                Use
              </Button>
            </div>
          </div>
          {!isConfigValid && (
            <p className="text-center text-xs text-muted-foreground">
              Fill in configuration fields to use Create Payment, or enter a
              Payment ID directly.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <RozoPayButton.Custom
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
          <div className="flex flex-col items-center gap-1.5">
            <p className="max-w-md text-center font-mono text-xs break-all text-muted-foreground">
              Payment ID: {paymentId}
            </p>
            <Button
              variant="secondary"
              className="text-muted-foreground"
              onClick={resetPaymentState}
            >
              Use different payment
            </Button>
          </div>
        </div>
      )}
      <div className="w-full">
        <EventLog entries={logs} onClear={() => setLogs([])} />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <ModeDescription
        title="Online Checkout"
        summary="Server-side payment creation flow. Your backend calls createPayment() to generate a unique payment ID, then passes it to the SDK. This separates order creation from the payment UI, making it suitable for e-commerce and invoicing."
        steps={[
          { step: 1, label: "Set destination chain, token, address & amount" },
          {
            step: 2,
            label: 'Click "Create Payment" to call createPayment() API',
          },
          { step: 3, label: "API returns a paymentId tied to this order" },
          {
            step: 4,
            label: "SDK opens with payId; user pays against that order",
          },
        ]}
        note="In production, createPayment() runs on your server so users can't tamper with the amount or destination."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4" aria-label="Configuration">
          <p className="text-xs font-medium text-muted-foreground">
            Configuration
          </p>
          <ParamForm
            values={pending}
            onChange={setPending}
            showAmount
            hydrated={hydrated}
          />
          <Button
            onClick={handleConfirm}
            disabled={!isPendingValid || !isDirty}
            size="sm"
            className="w-full"
          >
            Confirm
          </Button>
        </aside>
        <main>
          <PreviewPane
            preview={preview}
            code={snippet ? <CodeSnippet code={snippet} /> : null}
          />
        </main>
      </div>
    </div>
  )
}
