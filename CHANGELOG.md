# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [1.3.1] - 2026-11-12

### Fixed
- `doctor` reported caveman as missing when it was installed as a skill copy (`~/.claude/skills/caveman`, `~/.agents/skills/caveman`) or as a plugin without `~/.config/caveman/config.json`; the installer no longer adds the plugin next to an existing skill copy.

### Security
- Daily digest: text pasted into Claude Code prompts (`<pasted_content>` blocks, code fences, JSON dumps) no longer reaches the dev diary, and e-mails, CPF/CNPJ and phone numbers are masked in every section, so query results and customer data are not sent to the summary model or the chat.

## [1.3.0] - 2026-11-12

### Added
- `adopt`: finds a setup you already run by hand (scheduled curator, digest collector, 9Router autostart on launchd/crontab/systemd/Task Scheduler; Hermes digest and combo-alert jobs; an orchestration section in `~/.claude/CLAUDE.md`) that would run twice next to the stack's. For each one: **replace** (backed up, then disabled; Hermes jobs are renamed so history stays) or **keep** (the stack skips its own copy, `KEEP_EXISTING`). The wizard runs it before installing.
- `doctor --fix`: re-runs only the phases that own a failing check, recreates the 9Router `free` combo, then checks again. doctor now follows what you enabled (disabled components show as such) and checks the CLAUDE.md block, caveman, Spec Kit, graphify, 9Router health, provider, combo and the schedules.
- "Update available" notice (cached daily, 1.5 s budget, silent offline, `NO_UPDATE_NOTIFIER=1`).
- Wizard test in a real pseudo-terminal (arrows, space, typing, Ctrl+U) in CI on macOS and Linux.
- `scripts/model-curator/models.json`: one model ranking shared by the curator and the wizard.

### Security
- Third-party tools are pinned (`config/versions.json`): Spec Kit tag, RTK tag, caveman marketplace tag, graphify and 9Router versions. `PIN_<NAME>` overrides locally. A weekly workflow proposes bumps (releases at least 3 days old, tests run first); Dependabot updates GitHub Actions.

## [1.2.0] - 2026-11-12

### Added
- **Setup wizard**: `npx agentic-dev-stack` asks a few questions (arrow keys, like `create-next-app`) and installs and configures everything. English and Portuguese. Re-running it opens pre-filled with Update / repair, Change settings, Wire more projects, New project, doctor and Uninstall. Nothing is written until you confirm.
- 9Router configured through its local API: NVIDIA provider, `free` combo seeded with the best current models, API key, OpenCode wiring, new dashboard password; then the curator runs once.
- caveman (plugin + default intensity), Spec Kit and graphify are installed automatically (uv is installed when missing).
- Hermes: bot tokens are verified, the Discord invite link is generated, the Telegram user ID is auto-detected; digest time, sections and language are configurable, and routines are updated (not duplicated) on re-runs.
- `npx agentic-dev-stack new <name>`: new project with an optional framework (Next.js, Vite, Astro, Python/uv), `git init`, optional Spec Kit, already wired.
- Non-interactive setup: `setup --yes` or `ADS_ANSWERS=answers.json`.
- Release workflow can be re-run for an existing tag (`gh workflow run release.yml -f tag=vX.Y.Z`).

### Fixed
- Test mode (fake `ADS_HOME`) no longer touches real system services (launchd/crontab/Task Scheduler, Hermes, 9Router autostart).

## [1.1.0] - 2026-11-11

### Added
- `add-project --refresh`: regenerates only the orchestration block (re-detects gates, units and Spec Kit). Wire a project the day you create the folder, refresh after scaffolding.
- `add-project --remove`: unwires a project (block, alethe link, hooks, git-exclude lines). Files that only held our block are deleted; your content stays.
- `uninstall [--dry-run] [--purge]`: removes only what the installer created or appended, keeps edited subagents, backs up every edited file, and lists how to remove third-party tools.
- Release workflow: pushing a `v*` tag tests, publishes to npm with provenance (trusted publishing, no token) and creates the GitHub release.
- Community files: CONTRIBUTING, SECURITY (private reporting), CODE_OF_CONDUCT, issue and PR templates.
- Demo GIF and measured token savings in the README.

### Changed
- Backups keep the original path structure, so two `CLAUDE.md` files never overwrite each other's backup.

## [1.0.0] - 2026-11-11

### Added
- Cross-platform zero-dependency CLI (`npx agentic-dev-stack`): `install` (core, workers, free-models, extras, hermes), `add-project`, `configure-alethe`, `doctor`.
- `agent-model-guard` hook (Node) that denies Opus-bound subagents; default subagent model Sonnet.
- alethe install pinned to an audited commit, with a generated profile (agy scouts and reviews, Sonnet/Opus build, sandboxed free worker).
- `opencode-safe`: kernel sandbox for the free worker (`sandbox-exec` on macOS, bubblewrap on Linux).
- 9Router autostart and a free-model curator that rewrites the combo 3×/day.
- Hermes Agent hardening, daily digest collector and routines (Discord/Telegram).
- Smart vibe coding guide and 10 docs in English and Portuguese, dark Excalidraw diagrams, CLAUDE.md/AGENTS.md starter templates.
- CI on Ubuntu, macOS and Windows (Node 20 and 22).

[Unreleased]: https://github.com/Gildaciolopes/agentic-dev-stack/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/Gildaciolopes/agentic-dev-stack/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Gildaciolopes/agentic-dev-stack/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Gildaciolopes/agentic-dev-stack/releases/tag/v1.0.0
