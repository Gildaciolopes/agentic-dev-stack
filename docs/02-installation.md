# 02. Installation guide (macOS, Linux, Windows)

Estimated time: 20-30 min, most of it spent creating accounts and keys.

The installer is a cross-platform, zero-dependency Node CLI. It is idempotent: running it again does not duplicate anything.

## 0. Prerequisites

| Item | macOS | Linux (Debian/Ubuntu) | Windows |
|---|---|---|---|
| Node.js >= 18 | `brew install node` | `sudo apt install nodejs npm` (or nvm / NodeSource for a recent version) | `winget install OpenJS.NodeJS.LTS` |
| git | `brew install git` | `sudo apt install git` | `winget install Git.Git` |
| Python >= 3.9 (alethe, curator, digest) | `brew install python` | `sudo apt install python3` | `winget install Python.Python.3.12` |
| Claude Code, logged in | `brew install --cask claude-code`, then `claude` | install per the Claude Code docs, then `claude` | install per the Claude Code docs, then `claude` |

A Claude Pro/Max subscription or an API key is required. On Windows, **WSL2 is recommended** (see the Windows section).

## 1. Choose an install method

All three methods run the same CLI and accept the same flags.

### Method A: `npx` (any OS, nothing to clone)
```bash
npx agentic-dev-stack install --all
```

### Method B: clone and run the wrapper
```bash
git clone https://github.com/Gildaciolopes/agentic-dev-stack ~/agentic-dev-stack && cd ~/agentic-dev-stack
./install.sh --all          # macOS / Linux
```
```powershell
git clone https://github.com/Gildaciolopes/agentic-dev-stack $HOME\agentic-dev-stack; cd $HOME\agentic-dev-stack
.\install.ps1 --all         # Windows PowerShell
```

### Method C: call the CLI directly
```bash
node bin/cli.mjs install --all
```

### Phases and flags

| Flag | What it does |
|---|---|
| `--core` | RTK, agents, `agent-model-guard` hook, global `CLAUDE.md` block |
| `--workers` | alethe (pinned commit), agy, OpenCode, optional Codex, profile generation |
| `--free-models` | 9Router, `opencode-safe` sandbox wrapper, model curator and its schedule |
| `--extras` | graphify, Spec Kit, claude-squad, optional Headroom |
| `--hermes` | Hermes Agent, daily digest, scheduled summaries |
| `--all` | every phase above |
| `--dry-run` | print what would happen, change nothing |

Each phase:
- is idempotent;
- backs up every config it changes to `~/.local/share/agentic-dev-stack/backups/<date>/`;
- only **appends** to `~/.claude/CLAUDE.md`, never deletes.

At the end it prints the list of manual steps (section 3).

## 2. Configure

On first run the CLI copies `config/stack.env.example` to `~/.config/agentic-dev-stack/stack.env`. Edit that copy (and re-run the phase you changed):

```bash
$EDITOR ~/.config/agentic-dev-stack/stack.env
```

Important keys:
- `PROJECTS_DIR`: where your repos live (the daily digest discovers projects there).
- `TIMEZONE`, `CURATOR_TIMES`, `DIGEST_COLLECT_TIME`, `DIGEST_SEND_TIME`.
- `HERMES_PLATFORM`: `discord`, `telegram` or `none`.
- `SUMMARY_LANGUAGE`: language of the Hermes summaries (for example `English`).
- `PROJECT_DOCS_LANG`: `en` or `pt-BR`, the language of the block `add-project` appends to `CLAUDE.md`/`AGENTS.md`.
- `WITH_AGY`, `WITH_OPENCODE`, `WITH_CODEX`, `WITH_HEADROOM`.
- `ALETHE_COMMIT`: the audited alethe commit. Change it only after auditing another.
- `ALLOW_UNSANDBOXED_FREE_WORKER`: Windows only, see below.

