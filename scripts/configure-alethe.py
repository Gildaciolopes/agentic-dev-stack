#!/usr/bin/env python3
"""Apply the agentic-dev-stack profile to alethe (global, ~/.config/alethe/). Idempotent.

  ./scripts/configure-alethe.py [--force] [--projects-dir ~/projects]

Detects which worker CLIs exist and builds the `base` profile:
  planner/validator  = lead (Claude Opus)
  scout (cheap)      = agy Gemini Flash (file-read only)   | fallback claude haiku
  builder (standard) = Claude Sonnet; Opus when deep/risky
  bug review         = agy Claude Opus (independent)       | else codex high | else claude opus
  mechanical (cheap attempt in `cascade`) = opencode-safe 9router/free in an isolated worktree
Codex, when installed, gets native tiers and is preferred in passive mode while its quota is fresh.

Written against alethe commit ab81104 (playbooks.yaml v1). Text anchors are asserted; if the
bundled playbooks change upstream, the script stops instead of writing a broken file.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

HOME = os.path.expanduser("~")
A = f"{HOME}/.agents/skills/alethe/scripts/orchestrate.py"
CFG = f"{HOME}/.config/alethe"
PB = f"{CFG}/alethe-playbooks.yaml"
MARK = "# agentic-dev-stack profile"


def run(*args, timeout=120):
    return subprocess.run(list(args), capture_output=True, text=True, timeout=timeout, cwd=HOME)


def has(cmd):
    return shutil.which(cmd) is not None


def agy_models():
    out = run("agy", "models", timeout=60).stdout if has("agy") else ""
    ids = [l.split()[0] for l in out.splitlines() if l.strip() and not l.startswith("Fetching")]
    gem = next((re.sub(r"-(high|medium|low)$", "", i) for i in ids if "gemini" in i and "flash" in i), None)
    opus = next((i for i in ids if "opus" in i), None)
    sonnet = next((i for i in ids if "sonnet" in i), None)
    return ids, gem, opus, sonnet


def rep(s, old, new):
    assert s.count(old) == 1, f"anchor not found/unique (alethe changed upstream?): {old[:70]!r}"
    return s.replace(old, new)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="re-create the playbooks copy from the bundled file first")
    ap.add_argument("--projects-dir", default=f"{HOME}/projects")
    a = ap.parse_args()
    if not os.path.exists(A):
        sys.exit("alethe not installed (~/.agents/skills/alethe). Run ./install.sh --workers.")

    if a.force and os.path.exists(PB):
        shutil.copy(PB, PB + ".bak")
        os.remove(PB)
    if not os.path.exists(PB):
        run("python3", "-I", A, "playbook", "--init")
    s = open(PB).read()
    if MARK in s:
        print("profile already applied (use --force to rebuild).")
    else:
        agy = has("agy")
        codex = has("codex")
        oc = os.path.exists(f"{HOME}/.local/bin/opencode-safe") and has("opencode")
        ids, gem, opus, sonnet = agy_models() if agy else ([], None, None, None)
        agy = agy and bool(gem or opus)
        providers = ["claude"] + (["agy"] if agy else []) + (["codex"] if codex else []) + (["opencode"] if oc else [])
        reviewer = "agy" if agy and opus else ("codex" if codex else "claude")

        def tier(cl, ag, cx):
            lines = [f"    claude: {cl}"]
            if agy and ag:
                lines.append(f"    agy: {ag}")
            if codex:
                lines.append(f"    codex: {cx}")
            if oc:
                lines.append("    opencode: { model: 9router/free }")
            return "\n".join(lines)

        notes = [f"{MARK}: claude lead; providers {providers}; reviewer {reviewer}."]
        if agy:
            notes.append("agy Claude models reject --effort; Gemini uses the base id plus --effort.")
            notes.append("agy read-only workers cannot run shell; use claude for read-only units that need commands.")
        if oc:
            notes.append("opencode adapter = ~/.local/bin/opencode-safe (sandbox-exec + --standalone); writer-only, isolated.")
        header = "setup:\n  notes:\n" + "".join(f"    - {json.dumps(n)}\n" for n in notes)
        header += f"\nproviders: [{', '.join(providers)}]\n\nmodels:\n  claude: [opus, sonnet, haiku]\n"
        if agy:
            header += f"  agy: [{', '.join(([gem] if gem else []) + ids)}]\n"
        if oc:
            header += "  opencode: [9router/free]\n\nadapters:\n  opencode:\n    command: " + f"{HOME}/.local/bin/opencode-safe" + \
                      "\n    args: [run]\n    promptTransport: argument\n    outputFormat: text\n    modelFlag: \"-m\"\n" + \
                      "    checked: \"agentic-dev-stack configure-alethe.py\"\n\nroutes:\n  router9:\n    port: 20128\n    running: true\n    carries: [opencode]\n"
        gem_t = f"{{ model: {gem}, effort: high }}" if gem else None
        header += "\ntiers:\n  cheap:\n" + tier("{ model: haiku, effort: low }", gem_t, "{ effort: low }")
        header += "\n  standard:\n" + tier("{ model: sonnet, effort: medium }", f"{{ model: {sonnet} }}" if sonnet else None, "{ effort: medium }")
        header += "\n  strong:\n" + tier("{ model: opus, effort: high }", f"{{ model: {opus} }}" if opus else None, "{ effort: high }") + "\n"

        old_head = s[s.index("providers: [claude, codex]"):s.index("\nquota:")]
        s = s.replace(old_head, header.rstrip("\n") + "\n")
        prefer = [p for p in ("codex", "agy", "claude") if p in providers]
        s = rep(s, "  prefer: [codex, claude]", f"  prefer: [{', '.join(prefer)}]")
        s = rep(s, "  - A risky unit never runs on the cheap tier, and its diff goes through review-gate.\n",
                "  - A risky unit never runs on the cheap tier, and its diff goes through review-gate.\n"
                '  - "agy briefs: use only file-read tools, never shell; do NOT create a plan nor ask for approval; execute and end with STATUS/SUMMARY."\n'
                '  - "Read-only reviewers get the FULL diff as a file in the repo: git diff > .alethe/review.diff (git-excluded), never a hand-filtered diff."\n'
                '  - "Before the first wave run usage --refresh-claude --refresh-agy so quota is known."\n'
                '  - "Secrets (.env*, keys, credentials JSON) never go into briefs, plans or seedPaths."\n')
        s = rep(s, "          - if: light\n            use: { tier: cheap }\n      - id: review\n        role: reviewer\n        tier: standard\n        provider: codex",
                f"          - if: light\n            use: {{ tier: standard, effort: low }}\n      - id: review\n        role: reviewer\n        tier: strong\n        provider: {reviewer}")
        esc = "use: { provider: agy" + (f", model: {opus} }}" if opus else " }") if agy else ("use: { provider: codex, effort: xhigh }" if codex else "use: { provider: claude, model: opus, effort: xhigh }")
        s = s.replace("use: { provider: codex, effort: xhigh }", esc)
        s = rep(s, "      - id: bugs\n        role: bug-hunter\n        tier: strong\n        readOnly: true",
                f"      - id: bugs\n        role: bug-hunter\n        tier: strong\n        provider: {reviewer}\n        readOnly: true")
        if oc:
            s = rep(s, "      - id: try-cheap\n        role: attempt\n        tier: cheap\n        readOnly: false\n        runner: economy\n        does: Make the change and run the check.",
                    "      - id: try-cheap\n        role: attempt\n        tier: cheap\n        provider: opencode\n        isolate: true\n        readOnly: false\n        runner: economy\n"
                    "        does: Make the change and run the check. Mechanical units only.\n        rules:\n          - if: risky\n            use: { provider: claude, tier: standard }")
        # profiles: replace codex-only entries with what exists
        repl = {"codex: { effort: low }": "codex: { effort: low }", "codex: { effort: medium }": "codex: { effort: medium }", "codex: { effort: high }": "codex: { effort: high }"}
        if not codex:
            s = re.sub(r"\n\s+codex: \{ effort: [a-z]+ \}", "", s)
        _ = repl
        s = rep(s, "    summary: Each tier on its usual model.", "    summary: Opus plans/validates, Sonnet builds, cheap scouts, independent reviewer, free worker for mechanical edits.")
        open(PB, "w").write(s)
        print(f"profile applied: providers={providers} reviewer={reviewer}")

    prices = f"{CFG}/alethe-prices.json"
    if not os.path.exists(prices):
        billing = {p: "subscription" for p in ("claude", "agy", "codex", "opencode")}
        json.dump({"version": 1, "currency": "USD", "unit": "per 1M tokens", "billing": billing, "models": {}}, open(prices, "w"), indent=2)
    order = [p for p in ("claude", "agy", "codex") if has(p)]
    run("python3", "-I", A, "policy", "set", "--backend", "skill", "--provider-order", *order, "--provider-switch", "automatic")
    pol = f"{CFG}/orchestrate.json"
    d = json.load(open(pol))
    roots = set(d.setdefault("trust", {}).get("cwdRoots", []))
    roots |= {os.path.realpath("/tmp"), os.path.abspath(os.path.expanduser(a.projects_dir))}
    d["trust"]["cwdRoots"] = sorted(roots)
    json.dump(d, open(pol, "w"), indent=2)
    doc = json.loads(run("python3", "-I", A, "doctor").stdout or "{}")
    print("doctor: playbooks valid =", doc.get("playbooks", {}).get("valid"), "| policy configured =", doc.get("policy", {}).get("configured"))


if __name__ == "__main__":
    main()
