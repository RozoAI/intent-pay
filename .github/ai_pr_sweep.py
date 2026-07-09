#!/usr/bin/env python3
"""ai_pr_sweep — scheduled cloud sweep of open PRs (every-3h safety net).

Runs inside GitHub Actions on `schedule` / `workflow_dispatch`. For THIS repo it:

    list open PRs  ->  keep trusted-author, non-bot, non-draft
                   ->  skip any whose HEAD SHA == last-reviewed SHA (unchanged)
                   ->  for the rest: compute base..head diff, call ai_pr_review.py,
                      then stamp a hidden marker comment with the reviewed SHA

"Last-reviewed SHA" is tracked **statelessly** by a hidden marker comment the
sweep leaves on the PR:  <!-- ai-review-sha: <sha> -->
No server-side state, reliable across throwaway runners. Head unchanged since the
marker → skip (no duplicate comment, no wasted spend). This mirrors the local
routine's SHA-skip, but the record lives on the PR instead of a local file.

Why a separate script from ai_pr_review.py: the reviewer handles ONE known PR
(diff handed to it); the sweep discovers WHICH PRs need review. It shells out to
ai_pr_review.py per PR so the actual review logic + budget guardrails are not
duplicated.

Security: runs only on the base repo's own schedule (never a fork context), so
the Anthropic credential (ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN — either
works, see ai_pr_review.resolve_credentials) is present. This script does not
call Anthropic directly; it inherits the full environment via dict(os.environ)
and hands the credential down to ai_pr_review.py, which builds the right auth
header. Uses stdlib only (urllib) + git + the Actions GITHUB_TOKEN. No secret is
ever printed.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = os.environ["GITHUB_REPOSITORY"]
DEFAULT_BRANCH = os.environ.get("DEFAULT_BRANCH", "main")
TOKEN = os.environ.get("GITHUB_TOKEN", "")
TRUSTED = {a.strip().lower()
           for a in os.environ.get("AI_REVIEW_TRUSTED_AUTHORS", "").split(",") if a.strip()}
REVIEW_SCRIPT = Path(__file__).resolve().parent / "ai_pr_review.py"
MARKER_RE = re.compile(r"<!--\s*ai-review-sha:\s*([0-9a-f]{7,40})\s*-->", re.IGNORECASE)
DIFF_CHAR_BUDGET = 200_000


def eprint(*a: object) -> None:
    print(*a, file=sys.stderr)


def gh_api(path: str, method: str = "GET", body: dict | None = None) -> object:
    """GitHub REST via stdlib. Token only in header, never printed."""
    url = f"https://api.github.com/{path.lstrip('/')}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            "authorization": f"Bearer {TOKEN}",
            "accept": "application/vnd.github+json",
            "content-type": "application/json",
            "user-agent": "ai-pr-sweep",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode()
    return json.loads(raw) if raw else {}


def list_open_prs() -> list[dict]:
    """All open PRs (paginated). Each has number/user/head/draft."""
    out: list[dict] = []
    page = 1
    while True:
        batch = gh_api(f"repos/{REPO}/pulls?state=open&per_page=100&page={page}")
        if not isinstance(batch, list) or not batch:
            break
        out.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return out


def last_reviewed_sha(pr_number: int) -> str | None:
    """Read the newest ai-review-sha marker from the PR's comments, if any."""
    found: str | None = None
    page = 1
    while True:
        batch = gh_api(f"repos/{REPO}/issues/{pr_number}/comments?per_page=100&page={page}")
        if not isinstance(batch, list) or not batch:
            break
        for c in batch:
            m = MARKER_RE.search(c.get("body", "") or "")
            if m:
                found = m.group(1)  # later pages are newer → keep last match
        if len(batch) < 100:
            break
        page += 1
    return found


def stamp_marker(pr_number: int, sha: str) -> None:
    """Leave a hidden marker comment recording the reviewed head SHA."""
    body = (f"<!-- ai-review-sha: {sha} -->\n"
            f"<sub>ai-pr-review swept this head (`{sha[:7]}`).</sub>")
    try:
        gh_api(f"repos/{REPO}/issues/{pr_number}/comments", "POST", {"body": body})
    except urllib.error.HTTPError as e:
        eprint(f"  marker stamp failed (non-fatal): HTTP {e.code}")


