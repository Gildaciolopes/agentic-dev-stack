<!-- BEGIN ALETHE ORCHESTRATION -->
## Multi-agent orchestration (alethe): how we work

This project uses the `alethe` skill (`.claude/skills/alethe`) with **passive mode on**. The main session (Opus) is the **lead**: it plans, decides, integrates and validates. Apply the rules below on your own, without waiting for a user command, and say in one line whenever you delegate.

### Who does what (profile `base`: more tokens, zero quality loss)
| Work | Who |
|---|---|
| Planning, design decisions, integration, final validation | lead (Opus) |
| Reading/sweeping lots of code, mapping, research (read-only) | agy Gemini Flash (uses Google quota). The brief must say "use only file-read tools, never shell", because agy's read-only mode blocks shell. If the unit needs shell: subagent `scout` (haiku) |
| Implementing an already planned unit | Sonnet (default). Opus when the unit is `deep` or `risky` (playbook rules decide) |
| Independent diff review (bug hunting) | agy Claude Opus (or Codex). Final validation is the lead's |
| Mechanical edit with an automatic check (rename, boilerplate, i18n, docs, test scaffolding) | opencode `9router/free` (free, via `opencode-safe`), always in an isolated worktree. If the check fails, escalate to Sonnet |
| Small task (≤ 3 files), coupled or ambiguous | the lead does it directly; delegating would cost more |

Secrets **never** leave the machine: `.env*`, keys (`*.pem`, `*.key`), credentials/service-account JSON. Never put them in `seedPaths`, never quote or copy them into a brief.
The free worker runs inside a kernel sandbox (`~/.local/bin/opencode-safe`) that blocks reading those files even if the model tries.
`risky` units (auth, payments, migrations, state machines) do not go to the free worker for **quality** reasons: Sonnet/Opus with `review-gate`.

{{WORKFLOW_SECTION}}
- Worker briefs point to files (spec/plan/tasks, this CLAUDE.md) instead of copying content. Every brief includes this file's non-negotiable rules and the check command.
- Query graphify before grep or broad reading, and tell scouts to do the same. RTK is automatic. caveman applies only to replies to the user: briefs, code and commits stay in normal prose.

### Gates (checks that accept a worker's output)
{{GATES}}

### Natural parallel units
{{UNITS}}

### Commands (the user does not need to remember them; you run them)
- Before big work and after compaction: `python3 .claude/skills/alethe/scripts/orchestrate.py status` and `... usage`.
- More than 2 parallel workers, or an expensive unit: show the `dry-run` (playbook, workers, models, estimate, quota) and wait for an ok.
- When an orchestration ends: run `report` and show its output.
- Shortcuts the user may type: `/alethe <task>` · `/alethe status` · `/alethe report html` · `/alethe usage` · `/alethe editor` · `/alethe off`.

### alethe recipe (exact commands, no guessing)
```bash
A=.claude/skills/alethe/scripts/orchestrate.py
python3 $A usage --refresh-claude --refresh-agy   # real quota before the first wave (otherwise "unknown")
python3 $A playbook --pick                         # pick the playbook
python3 $A new "<title>" --playbook <id> --why "<one line>" --lead claude:opus
python3 $A scaffold <strategy> --workers N         # prints the plan JSON; save it outside the repo
python3 $A validate <plan.json> && python3 $A dry-run <plan.json>
python3 $A run <plan.json> --in current --detach && python3 $A wait --timeout 540
python3 $A report
```
- `scaffold` takes a **strategy** (`economy|balanced|quality|research|parallel|rescue`), not a playbook name. Mapping: `plan-execute`->`economy` · `parallel-worktrees`->`parallel` · `review-gate`->`research` (reviewers) and `economy` (fix) · `cascade`->`economy`.
- A worker's `mode` only accepts `"read-only"` or `"write"`.
- `status` before the first wave answers `no runs found`. That is normal: no orchestration yet.
- Reviews: write the full diff with `git diff <base>...HEAD > .alethe/review.diff` (git-excluded) and have the reviewer read that file. Never hand-filter a diff: it causes false "missing file" findings.
- Every agy brief ends with: "Use only file-read tools, never shell. Do NOT create a plan nor ask for approval; execute directly and end with STATUS/SUMMARY."
- Native subagents (Agent tool): only `scout`, `builder` or `reviewer`, or a generic type with `model: "haiku"`/`"sonnet"`. The `agent-model-guard` hook blocks the rest (Explore/general-purpose without a model, fork, opus).
- Worktrees in the session temp folder are allowed (`trust.cwdRoots`).

### Rules
- Workers never commit or push; the lead integrates. Commit/push only when the user asks.
- If `ALETHE_ORCHESTRATE_WORKER=1`, you are a worker: do not delegate, do only the brief, end with `STATUS:` and `SUMMARY:` lines.
- `.claude/skills/alethe`, `.claude/settings.local.json` and `.alethe/` are local (git exclude) and never go into git.
- Policy and playbooks are global in `~/.config/alethe/`. To switch profile the user says "use savings", "go aggressive" or "use base".
<!-- END ALETHE ORCHESTRATION -->
