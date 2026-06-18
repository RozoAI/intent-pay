# Pre-commit Security Gate — SOP

One file does everything: **`scripts/security.sh`**. Copy that single file into
any repo to get the same protection — nothing else required.

It runs two checks on the files you're about to commit:

| Check | Catches |
|---|---|
| **Code injection** | Malicious code in build configs — the 2026-06 tailwind dead-drop loader class (`eval` / `child_process` / network calls / code after `module.exports`). Covers tailwind, metro, app.config, babel, vite, next, vercel.json, .npmrc, package.json scripts. |
| **Leaked secrets** | Credentials about to be committed: sensitive filenames (`.env`, `*.pem`, `*.key`, keystores, `.netrc`, service-account json) **and** secret shapes in content (JWT, AWS/GitHub/Stripe/Google/Slack tokens, mnemonics, EVM private keys). |

> **Secret matches never print the value** — only `file:line + rule name` — so
> secrets can't leak into CI logs, terminal scrollback, or AI transcripts.

## Use it

```bash
bash scripts/security.sh scan       # scan the whole repo (what CI runs)
bash scripts/security.sh hook       # scan only staged files (pre-commit)
bash scripts/security.sh install    # install the git pre-commit hook (once per clone)
bash scripts/security.sh help
```

`install` writes a `.git/hooks/pre-commit` that calls `security.sh hook`, so
every commit is checked locally. CI runs `security.sh scan` via
`.github/workflows/ioc-scan.yml`.

## When it fires

- **Code injection** → a build config has suspicious code. Serious — do not
  bypass without confirming it's benign. See
  `docs/incident-tailwind-malware-2026-06-18.md`.
- **Leaked secret** →
  - **Real secret**: remove it, **rotate it**, load it from env / a secret
    manager. (git history keeps it alive until rotated.)
  - **Placeholder/example**: mark it (`<value>`, `your-key-here`, `***`) or move
    it into a `*.env.example` — those are allow-listed.
  - **Reviewed & known-benign** (e.g. a public Supabase *anon* key): add a
    `# security.sh:allow` comment on that line to silence it.

## Bypass (last resort)

```bash
git commit --no-verify   # skips the local hook; use only for a confirmed false positive
```

CI still runs, so a real problem is caught there anyway.

## Copy to another repo

```bash
cp scripts/security.sh           <other-repo>/scripts/
cp .github/workflows/ioc-scan.yml <other-repo>/.github/workflows/security-scan.yml
cd <other-repo> && bash scripts/security.sh install
```

No repo-specific values are hard-coded. To tune: edit the `CONTENT_RULES` /
`CONFIG_GLOBS` / `PUBLIC_BY_DESIGN_RE` arrays near the top of `security.sh`.

## Known pre-existing findings

`packages/shared/core/src/rozo-intent/index.ts:777,867` hold hard-coded Supabase
**anon** JWTs. The anon key is public by design (protected by RLS, not secrecy),
so this is a code-tidiness issue, not a leak — but the scanner flags it. Either
add `# security.sh:allow` on those lines, or move them to env, to get a green
scan.
