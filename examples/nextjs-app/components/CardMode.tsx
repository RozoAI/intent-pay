"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSharedConfig } from "@/hooks/useSharedConfig"
import { createPayment } from "@rozoai/intent-common"
import { RozoPayCard } from "@rozoai/intent-pay"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { EventLog, type LogEntry } from "./EventLog"
import { ParamForm } from "./ParamForm"
import { PreviewPane } from "./PreviewPane"

const APP_ID = "rozoDemo"

export function CardMode() {
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
                variant="secondary"
                size="sm"
                disabled={!manualPayId.trim()}
              >
                Use
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Payment ID</p>
            <p className="font-mono text-xs break-all">{paymentId}</p>
          </div>
          <RozoPayCard
            payId={paymentId}
            onPaymentStarted={(event) => {
              addLog("started", event)
            }}
            onPaymentCompleted={(event) => {
              addLog("completed", event)
            }}
            onPaymentBounced={(event) => {
              addLog("completed", event)
            }}
            onPayoutCompleted={(event) => {
              addLog("payout", event)
            }}
            width={480}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={resetPaymentState}
          >
            Reset
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Configuration</h2>
        <ParamForm
          values={pending}
          onChange={setPending}
          showAmount
          hydrated={hydrated}
        />
      </div>
      <div>
        <PreviewPane
          preview={preview}
          code={null}
        />
        <EventLog entries={logs} />
      </div>
    </div>
  )
}
