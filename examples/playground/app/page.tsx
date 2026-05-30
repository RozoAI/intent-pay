import { ScenarioTabs } from "@/components/ScenarioTabs";
import { Separator } from "@/components/ui/separator";
import pkg from "../package.json";

export default function PlaygroundPage() {
  const payVersion = pkg.dependencies["@rozoai/intent-pay"];
  const commonVersion = pkg.dependencies["@rozoai/intent-common"];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
          <h1 className="text-sm font-semibold text-foreground">
            Rozo Pay Playground
          </h1>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-mono">
              intent-pay{" "}
              <span className="text-foreground/60">{payVersion}</span>
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground font-mono">
              intent-common{" "}
              <span className="text-foreground/60">{commonVersion}</span>
            </span>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <ScenarioTabs />
      </main>
    </div>
  );
}
