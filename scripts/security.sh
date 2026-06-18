#!/usr/bin/env bash
# =============================================================================
# security.sh — one-file pre-commit security gate. Copy this single file into
# any repo to get the same protection. No other files required.
#
#   Gate 1  code injection  — malicious code in build configs (the 2026-06
#                             tailwind dead-drop loader: eval / child_process /
#                             network / code after module.exports). Covers
#                             tailwind, metro, app.config, babel, vite, next,
#                             vercel.json, .npmrc, package.json scripts.
#   Gate 2  leaked secrets  — credentials about to be committed: sensitive
#                             filenames (.env, *.pem, *.key, keystores, netrc,
#                             service-account json) AND secret shapes in content
#                             (JWT, AWS/GitHub/Stripe/Google/Slack tokens,
#                             mnemonics, EVM private keys).
#
# The secret gate NEVER prints a matched value — only "<file>:<line> rule" — so
# secrets can't leak into CI logs / scrollback / AI transcripts.
#
# USAGE
#   bash scripts/security.sh scan          # scan whole repo (CI / manual)
#   bash scripts/security.sh hook          # scan staged files (pre-commit)
#   bash scripts/security.sh install       # install the git pre-commit hook
#   bash scripts/security.sh scan --files a b c
#   bash scripts/security.sh help
#
# Exit 0 = clean, 1 = findings, 2 = usage error.
# =============================================================================
# Source of truth: github.com/RozoAI/rozo-security  —  iterate the rules there.
# Repos may run older copies; that's fine. Bump this when you change the rules.
SECURITY_SH_VERSION="1.0.1"
# =============================================================================
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT" || exit 2
SELF="scripts/security.sh"

