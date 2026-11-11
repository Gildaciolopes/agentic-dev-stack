# 09. Maintenance and Updates

## What maintains itself

| Item | How |
|---|---|
| Free-model combo | curator, 3 times a day |
| Quota (alethe reads) | the daily collector runs `usage --refresh-*` |
| Update notices for everything | "Updates" section of the daily digest (it never updates anything on its own) |
| Notices about relevant releases | "AI radar" section |
| Services (9Router, Hermes) | launchd (macOS) / systemd `--user` (Linux) / Task Scheduler (Windows), restarting after a crash |

Schedules: launchd on macOS, crontab on Linux, Task Scheduler on Windows. Logs live in `~/.local/share/agentic-dev-stack/logs/`.

## What is manual (on purpose)

| Item | Command | Watch out |
|---|---|---|
| Homebrew CLIs (macOS; on Linux/Windows use your package manager, `npm` or `winget`) | `brew upgrade opencode rtk claude-squad tmux yt-dlp uv` and `brew upgrade --cask antigravity-cli` | RTK may jump a major version: test the hook (`echo '{"tool_name":"Bash","tool_input":{"command":"git status"}}' \| rtk hook claude`) |
| Claude Code | `claude update` (or your package manager) | |
| 9Router | `npm update -g 9router`, then restart | the curator keeps working; check the combo |
| Headroom | `uv tool upgrade headroom-ai` | |
| Hermes | `hermes update` | read the changelog: gateway changes may require `hermes gateway install` again |
| alethe | audit → change `ALETHE_COMMIT` in `~/.config/agentic-dev-stack/stack.env` → `npx github:Gildaciolopes/agentic-dev-stack install --workers` | see [03-alethe.md](03-alethe.md) |
| The stack itself | re-run `npx github:Gildaciolopes/agentic-dev-stack install --all` | idempotent; config edits are backed up first |

## Move to another PC

On any OS, with Node 18+ and Claude Code installed:
```bash
npx github:Gildaciolopes/agentic-dev-stack install --all
# the config is created at ~/.config/agentic-dev-stack/stack.env: copy the old one over first if you want
for p in ~/projects/*/; do npx github:Gildaciolopes/agentic-dev-stack add-project "$p"; done
npx github:Gildaciolopes/agentic-dev-stack doctor
```
(`./install.sh --all` or `.\install.ps1 --all` from a clone also work. On Windows PowerShell, loop with `Get-ChildItem ~/projects -Directory | % { npx github:Gildaciolopes/agentic-dev-stack add-project $_.FullName }`.)

Then redo the logins (agy, Codex), the NVIDIA key and the 9Router combo, and the bot token (or reuse the same one). Copy `~/.hermes/workspace/projects.md` and `~/.hermes/memories/` if you want to keep Hermes's memory.

## Hand the stack over to someone else

They run `npx github:Gildaciolopes/agentic-dev-stack install --all` and follow [02-installation.md](02-installation.md). Nothing in it is personal: paths come from `$HOME`, projects are discovered in `PROJECTS_DIR`, and IDs and tokens are asked for during installation.

## Measure whether it is paying off

After 1 to 2 weeks of use:
```bash
rtk gain --daily                                                   # RTK savings
python3 -I ~/.agents/skills/alethe/scripts/orchestrate.py report   # last orchestration
```
Also look at 9Router's **Usage** page (what went to the free tier) and the quotas in the daily digest.
- Hitting the Claude limit often: use the `savings` profile, or push more work to agy/Codex.
- Quota to spare: use `aggressive` for higher quality.
- Lots of rework from the free worker: remove `cascade` from it (edit `try-cheap`).

Related: [05-free-models.md](05-free-models.md), [06-hermes.md](06-hermes.md), [07-security.md](07-security.md), [08-troubleshooting.md](08-troubleshooting.md).