Where tools come from: `opencode` (`opencode-ai`), `codex` (`@openai/codex`) and `9router` are installed with npm. `agy` is a Homebrew cask on macOS and a manual download elsewhere (https://antigravity.google/product/antigravity-cli). RTK comes from Homebrew or `cargo`; on Windows download the zip from the RTK releases page.

## Per-OS notes

### macOS
Fully supported, including the kernel sandbox.
- Free worker sandbox: `sandbox-exec` via `bin/opencode-safe`.
- Schedules (curator, digest) and 9Router autostart: launchd (`com.agentic-dev-stack.*` agents in `~/Library/LaunchAgents`).
- agy: `brew install --cask` (handled by the installer when `WITH_AGY=1`).

### Linux (Debian/Ubuntu)
- Install the sandbox dependency first: `sudo apt install bubblewrap`. `bin/opencode-safe-linux` is installed as `~/.local/bin/opencode-safe`.
- Schedules: your user `crontab` (the installer adds tagged lines).
- 9Router autostart: `systemd --user` unit named `agentic-dev-stack-9router`. If you want it to run without an active login, enable lingering: `loginctl enable-linger $USER`.
- Hermes also uses a systemd user service (`hermes gateway install`).
- agy: no package; download it manually from the link above. Without it, the independent reviewer falls back to Codex or Claude itself (`configure-alethe` decides automatically).

### Windows (PowerShell, with WSL2 recommended)
Native Windows works for everything **except** the kernel sandbox:
- Schedules: Task Scheduler. 9Router autostart: a `schtasks` `ONLOGON` task named `agentic-dev-stack-9router`.
- Free worker: **disabled by default**, because there is no kernel sandbox to deny reads of secrets. Set `ALLOW_UNSANDBOXED_FREE_WORKER=1` in `stack.env` to create an **unsandboxed** `opencode-safe.cmd` (protection is limited to isolated worktrees plus OpenCode permissions). Only do this on repos without secrets.
- RTK: download the zip from the RTK releases and put the binary on your `PATH`.
- agy: manual download from the link above.

**Recommended:** install WSL2 (`wsl --install -d Ubuntu`) and follow the Linux instructions inside it. You get bubblewrap sandboxing, cron and systemd, and the same behavior as the reference setup.

```powershell
npx agentic-dev-stack install --all
# or, from a clone
.\install.ps1 --all
```

## 3. Manual steps (only you can do these)

### 3.1 caveman (inside Claude Code)
```
/plugin marketplace add JuliusBrussee/caveman
/plugin install caveman
/caveman ultra
```
To keep it always on, ask Claude to add a rule to your `~/.claude/CLAUDE.md`: "invoke the caveman skill at ultra intensity at the start of every session".

### 3.2 Log in to agy
Run `agy` once and sign in with your Google account. Confirm with `agy models`.

> **Gemini CLI:** personal-account login was discontinued ("This client is no longer supported for Gemini Code Assist for individuals"). Use agy, or a free AI Studio key as a provider in 9Router.

### 3.3 9Router and the free NVIDIA models
1. Create a free key at **build.nvidia.com** (avatar, API Key, Generate). The limit is 40 requests/min. You do not need an NVIDIA GPU.
2. Open `http://127.0.0.1:20128` (the installer already starts 9Router at login). The initial password is `123456`: **change it in Settings, Security**.
3. Under **Providers, NVIDIA NIM, Add connection**, paste the key and validate it.
4. Under **Combos, Create**, make a combo named `free` with the **Fallback** strategy and any model that passes **Test**.
5. Under **CLI Tools, OpenCode**, select the `free` combo and click **Apply**.
6. Run the curator once by hand. It replaces the combo with the best currently working models:
   ```bash
   python3 -I ~/.local/share/agentic-dev-stack/model-curator/curate.py
   ```
   (On Windows use `py -3 -I %USERPROFILE%\.local\share\agentic-dev-stack\model-curator\curate.py` or the path printed by the installer.)

### 3.4 Projects
For each repo:
```bash
npx agentic-dev-stack add-project ~/projects/my-app --dry-run   # preview the block that would be appended
npx agentic-dev-stack add-project ~/projects/my-app
```
From a local clone, use `node bin/cli.mjs add-project ...`. Options: `--dry-run`, `--no-docs` (skip the docs block), `--lang en|pt-BR`, `--refresh`, `--remove`.

Review the **Gates** (check commands) and **Parallelization units** at the end of the project's `CLAUDE.md`: they are detected automatically from Makefile, package.json, pyproject, Cargo and go.mod.

**Nothing in the folder is deleted.** Existing `CLAUDE.md`/`AGENTS.md` only get a block appended between `BEGIN/END ALETHE ORCHESTRATION` markers; missing ones are created. `.claude/settings.local.json` is merged. Running it twice changes nothing.

#### Starting a brand-new project
The block is generated from what the folder contains *at that moment*, so an empty folder gets generic gates. Two ways to get it right:

```bash
mkdir shop && cd shop && git init      # git first: local files are then git-excluded automatically
# scaffold: package.json/pyproject with test, lint, typecheck scripts
specify init .                         # optional: Spec Kit -> the block switches to the SDD flow
npx agentic-dev-stack add-project .
```

Or wire it on day one and refresh after scaffolding:

```bash
npx agentic-dev-stack add-project .            # day one, empty folder
# ...scaffold, add scripts, specify init...
npx agentic-dev-stack add-project . --refresh  # regenerates only our block; your text above and below it stays
```

#### Unwiring a project
```bash
npx agentic-dev-stack add-project ~/projects/my-app --remove   # add --dry-run to preview
```
It removes our block, the alethe link, the alethe hooks in `settings.local.json` and our `.git/info/exclude` lines. A `CLAUDE.md`/`AGENTS.md` that only contained our block is deleted; anything you wrote stays.

> **Versioned repos:** the block is appended to `CLAUDE.md`/`AGENTS.md`, which are usually tracked by git, so it shows up in `git status`. Commit it if your team uses the stack; skip it if it is just yours. The skill, the hook and the `.alethe/` folder are kept out of git through `.git/info/exclude`.

### 3.5 Hermes
See [06-hermes.md](06-hermes.md): create the Discord or Telegram bot and get your user ID. The installer asks for the token with hidden input, so it never shows on screen or in shell history.

### 3.6 Codex (optional)
See [04-codex-and-other-clis.md](04-codex-and-other-clis.md).

## 4. Verify

```bash
npx agentic-dev-stack doctor                                     # checks tools, hooks, config and schedules
rtk gain                                                         # RTK counting savings
python3 -I ~/.agents/skills/alethe/scripts/orchestrate.py doctor # alethe: playbooks/policy valid
python3 -I ~/.agents/skills/alethe/scripts/orchestrate.py usage --refresh-claude --refresh-agy
opencode run -m 9router/free "Reply only: OK"                    # free combo responding
~/.local/bin/hermes gateway status                               # Hermes supervised
```

Guard test: inside claude, ask "launch an Explore subagent to list files". It must be **denied**, with a message pointing to `scout`.

## 5. Uninstall

```bash
npx agentic-dev-stack uninstall --dry-run   # see what would be removed
npx agentic-dev-stack uninstall             # add --purge to also remove the alethe skill and your stack.env
```

It removes only what the installer created or appended:
- the `AGENTIC-DEV-STACK` block in `~/.claude/CLAUDE.md` (your text stays);
- the guard hook and `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` in `~/.claude/settings.json` (other keys stay; a different model value you set stays);
- the guard script and the `scout`/`builder`/`reviewer` subagents, **unless you edited them**;
- the curator, digest and 9Router schedules (launchd, crontab/systemd or Task Scheduler);
- `opencode-safe`, the sandbox profile and the scheduled scripts.

Every edited file is backed up first to `~/.local/share/agentic-dev-stack/backups/<timestamp>/`, keeping its original path. Third-party tools stay installed; the command prints how to remove each one (RTK hook: `rtk init -g --uninstall`; Hermes routines: `hermes cron list`). Wired projects are unwired one by one with `add-project <dir> --remove`.

## Troubleshooting

See [08-troubleshooting.md](08-troubleshooting.md). For security details of the sandbox, see [07-security.md](07-security.md).
