"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface LogEntry {
  id: string;
  type: "started" | "completed" | "payout";
  timestamp?: number;
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

function formatTime(ts?: number) {
  if (!ts) return null;
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function EventEntry({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(true);
  const json = JSON.stringify(entry.payload, null, 2);

  return (
    <div className="rounded-md border border-border overflow-hidden">
      {/* sticky header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-muted/60 hover:bg-muted transition-colors sticky top-0 z-10"
      >
        {open ? (
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        )}
        <Badge
          variant="outline"
          className={`shrink-0 text-[10px] px-1.5 py-0 font-mono leading-5 ${colorMap[entry.type]}`}
        >
          {labelMap[entry.type]}
        </Badge>
        {entry.timestamp && (
          <span className="ml-auto text-[10px] text-muted-foreground/60 font-mono tabular-nums">
            {formatTime(entry.timestamp)}
          </span>
        )}
      </button>

      {/* collapsible body */}
      {open && (
        <div className="bg-background/50">
          <pre className="text-[11px] font-mono leading-relaxed text-foreground/80 p-3 overflow-x-auto whitespace-pre">
            <JsonHighlight json={json} />
          </pre>
        </div>
      )}
    </div>
  );
}

function JsonHighlight({ json }: { json: string }) {
  const parts: React.ReactNode[] = [];
  // tokenise just enough for keys / strings / numbers / booleans / null
  const re = /("(?:[^"\\]|\\.)*")\s*(:)?|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(json)) !== null) {
    if (match.index > last) {
      parts.push(<span key={last}>{json.slice(last, match.index)}</span>);
    }

    if (match[1] && match[2]) {
      // object key
      parts.push(<span key={match.index} className="text-blue-400 dark:text-blue-300">{match[1]}</span>);
      parts.push(<span key={`${match.index}c`}>:</span>);
    } else if (match[1]) {
      // string value
      parts.push(<span key={match.index} className="text-green-500 dark:text-green-400">{match[1]}</span>);
    } else if (match[3]) {
      // boolean / null
      parts.push(<span key={match.index} className="text-amber-500 dark:text-amber-400">{match[3]}</span>);
    } else if (match[4]) {
      // number
      parts.push(<span key={match.index} className="text-violet-500 dark:text-violet-400">{match[4]}</span>);
    }

    last = match.index + match[0].length;
  }

  if (last < json.length) {
    parts.push(<span key={last}>{json.slice(last)}</span>);
  }

  return <>{parts}</>;
}

export function EventLog({ entries, onClear }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Events
          {entries.length > 0 && (
            <span className="ml-1.5 text-muted-foreground/50">({entries.length})</span>
          )}
        </p>
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
          className="h-64 w-full rounded-md"
          aria-label="SDK events"
          aria-live="polite"
          aria-atomic="false"
        >
          <div className="space-y-2 pr-1">
            {entries.map((entry) => (
              <EventEntry key={entry.id} entry={entry} />
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
