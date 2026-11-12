# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Release workflow can be re-run for an existing tag (`gh workflow run release.yml -f tag=vX.Y.Z`).

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

[Unreleased]: https://github.com/Gildaciolopes/agentic-dev-stack/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Gildaciolopes/agentic-dev-stack/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Gildaciolopes/agentic-dev-stack/releases/tag/v1.0.0
