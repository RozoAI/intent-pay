"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export interface LogEntry {
  id: string;
  type: "started" | "completed" | "payout";
  payload: unknown;
}

interface EventLogProps {
  entries: LogEntry[];
  onClear?: () => void;
}

const labelMap: Record<LogEntry["type"], string> = {
  started: "onPaymentStarted",
  completed: "onPaymentCompleted",
  payout: "onPayoutCompleted",
};

const colorMap: Record<LogEntry["type"], string> = {
  started: "bg-blue-500/20 text-blue-600 border-blue-500/30 dark:text-blue-300",
  completed: "bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-300",
  payout: "bg-violet-500/20 text-violet-700 border-violet-500/30 dark:text-violet-300",
};

export function EventLog({ entries, onClear }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Events</p>
        {entries.length > 0 && onClear && (
          <Button
            variant="ghost"
            size="icon"
            className="size-5 text-muted-foreground hover:text-foreground"
            onClick={onClear}
            aria-label="Clear event log"
          >
            <X className="size-3" />
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">
          Events will appear here as you complete payment steps.
        </p>
      ) : (
        <ScrollArea
          className="h-40 w-full rounded-md border border-border bg-muted/40"
          aria-label="SDK events"
          aria-live="polite"
          aria-atomic="false"
        >
          <div className="p-3 space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2">
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs px-1.5 py-0.5 font-mono ${colorMap[entry.type]}`}
                >
                  {labelMap[entry.type]}
                </Badge>
                <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
