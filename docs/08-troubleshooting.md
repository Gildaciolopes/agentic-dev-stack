# 08. Troubleshooting: Everything That Broke and How to Fix It

Every item below actually happened while building the stack. Run `npx agentic-dev-stack doctor` first: it checks the hook, subagents, alethe, workers, 9Router and Hermes in one pass.

## Agents and orchestration

**Claude ignored alethe and launched 26 subagents, 18 of them on Opus.**
A rule in CLAUDE.md is not enforcement: generic agent types inherit the session model. → `agent-model-guard` denies them and `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` becomes the default. Test: ask for an Explore subagent; it should be denied.

**`CLAUDE_CODE_SUBAGENT_MODEL` did not affect Explore.**
The built-in Explore/Plan agents only honor that env var with `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`, which in turn ignores your own agents' frontmatter. → Keep it without `_FORCE` and let the hook do the job.

**alethe: `no runs found`, quota `unknown`, invalid `mode`, scaffold rejecting a playbook, `cwd outside the lead checkout`, agy asking for approval.**
All explained in the gotchas table in [03-alethe.md](03-alethe.md).

**An agy worker ends with `permission_denied: RunCommand`.**
agy's read mode cannot run shell, and the model tried `ls`/`cat`. → The brief must say "use only file-read tools, never shell".

**agy: `--model gemini-x-flash-high conflicts with --effort=medium`.**
The runner inherits the tier's effort. Gemini uses the base id (`gemini-x-flash`) plus `--effort`; Claude models in agy **do not accept** `--effort`. → `npx agentic-dev-stack configure-alethe` already writes the right tiers (add `--force` to rebuild).

## Free models / 9Router

**`410 Gone: model has reached its end of life`, and the fallback did not move to the next model.**
9Router only falls back on rate limits and server errors. → The curator removes dead models 3 times a day.

**`404 Function ... Not found for account`.**
The model appears in `/v1/models`, but your account has no access. → The curator probes for real instead of trusting the list.

**OpenCode Free: `Cannot find module 'wreq-js'`.**
9Router started before its runtime dependency was installed (npm blocked the `postinstall`) and cached the failure. → Restart 9Router.

**The 9Router UI will not let you add a model by ID.**
→ The curator writes directly to the `combos` table (with a backup). By hand:
```bash
sqlite3 ~/.9router/db/data.sqlite "UPDATE combos SET models='[\"nvidia/<id1>\",\"nvidia/<id2>\"]' WHERE name='free';"
```

**9Router autostart does not come up (launchd `last exit code = 78: EX_CONFIG`).**
The plist points to a Node that no longer exists (different version or path). → `npx agentic-dev-stack install --free-models` rewrites it with the current `node`. Be careful when editing by hand: `plutil -replace ProgramArguments.0` **inserts** instead of replacing; rewrite the whole array. On Linux the equivalent is the `agentic-dev-stack-9router.service` unit (`systemctl --user status agentic-dev-stack-9router`); on Windows it is the `agentic-dev-stack-9router` task.

## Sandbox / OpenCode

**Even with `opencode-safe`, a `grep -r` read the `.env`.**
`--standalone` was missing: `opencode run` hands tool execution to the background service `opencode serve --service`, which runs outside the sandbox. → The wrappers in this repo already pass `--standalone`.

**`external_directory: deny` did not block an absolute path in the shell.**
It applies to file tools, not bash commands. → The kernel holds the line (`sandbox-exec` on macOS, `bubblewrap` on Linux). See [07-security.md](07-security.md).

**Linux: "opencode-safe: bubblewrap (bwrap) not installed" or the free worker is missing.**
→ Install `bubblewrap` (for example `sudo apt install bubblewrap`) and re-run `install --workers`.

## Hermes

**Gemini CLI: "This client is no longer supported for Gemini Code Assist for individuals".**
Personal-account login was discontinued. → Use agy, or an AI Studio key.

