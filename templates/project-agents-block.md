<!-- BEGIN ALETHE ORCHESTRATION -->
## Agents and orchestration (alethe)
- The lead is the Claude Code session (Opus). Other CLIs (agy, opencode, codex) usually run here as alethe **workers**.
- If `ALETHE_ORCHESTRATE_WORKER=1`, or you received a worker brief:
  - do only the unit in the brief, only in the paths it lists;
  - do not delegate or start another agent;
  - do not commit or push;
  - run the check it names;
  - end with `STATUS: DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT` and `SUMMARY:`.
- Project rules (non-negotiable sections of `CLAUDE.md` and of this file) apply to every agent.
- With `graphify-out/` present, run `graphify query "<question>" --budget 1500` before broad grep. RTK rewrites commands automatically.
- Never read or expose `.env`/secrets. Destructive or production operations only with a human ok.
<!-- END ALETHE ORCHESTRATION -->
