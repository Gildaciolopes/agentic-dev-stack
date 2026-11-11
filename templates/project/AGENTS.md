<!-- Starter AGENTS.md for Codex, OpenCode, Antigravity, Cursor and other agents. Fill placeholders, delete these comments. -->
# <PROJECT NAME>: agent instructions

Full rules live in `CLAUDE.md`. This file is the short cross-agent mirror.

## Project
<One-line description>. Stack: <...>. Layout: <src/..., tests/...>.

## Commands
```bash
<test command>
<lint command>
<typecheck command>
<build command>
```

## Rules (all agents)
- Never read, print or commit secrets (`.env*`, keys, credentials JSON). Destructive or production operations only with a human ok.
- <project-specific non-negotiable rule>
- Never commit or push unless the user asks.
- Conventional commits (`feat:`, `fix:`, `docs:` ...).
- Do not say "done" before running the checks above and showing the evidence.
- With `graphify-out/` present, run `graphify query "<question>" --budget 1500` before broad grep.
- Shell output may be compressed by RTK; use `rtk proxy <cmd>` for raw output.
- Terse style applies to replies to the user only; code, commits and briefs stay in normal prose.
- Features follow Spec Kit order: specify, clarify, plan, tasks, analyze, implement. Decisions stay with the lead.

## Worker contract (alethe)
If `ALETHE_ORCHESTRATE_WORKER=1`, or you received a worker brief:
- do only the unit in the brief, only in the paths it lists;
- do not delegate or start another agent;
- do not commit or push;
- run the check the brief names;
- end with `STATUS: DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT` and `SUMMARY:`.