**The gateway is running, but "service is not active" and "No messaging platforms enabled".**
A one-off `hermes -z` started a stray gateway **before** the token existed; it holds the slot and the service manager cannot start the real one. → `hermes gateway restart`.

**Discord: "Hermes could not create a Discord thread... Too many requests".**
It creates one thread per message and hits the rate limit. → `hermes config set discord.auto_thread false` and restart. Run `/sethome` **again, outside a thread** (otherwise the home channel becomes the thread).

**macOS asking for Music, Photos or iCloud permission.**
It comes from the bundled Apple skills and broad searches. → Click **Don't Allow** (the answer is remembered) and disable the skills you do not use. Avoid granting Full Disk Access (see [06-hermes.md](06-hermes.md)).

**The plan of the day suggests a paused project, or reads priorities wrong.**
→ Create `~/.hermes/workspace/projects.md` with each project's status; the digest prompt reads it.

**The summaries come in the wrong language.**
→ Set `SUMMARY_LANGUAGE` in `~/.config/agentic-dev-stack/stack.env`, then recreate the routine: `hermes cron edit <id> --prompt "..."` (or delete the `daily-digest` and `combo-alert` routines and re-run `install --hermes`).

## Data collection

**YouTube transcripts: `HTTP Error 429: Too Many Requests`.**
→ Use `--sleep-requests 3 --sleep-subtitles 5` and request only `en-orig`/`en`:
```bash
yt-dlp --write-auto-subs --sub-langs "en-orig,en" --sub-format vtt --skip-download --sleep-requests 3 --sleep-subtitles 5 -o "%(id)s.%(ext)s" <url>
```

**Python 3.15 (or very new) breaks Python tool installs.**
→ Install in isolation with `uv tool install --python 3.12 <package>`.

## Windows

**PowerShell: "running scripts is disabled on this system" when running `.\install.ps1`.**
→ Relax the policy for the current session only: `Set-ExecutionPolicy -Scope Process Bypass`, then run it again. Or skip the script entirely: `npx agentic-dev-stack install --all` is plain Node.

**`python` opens the Microsoft Store or is not found.**
→ On Windows, use the `py` launcher: check `py -3 --version`. The CLI looks for `python` and `py` on its own; if neither works, install Python 3.9+ (python.org or `winget install Python.Python.3.12`). For manual curator runs use `py -3 -I <script>`.

**`EPERM` / "symlink not allowed" during `add-project`.**
→ Creating symlinks needs Developer Mode or an elevated shell. The CLI falls back to a directory *junction* and, if that fails too, **copies** alethe into the project (it logs a warning). For real symlinks, enable Developer Mode.

**Scheduled jobs (`schtasks`).**
→ List them with `schtasks /Query /FO LIST | findstr agentic-dev-stack`. If `/Create` fails, open the terminal as the same user that runs Claude Code and re-run the phase. Logs are in `%USERPROFILE%\.local\share\agentic-dev-stack\logs\`. Note that a Task Scheduler job runs only while you are logged on unless you edit its settings.

**The free worker is "disabled" on Windows.**
→ Expected: there is no kernel sandbox. Use WSL2, or read about `ALLOW_UNSANDBOXED_FREE_WORKER` in [07-security.md](07-security.md).

**Hermes will not install on Windows.**
→ The installer is not automated there. Follow the [official guide](https://hermes-agent.nousresearch.com/docs/getting-started/installation) or use WSL2 ([06-hermes.md](06-hermes.md)).

## Quick diagnostics

```bash
npx agentic-dev-stack doctor                    # overall state
launchctl list | grep agentic-dev-stack                              # schedules (macOS)
crontab -l | grep agentic-dev-stack                                  # schedules (Linux)
tail -n 50 ~/.local/share/agentic-dev-stack/logs/*.err               # script errors
python3 -I ~/.agents/skills/alethe/scripts/orchestrate.py doctor
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:20128/v1/models   # 9Router
~/.local/bin/hermes gateway status; tail -n 30 ~/.hermes/logs/gateway.log
```
