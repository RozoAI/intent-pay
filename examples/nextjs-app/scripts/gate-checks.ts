/**
 * Consistency checks that need no browser. Run by `pnpm run test:gate` inside the fe-gate workflow.
 *  - every app-router page has a spec under e2e/pages (new page => new spec, or CI fails)
 */
import { existsSync } from "node:fs";
import { uncoveredPages } from "@rozoai/fe-gate";

// ponytail: fe-gate v0.1.3 mis-maps app/page.tsx to page.tsx.spec.ts;
// keep the root-page check local until the shared helper is fixed.
const problems: string[] = [
  ...uncoveredPages("app", "e2e/pages", [/^page\.(tsx|jsx|ts|js|mdx)$/]),
  ...(existsSync("e2e/pages/index.spec.ts")
    ? []
    : ["/  (expected e2e/pages/index.spec.ts)"]),
];

if (problems.length) {
  console.error(
    "fe-gate consistency checks FAILED:\n" +
      problems.map((p) => "  - " + p).join("\n"),
  );
  process.exit(1);
}

console.log("fe-gate consistency checks ok");
