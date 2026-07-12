# AGENTS.md

Tooling and repo-setup reference for AI agents. For architecture, payment FSM,
multi-chain flows, and coding conventions, see [CLAUDE.md](./CLAUDE.md).

## Toolchain summary

- **Package manager**: pnpm (`packageManager` pinned to `pnpm@11.10.0`). Use `pnpm`, never npm/yarn.
- **Monorepo**: pnpm workspaces. See `pnpm-workspace.yaml`.
  - `packages/connectkit` → `@rozoai/intent-pay` (main SDK; built with Rollup)
  - `packages/pay-common` → `@rozoai/intent-common` (shared types/utils; built with `tsc`)
  - `examples/nextjs-app` → Next.js demo (built with `next build`)

## Linting — oxlint (not ESLint)

oxlint is the linter. Config is **per-package**: `oxlint.json` in each package root.
Plugins differ by package:

- `packages/pay-common/oxlint.json` — `typescript` plugin only (node env).
- `packages/connectkit/oxlint.json` — `react`, `react-hooks`, `typescript` (browser env).
- `examples/nextjs-app/oxlint.json` — `react`, `react-hooks`, `nextjs`, `typescript`.

Run:
```bash
pnpm lint                                  # all packages (root)
pnpm --filter @rozoai/intent-pay run lint # single package
```

Key rule differences to respect:
- `pay-common`: `no-explicit-any` and `no-unused-vars` are **`error`**.
- `connectkit` / `nextjs-app`: those two are **`warn`**; `react-hooks/rules-of-hooks` is **`error`**.
- Don't add an ESLint config. The repo deliberately uses oxlint + oxfmt.

## Formatting — oxfmt (oxc formatter)

Formatting uses **oxfmt**, the oxc formatter. There is **no** `.prettierrc` in the
SDK packages.

```bash
pnpm format         # runs oxfmt per package (root script)
pnpm --filter @rozoai/intent-pay run format
```

- `packages/connectkit` and `packages/pay-common` → `oxfmt src/`.
- `examples/nextjs-app` → `oxfmt src/ app/ components/ lib/` **plus** `prettier`
  (with `prettier-plugin-tailwindcss`). The example's `.prettierrc` sets
  `semi: false`, `singleQuote: false`, `printWidth: 80`, `endOfLine: lf`.

When editing the example app, run both formats. When editing SDK packages, use
oxfmt only — do not introduce Prettier there.

Check mode (CI-safe): `pnpm --filter <pkg> run format:check` (maps to `oxfmt --check`).

## Type checking

- `packages/pay-common`: `tsc` (strict) — runs as part of `pnpm build`.
- `packages/connectkit`: `tsc` is invoked inside the Rollup build (`pnpm build`).
- `examples/nextjs-app`: `pnpm typecheck` → `tsc --noEmit`.

## Build & dev

```bash
pnpm build            # build:common → build:pay → build:example
pnpm dev              # watch all three in parallel
pnpm --filter @rozoai/intent-common run dev   # tsc --watch
pnpm --filter @rozoai/intent-pay run dev      # rollup -w
```

Example app uses local packages via workspace symlinks.

## Tests

- `packages/pay-common`: `pnpm test` → `tape -r ts-node/register/transpile-only test/**/*.test.ts`.
- `examples/nextjs-app`: Playwright E2E — `pnpm test:e2e` and the many `test:e2e:*` matrix scripts
  (per route direction: evm-to-stellar, solana-to-evm, etc.). Config: `e2e/playwright.config.ts`.

## Dead code / dependency hygiene

- `knip.json` (root) drives `knip` for unused exports/deps. Entry points configured there.
- `ts-prune` and `depcheck` are devDependencies (pay-common lint runs `depcheck`).
- Run `npx knip` from root to audit.

## Git hooks & CI

- **Husky** `pre-commit` runs `pnpm lint-staged` (lints only changed files under the
  three package globs).
- **CI** (`.github/workflows/`):
  - `ai-pr-review.yml` — runs `.github/ai_pr_review.py` on PRs (comments P0/P1/P2, labels `ai-review-passed`).
  - `release.yml` — on `v*` tag: build + `pnpm publish` to npm.
  - `security-scan.yml` — runs `scripts/security.sh` (code-injection + secret-leak gate) on every push/PR.

Target branch for PRs: `master`.

## Quick reference

| Task | Command |
|------|---------|
| Lint everything | `pnpm lint` |
| Format everything | `pnpm format` |
| Typecheck example | `pnpm --filter examples/nextjs-app typecheck` |
| Build all | `pnpm build` |
| pay-common tests | `pnpm --filter @rozoai/intent-common test` |
| E2E (example) | `pnpm --filter examples/nextjs-app test:e2e` |
| Dead-code audit | `npx knip` |