# ----------------------------------------------------------------------------
# Shared config
# ----------------------------------------------------------------------------
IOC_STRINGS=(
  "global['!']='9-0037-2'" "9-0037-2"
  "TMfKQEd7TJJa5xNZJZ2Lep838vrzrs7mAP" "TXfxHUet9pJVU1BgVkBAbrES4YUc1nGzcG"
  "2[gWfGj;<:-93Z^C" "m6:tTh^D)cBz?NM]"
)
CONFIG_GLOBS=(
  '*tailwind.config.js' '*tailwind.config.ts' '*metro.config.js' '*metro.config.ts'
  '*app.config.js' '*app.config.ts' '*babel.config.js' '*babel.config.ts'
  '*next.config.js' '*next.config.mjs' '*next.config.ts'
  '*vite.config.js' '*vite.config.ts' '*vite.config.mjs' '*vercel.json' '*.npmrc'
)
DANGER_RE='child_process|require\(["'\'']child_process|\bspawn\(|\bexec(Sync|File)?\(|\beval\(|new[[:space:]]+Function|process\.binding|\bnode[[:space:]]+-e\b|atob\(|Buffer\.from\([^,]*,[[:space:]]*["'\'']base64|fetch\(["'\'']https?://(api\.trongrid|bsc-|fullnode\.mainnet\.aptos)'

SENSITIVE_NAME_RE='(^|/)\.env($|\.[^/]*$)|\.pem$|\.p12$|\.pfx$|\.jks$|\.keystore$|(^|/)id_rsa($|\.)|(^|/)id_ed25519($|\.)|\.mobileprovision$|(^|/)serviceaccount[^/]*\.json$|(^|/)[^/]*credentials[^/]*\.json$|(^|/)\.netrc$'
ALLOW_NAME_RE='\.env\.(example|sample|template|dist)$|\.example$|\.sample$|\.template$'
NPMRC_AUTH_RE='_authToken=|_password=|_auth=|//.*:_authToken'
PUBLIC_BY_DESIGN_RE='google-services\.json$|GoogleService-Info\.plist$|firebase[^/]*\.json$'
PLACEHOLDER_RE='<[^>]*>|YOUR[_-]|EXAMPLE|PLACEHOLDER|CHANGE[_-]?ME|xxxx|XXXX|\*\*\*|\.\.\.|dummy|sample|REPLACE'
# type/schema declarations are not secrets even though they mention KEY/SECRET
# (e.g. `SESSION_SECRET: z.string().min(32)`, `apiKey: string`, interface fields).
# Also: reading a secret FROM env is safe — `const X_PRIVATE_KEY = firstEnv(...)`,
# `process.env.X`, `Deno.env.get(...)`, `os.environ[...]` — the string there is a
# VARIABLE NAME, not a value. And shell `export X=$VAR` / `${VAR}` references.
SCHEMA_DECL_RE='z\.(string|enum|number|object|boolean|optional|coerce)|:[[:space:]]*(string|number|boolean)\b|\.string\(\)|Schema|interface |type [A-Z]|process\.env|import\.meta\.env|Deno\.env|os\.environ|getenv|firstEnv|requireEnv|\benv\(|=[[:space:]]*"?\$\{?[A-Za-z_]'
CONTENT_RULES=(
  "private_key_assignment::(PRIVATE_KEY|SECRET_KEY|SECRET|MNEMONIC|SEED_PHRASE|SEED)[\"'\` ]*[:=][\"'\` ]*[^[:space:]\"'\`]{8,}"
  "jwt_token::eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}"
  "aws_access_key::AKIA[0-9A-Z]{16}"
  "github_token::gh[posru]_[A-Za-z0-9]{30,}"
  "stripe_live_key::sk_live_[0-9a-zA-Z]{20,}"
  "rozo_live_key::rz_(live|test)_[0-9a-zA-Z]{16,}"
  "google_api_key::AIza[0-9A-Za-z_-]{30,}"
  "slack_token::xox[baprs]-[0-9A-Za-z-]{10,}"
  "openai_key::sk-[A-Za-z0-9]{20,}"
)
EVM_PK_RE='(^|[^0-9a-fA-Fx])0x[a-fA-F0-9]{64}([^0-9a-fA-F]|$)'
EVM_PK_CONTEXT_RE='priv(ate)?[_-]?key|privkey|signerkey|wallet[_-]?key|secret[_-]?key|deployer[_-]?key|PRIVATE_KEY'
EVM_PK_EXCLUDE_RE='hash|txid|signature|\bsig\b|proof|merkle|root|digest|commitment|blockhash'
# inline allow-list marker: put `security.sh:allow` in a comment on a line you
# have reviewed and confirmed benign (e.g. a public anon key) to silence it.
ALLOW_MARKER='security\.sh:allow'

findings=0
hit() { findings=$((findings+1)); printf '  ✖ %s\n' "$*"; }

is_config_file() { local f="$1" g; for g in "${CONFIG_GLOBS[@]}"; do [[ "$f" == $g ]] && return 0; done; return 1; }

check_post_export_code() {  # IOC structural: executable code after terminating export
  awk '
    /^[[:space:]]*module\.exports[[:space:]]*=/ { le=NR } /^[[:space:]]*export[[:space:]]+default/ { le=NR }
    { L[NR]=$0 } END {
      if (le==0) exit 0; d=0
      for (i=le;i<=NR;i++){ l=L[i]; o=gsub(/[\(\{\[]/,"&",l); c=gsub(/[\)\}\]]/,"&",l)
        if (i>le && d<=0){ s=L[i]; gsub(/^[[:space:]]+|[[:space:]]+$/,"",s)
          if(s!="" && s!~/^\/\// && s!~/^\*/ && s!~/^\/\*/ && s!~/^[\)\}\];,]+;?$/)
            if(s~/(^|[^A-Za-z])(function|var|let|const|require|eval|global|_0x|!function|\(function|void 0|process\.|child_process|spawn|atob)/){print i": "substr(L[i],1,80); bad=1}}
        d+=o-c } if(bad) exit 7 }' "$1"
}

# ----------------------------------------------------------------------------
# Scanners (operate on a newline-separated file list passed on stdin)
# ----------------------------------------------------------------------------
scan_files() {  # reads file list on stdin
  local checked=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue; [ -f "$f" ] || continue
    [ "$(basename "$f")" = "security.sh" ] && continue
    # the security-review skill legitimately quotes IOC strings as samples;
    # SECURITY.md documents the gate. Don't flag our own docs.
    checked=$((checked+1))

    # ---- Gate 1: code injection ----
    # Markdown is documentation, not executable code — security docs legitimately
    # quote IOC strings as samples. Skip IOC matching for .md (secret checks below
    # still run on .md, since docs can accidentally contain a real token).
    case "$f" in
      *.md) : ;;
      *) for ioc in "${IOC_STRINGS[@]}"; do
           grep -qF -- "$ioc" "$f" 2>/dev/null && hit "$f — code injection IOC: $ioc"
         done ;;
    esac
    if is_config_file "$f"; then
      local d; d=$(grep -nE "$DANGER_RE" "$f" 2>/dev/null | head -3)
      [ -n "$d" ] && hit "$f — dangerous primitive in build config: $(echo "$d" | tr '\n' ';')"
      if [[ "$f" == *.js || "$f" == *.ts || "$f" == *.mjs ]]; then
        local p; if ! p=$(check_post_export_code "$f"); then
          hit "$f — executable code after module.exports/export default: $(echo "$p" | tr '\n' ';')"
        fi
      fi
    fi
    if [ "$(basename "$f")" = "package.json" ]; then
      local s; s=$(grep -nE '"(pre|post)?(install|prepare)"[[:space:]]*:' "$f" 2>/dev/null | grep -E 'curl|wget|node[[:space:]]+-e|child_process|\beval\b|base64 -d|\| *sh' | head -3)
      [ -n "$s" ] && hit "$f — suspicious package.json lifecycle script: $(echo "$s" | tr '\n' ';')"
    fi

    # ---- Gate 2: leaked secrets ----
    if echo "$f" | grep -qE "$ALLOW_NAME_RE"; then :
    elif echo "$f" | grep -qiE "$SENSITIVE_NAME_RE"; then
      hit "$f — sensitive filename (don't commit; .gitignore it or use a secret manager)"
    fi
    [ "$(basename "$f")" = ".npmrc" ] && while IFS= read -r ln; do
      [ -n "$ln" ] && hit "$f:${ln%%:*} — npmrc auth token/password"
    done < <(grep -nE "$NPMRC_AUTH_RE" "$f" 2>/dev/null)

    echo "$f" | grep -qE "$PUBLIC_BY_DESIGN_RE" && continue
    if file "$f" 2>/dev/null | grep -qiE 'text|json|xml|empty|ASCII|Unicode'; then
      local rule name re ln lineno linetext
      for rule in "${CONTENT_RULES[@]}"; do
        name="${rule%%::*}"; re="${rule#*::}"
        while IFS= read -r ln; do
          [ -z "$ln" ] && continue; lineno="${ln%%:*}"; linetext="${ln#*:}"
          echo "$linetext" | grep -qiE "$PLACEHOLDER_RE" && continue
          echo "$linetext" | grep -qE "$ALLOW_MARKER" && continue
          echo "$linetext" | grep -qE "$SCHEMA_DECL_RE" && continue   # type/schema decl, not a value
          hit "$f:$lineno — secret shape: $name"
        done < <(grep -nE "$re" "$f" 2>/dev/null)
      done
      while IFS= read -r ln; do
        [ -z "$ln" ] && continue; lineno="${ln%%:*}"; linetext="${ln#*:}"
        echo "$linetext" | grep -qiE "$PLACEHOLDER_RE" && continue
        echo "$linetext" | grep -qE "$ALLOW_MARKER" && continue
        if echo "$linetext" | grep -qiE "$EVM_PK_CONTEXT_RE" && ! echo "$linetext" | grep -qiE "$EVM_PK_EXCLUDE_RE"; then
          hit "$f:$lineno — secret shape: evm_private_key"
        fi
      done < <(grep -nE "$EVM_PK_RE" "$f" 2>/dev/null)
    fi
  done
  echo "  ($checked file(s) checked)"
}

# ----------------------------------------------------------------------------
# Commands
# ----------------------------------------------------------------------------
cmd_scan() {
  local list
  case "${1:-}" in
    --files) shift; list="$(printf '%s\n' "$@")" ;;
    --staged) list="$(git diff --cached --name-only --diff-filter=ACM)" ;;
    *) list="$(git ls-files)" ;;
  esac
  echo "=== security.sh scan ==="
  # NOTE: use process substitution, NOT a pipe. `... | scan_files` runs
  # scan_files in a subshell, so its `findings++` is lost and the exit code is
  # always 0 — silently disabling the gate. `< <(...)` keeps it in this shell.
  scan_files < <(echo "$list" | sort -u)
  if [ "$findings" -gt 0 ]; then
    echo "RESULT: 🔴 $findings finding(s). (secret values are not shown — inspect file:line.)"
    return 1
  fi
  echo "RESULT: ✅ clean"; return 0
}

cmd_hook() {  # pre-commit: scan only staged
  cmd_scan --staged && return 0
  echo ""
  echo "🚫 commit blocked by scripts/security.sh (see above)."
  echo "   real issue → fix it (rotate any real secret). false positive → add a"
  echo "   '# security.sh:allow' comment on that line, or 'git commit --no-verify'."
  return 1
}

cmd_install() {
  local hook="$REPO_ROOT/.git/hooks/pre-commit"
  cat > "$hook" <<EOF
#!/usr/bin/env bash
exec bash "\$(git rev-parse --show-toplevel)/scripts/security.sh" hook
EOF
  chmod +x "$hook"
  echo "✅ installed pre-commit hook -> $hook"
  echo "   it runs: bash $SELF hook"
}

cmd_help() {
  sed -n '2,40p' "$REPO_ROOT/$SELF" | sed 's/^# \{0,1\}//'
}

case "${1:-help}" in
  scan)    shift; cmd_scan "$@" ;;
  hook)    cmd_hook ;;
  install) cmd_install ;;
  version|--version|-v) echo "security.sh v$SECURITY_SH_VERSION (source: github.com/RozoAI/rozo-security)" ;;
  help|-h|--help) cmd_help ;;
  *) echo "unknown command: $1" >&2; echo "try: bash $SELF help" >&2; exit 2 ;;
esac
