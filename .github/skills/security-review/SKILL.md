---
name: security-review
description: >
  Security review rules for any RozoAI pull request. Use when reviewing a PR,
  before merging, or auditing a diff — especially for changes that touch build
  configs, dependencies, .env files, CI, or payment/treasury code. Encodes the
  lessons from the 2026-06 supply-chain incidents (tailwind dead-drop loader +
  the atob/eval C2 loader). Iterate these rules here in rozo-security; repos
  copy what they need.
---

# Security Review — RozoAI

Run `security.sh scan` first (it's mechanical). Then a human/agent applies the
judgment rules below. The scanner catches known shapes; review catches intent.

## 1. Build configs are executable code — review them like code

Any file that runs at build/dev/CI time can exfiltrate the build env. Treat
these as high-scrutiny on every diff:

`*tailwind.config.*` · `metro.config.*` · `app.config.*` · `babel.config.*` ·
`next.config.*` · `vite.config.*` · `postcss.config.*` · `react-router.config.*` ·
`vercel.json` · `.npmrc` · `package.json` (scripts) · any `*.config.{js,ts,mjs,cjs}`

**Red flags in these files (block the PR):**
- `eval(...)`, `new Function(...)`, `child_process` / `spawn` / `exec`
- `atob(...)` / `Buffer.from(x,'base64')` followed by execution or a network call
- `fetch` / `node-fetch` / `import(...)` to any non-obvious domain
- **Code that runs at module load** — an IIFE `(async () => {...})()`, or any
  statement *before* or *after* the legitimate `export default` / `module.exports`.
  A clean config only *exports* an object; it doesn't *do* anything.
- A config that suddenly `import 'dotenv/config'` to read an env var it never needed.

## 2. Both incidents hid the same way — know the patterns

| Campaign | Where | Tell |
|---|---|---|
| tailwind dead-drop | `tailwind.config.js` tail | code AFTER `module.exports`; beacon `9-0037-2`; reads Tron/BSC chains for stage-2 |
| atob/eval C2 | `react-router.config.ts` / `database.types.ts` head | IIFE BEFORE `export default`; `atob(process.env.X)` → `node-fetch` → `eval`; C2 URL base64'd in a tracked `.env` |

Both: authored by a **compromised developer account**, **back-dated commits** to
look old, and **woven into an existing commit** (no obvious "new suspicious
commit" on top). So: **don't trust commit dates**, and **diff the actual file
content** against a known-clean baseline — not just "what changed recently."

## 3. .env / secrets

- A **tracked `.env`** is a red flag by itself — it should be gitignored. In the
  2026-06 incident a tracked `.env` was the *carrier* for the C2 URL (base64).
- Never approve a hard-coded private key, mnemonic, or `service_role` key.
  A public Supabase **anon** key or a Firebase client key is OK (RLS/public by
  design) but should be annotated `// security.sh:allow`.
- Secret values must never be pasted into the PR description, review comments,
  or CI logs.

## 4. Dependencies & supply chain

- New dependency? Check it's the real package (typosquat?), pinned, and that its
  `postinstall`/`prepare` scripts don't fetch+run remote code.
- A lockfile change with no corresponding `package.json` change is suspicious.

## 5. Permissions & merge hygiene (the structural lesson)

The 2026-06 malware survived ~6 months because an **admin self-merged without
review**, bypassing branch protection. So:
- PRs to `main` need a **different** person's approval. Authors don't self-approve.
- Keep the "require PR + approval" ruleset; don't put broad admin bypass on it.
- Payment/treasury/migration changes are **high risk**: require owner approval +
  an independent review pass before merge.

## 6. The review checklist (paste into the PR)

```
[ ] security.sh scan passes (or every finding is justified)
[ ] no executable code in build configs (no eval/spawn/atob/fetch/IIFE; only exports)
[ ] no code before/after the config's export statement
[ ] no tracked .env; no hard-coded private key / mnemonic / service_role
[ ] new deps are real, pinned, no remote-fetching install scripts
[ ] diff reviewed against content, not trusting commit dates
[ ] not self-approved; high-risk (money/migration) has owner sign-off
```
