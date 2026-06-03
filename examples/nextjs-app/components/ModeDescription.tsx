import type { ReactNode } from "react";

interface Step {
  step: number;
  label: string;
}

interface ModeDescriptionProps {
  title: string;
  summary: string;
  steps: Step[];
  note?: ReactNode;
}

export function ModeDescription({ title, summary, steps, note }: ModeDescriptionProps) {
  return (
    <div className="rounded-xl border border-border bg-card/50 px-5 py-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{summary}</p>
      </div>
      <ol className="flex flex-wrap gap-x-6 gap-y-1">
        {steps.map(({ step, label }) => (
          <li key={step} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground shrink-0">
              {step}
            </span>
            {label}
          </li>
        ))}
      </ol>
      {note && (
        <p className="text-xs text-muted-foreground border-t border-border pt-2">{note}</p>
      )}
    </div>
  );
}