def compute_diff(pr: dict, dest: Path) -> bool:
    """Fetch base + head and write base...head diff to dest. Returns True on success.

    Ref/repo values are validated + passed as `--`-separated args (no shell/arg
    injection: attacker-controlled branch/fork names can't reach a shell or a git
    option slot)."""
    base_ref = pr["base"]["ref"]
    head_ref = pr["head"]["ref"]
    head_repo = (pr["head"]["repo"] or {}).get("full_name", "")
    if not re.match(r"^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$", head_repo):
        eprint(f"  refusing suspicious head_repo: {head_repo!r}")
        return False
    for ref in (base_ref, head_ref):
        if not re.match(r"^[A-Za-z0-9._/-]+$", ref):
            eprint(f"  refusing suspicious ref: {ref!r}")
            return False
    # git workdir: the full ai-pr-review.yml checks the review script out into a
    # `trusted/` subdir; the standalone ai-pr-sweep.yml checks out to the repo
    # root (no `path:`). Adapt to whichever is present so one script fits both.
    cwd = Path("trusted") if Path("trusted").is_dir() else Path(".")
    try:
        subprocess.run(["git", "remote", "add", "pr", f"https://github.com/{head_repo}.git"],
                       cwd=cwd, capture_output=True)
        subprocess.run(["git", "remote", "set-url", "pr", f"https://github.com/{head_repo}.git"],
                       cwd=cwd, capture_output=True)
        subprocess.run(["git", "fetch", "--no-tags", "origin", "--", base_ref],
                       cwd=cwd, capture_output=True, timeout=120)
        subprocess.run(["git", "fetch", "--no-tags", "pr", "--", head_ref],
                       cwd=cwd, capture_output=True, timeout=120)
        diff = subprocess.run(["git", "diff", f"origin/{base_ref}...FETCH_HEAD"],
                              cwd=cwd, capture_output=True, text=True, timeout=120)
        if diff.returncode != 0:
            eprint(f"  git diff failed: {diff.stderr.strip()[:120]}")
            return False
        dest.write_text(diff.stdout)
        return True
    except (subprocess.SubprocessError, OSError) as e:
        eprint(f"  diff error: {type(e).__name__}")
        return False


def review_pr(pr: dict) -> None:
    num = pr["number"]
    head_sha = pr["head"]["sha"]
    diff_path = Path(f"/tmp/pr-{num}.diff")
    if not compute_diff(pr, diff_path):
        eprint(f"  #{num}: diff unavailable — skipping")
        return
    env = dict(os.environ)
    env["PR_NUMBER"] = str(num)
    env["PR_AUTHOR"] = (pr.get("user") or {}).get("login", "")
    env["EVENT_NAME"] = "schedule"          # not a comment → no /ai-review gate
    env.pop("COMMENT_BODY", None)
    r = subprocess.run(
        [sys.executable, str(REVIEW_SCRIPT), "--diff-file", str(diff_path)],
        env=env, capture_output=True, text=True, timeout=300,
    )
    for line in (r.stdout + r.stderr).strip().splitlines()[-3:]:
        print(f"    | {line}")
    if r.returncode == 0:
        stamp_marker(num, head_sha)         # record what we just reviewed
    else:
        eprint(f"  #{num}: review exited {r.returncode} — marker not stamped (will retry next sweep)")
    try:
        diff_path.unlink()
    except OSError:
        pass


def main() -> int:
    if not TRUSTED:
        print("AI_REVIEW_TRUSTED_AUTHORS is empty — nothing to sweep (set the org var).")
        return 0
    prs = list_open_prs()
    print(f"Sweep {REPO}: {len(prs)} open PR(s); trusted authors = {sorted(TRUSTED)}")
    reviewed = skipped = 0
    for pr in prs:
        num = pr["number"]
        author = (pr.get("user") or {}).get("login", "").lower()
        is_bot = (pr.get("user") or {}).get("type", "") == "Bot" \
            or author.endswith("[bot]") or author.startswith("app/")
        head_sha = pr["head"]["sha"]
        if pr.get("draft"):
            print(f"  skip #{num}: draft"); skipped += 1; continue
        if is_bot:
            print(f"  skip #{num}: bot ({author})"); skipped += 1; continue
        if author not in TRUSTED:
            print(f"  skip #{num}: author {author} not trusted"); skipped += 1; continue
        prev = last_reviewed_sha(num)
        if prev and head_sha.startswith(prev):
            print(f"  skip #{num}: head {head_sha[:7]} unchanged since last review"); skipped += 1; continue
        print(f"  review #{num}: head {head_sha[:7]} "
              f"({'new' if not prev else 'moved from ' + prev[:7]}) — '{pr.get('title','')[:50]}'")
        review_pr(pr)
        reviewed += 1
    print(f"Sweep done: reviewed {reviewed}, skipped {skipped}.")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(f"Scheduled sweep: reviewed {reviewed}, skipped {skipped} "
                    f"(of {len(prs)} open PRs).\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
