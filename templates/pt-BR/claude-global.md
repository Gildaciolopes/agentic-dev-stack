<!-- BEGIN AGENTIC-DEV-STACK -->
# Orchestration: plan big, execute small
- Lead (main session) plans and integrates; delegate heavy reading to `scout` (haiku), implementation of planned tasks to `builder` (sonnet), diff checks to `reviewer` (sonnet).
- Independent tasks → launch builders in parallel with `isolation: "worktree"`.
- Small task (a few tool calls, ≤ 3 files) → do it directly; delegation costs more than it saves.
- Enforced: hook `~/.claude/hooks/agent-model-guard.py` denies Agent calls that would run on Opus (Explore/general-purpose/Plan without `model: haiku|sonnet`, fork, explicit opus). Default subagent model = sonnet (`CLAUDE_CODE_SUBAGENT_MODEL`). Deliberate exception: start claude with `ALLOW_OPUS_SUBAGENT=1`.
- Projects with `.claude/skills/alethe` → follow that project's "Orquestração multi-agente (alethe)" section. alethe (passive mode) routes workers: agy Gemini scouts (brief: file-read only, no shell, no plan/approval), Sonnet/Opus build, agy Opus reviews (independent provider), opencode `9router/free` via sandboxed `~/.local/bin/opencode-safe` for mechanical edits in isolated worktrees.
- Secrets (`.env*`, keys, credentials JSON) never go into briefs, plans or `seedPaths`.
- Config: `~/.config/alethe/`; canonical skill: `~/.agents/skills/alethe` (audited commit in `.audited-commit`).
<!-- END AGENTIC-DEV-STACK -->
