import { gateConfig } from "@rozoai/fe-gate";

// Page-level gate (no funds, mock wallet). The real-funds bridge suite lives in e2e/playwright.config.ts.
export default gateConfig({
  baseURL: process.env.GATE_BASE_URL ?? "http://localhost:3000",
  webServerCommand: process.env.GATE_BASE_URL ? undefined : "pnpm dev",
  testDir: ".", // relative to this config file
  overrides: { workers: 2 }, // next dev compiles on first hit; more workers = timeouts
});
