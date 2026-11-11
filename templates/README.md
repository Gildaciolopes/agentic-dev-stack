# Templates

Copy-paste starting points. Brazilian Portuguese versions live in `templates/pt-BR/` (same file names).

| File | What it is |
|---|---|
| `claude-global.md` | Block for your global `~/.claude/CLAUDE.md` (delimited by `BEGIN/END AGENTIC-DEV-STACK` markers). |
| `project/CLAUDE.md` | Starter `CLAUDE.md` for your own project: stack, commands, rules, Spec Kit workflow, token economy, delegation, definition of done. Under ~150 lines. |
| `project/AGENTS.md` | Short cross-agent mirror (Codex, OpenCode, Antigravity, Cursor) plus the alethe worker contract. |
| `project-claude-block.md` / `project-agents-block.md` | Alethe orchestration blocks appended to existing files by `add-project`. |
| `opencode-permissions.json`, `hermes-prompt-*.txt` | Auxiliary configs and prompts. |

## Usage

1. Copy the starter: `cp templates/project/CLAUDE.md templates/project/AGENTS.md <your-project>/`, then fill the `<PLACEHOLDERS>` and delete the HTML comments.
2. Or run `npx agentic-dev-stack add-project <dir> [--lang pt-BR]`. It appends the orchestration block to the project's `CLAUDE.md`/`AGENTS.md` without touching existing content.

You can combine both: copy the starter first, then run `add-project` to append the full alethe block.
