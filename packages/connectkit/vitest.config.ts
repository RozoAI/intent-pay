import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Resolve the workspace package to its TypeScript source so unit tests run
// without a prior `pnpm --filter @rozoai/intent-common build` — CI's fe-gate
// `unit-command` runs vitest directly, and `@rozoai/intent-common`'s `main`
// points at `dist/` which only exists after a build.
//
// The exact-match regex only rewrites the bare package specifier, so any
// `@rozoai/intent-common/dist/...` deep import still resolves normally.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@rozoai\/intent-common$/,
        replacement: fileURLToPath(new URL("../pay-common/src/index.ts", import.meta.url)),
      },
    ],
  },
});
