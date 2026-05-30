"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";

export interface LogEntry {
  id: string;
  type: "started" | "completed" | "payout";
  payload: unknown;
}

interface EventLogProps {
  entries: LogEntry[];
}

const labelMap: Record<LogEntry["type"], string> = {
  started: "onPaymentStarted",
  completed: "onPaymentCompleted",
  payout: "onPayoutCompleted",
};

const colorMap: Record<LogEntry["type"], string> = {
  started: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  payout: "bg-violet-500/20 text-violet-300 border-violet-500/30",
};

export function EventLog({ entries }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Events will appear here as you complete payment steps.
      </p>
    );
  }

  return (
    <ScrollArea className="h-40 w-full rounded-md border border-border bg-secondary/50">
      <div className="p-3 space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-2">
            <Badge
              variant="outline"
              className={`shrink-0 text-xs px-1.5 py-0.5 ${colorMap[entry.type]}`}
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
  );
}
