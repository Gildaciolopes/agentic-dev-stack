# agentic-dev-stack: smart vibe coding with Claude Code

[![CI](https://github.com/Gildaciolopes/agentic-dev-stack/actions/workflows/ci.yml/badge.svg)](https://github.com/Gildaciolopes/agentic-dev-stack/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/agentic-dev-stack)](https://www.npmjs.com/package/agentic-dev-stack)
![platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-informational)
![node](https://img.shields.io/badge/node-%E2%89%A518-339933)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> **Stop running one AI agent at a time.** This is a production-ready setup for Claude Code:
> - the expensive model (Opus) plans;
> - cheap and free models execute;
> - a reviewer from another provider checks the diff;
> - every turn spends the minimum number of tokens.
>
> It includes spec-driven development with GitHub Spec Kit, token savings with caveman + RTK + graphify, multi-agent orchestration with alethe, kernel-sandboxed secrets, self-healing free models through 9Router, and an always-on Hermes assistant on Discord or Telegram. **One command on macOS, Linux and Windows.**

**🇧🇷 [Leia em português](README.pt-BR.md)** · 📘 **[The smart vibe coding guide](docs/00-smart-vibe-coding.md)** · 🧩 **[CLAUDE.md / AGENTS.md templates](templates/)**

```bash
npx agentic-dev-stack install --all
```

![Demo: install the stack, wire a project, orchestrate parallel workers with a review gate, verify with doctor](docs/assets/demo.gif)

---

## Why

| Without the stack | With the stack |
|---|---|
| One agent at a time; **you** are the bottleneck | The lead plans and fans out parallel workers, each in an isolated git worktree |
| Subagents silently inherit Opus | A hook **blocks** Opus subagents; the default becomes Sonnet; reading goes to Haiku/Gemini |
| Claude quota runs out mid-day | Heavy reading uses Google quota (agy); mechanical edits use free models (NVIDIA via 9Router) |
| "Free models" break every week (410, 404, timeouts) | A curator probes models 3×/day and rewrites the combo on its own |
| Terminal output and context bloat every turn | RTK compresses shell output, caveman trims replies, graphify replaces broad reads |
| Rules live in CLAUDE.md and get ignored | Rules become enforcement: hooks, kernel sandbox, orchestrator policy |
| No spec, giant prompts, blind diffs | Spec Kit SDD: specify → clarify → plan → tasks → analyze → implement → review → verify |
| You only know what happened by opening the laptop | Hermes sends a daily digest + plan of the day to Discord/Telegram |

## Measured, not promised

Real numbers from the author's machine, straight from `rtk gain --monthly` (24,431 shell commands run by agents):

| Month | Commands | Tokens kept out of context | Saved |
|---|---:|---:|---:|
| 2026-09 | 10,215 | 330K | 11.9% |
| 2026-10 | 10,898 | 686K | 14.1% |
| 2026-11 (stack set up early in the month, partial) | 3,318 | 261K | **24.2%** |
| **Total** | **24,431** | **1.3M** | **14.6%** |

That is one developer and one workload, and November is a partial month, so read it as a trend, not a benchmark. Savings from delegation (subagents, alethe) and caveman are not measured here yet. Measure your own after a week or two:

```bash
rtk gain --monthly                                                  # shell output savings
python3 -I ~/.agents/skills/alethe/scripts/orchestrate.py report    # per-run cost, models and providers
```

Share your numbers in an issue: a table of real results from different setups is worth more than any claim.

## Architecture

![agentic-dev-stack architecture: Opus lead, native subagents, alethe orchestrator, workers, free models, Hermes, token economy layer](docs/assets/architecture.svg)

<sub>Editable source: [`docs/assets/architecture.excalidraw`](docs/assets/architecture.excalidraw) (open at excalidraw.com).</sub>

## The workflow

![Smart vibe coding workflow: Spec Kit decisions with the lead, delegated execution, review gate, token savings on every turn](docs/assets/workflow.svg)

The full guide, **[Smart vibe coding: the complete guide](docs/00-smart-vibe-coding.md)**, covers:
- how caveman, RTK, graphify and Spec Kit SDD fit together;
- a day in the life;
- prompting patterns and anti-patterns;
- checklists.

## Who does what

| Piece | Role | Why |
|---|---|---|
| **Claude Code (Opus)** | Lead: plans, decides, integrates, validates | Best reasoning, spent only where it matters |
| **Sonnet** (`builder`) | Implements planned units; Opus only for `deep`/`risky` ones | High quality at mid cost |
| **Haiku** (`scout`) | Reading and search that needs a shell | Cheap and fast |
| **agy · Gemini Flash** | Heavy read-only scouting | Uses Google quota, not Claude's |
| **agy · Claude Opus** / **Codex** | Independent bug-hunting review | A different provider is a real second opinion |
| **OpenCode + 9Router `free`** | Mechanical edits gated by tests | Zero cost; isolated worktree + kernel sandbox |
| **alethe** | Orchestrator: playbooks, model per task, quota watch, provider switch, cost report | Turns "use more agents" into a reproducible plan |
| **GitHub Spec Kit** | Spec-driven development | `tasks.md` becomes the parallel units |
| **graphify** | Code knowledge graph | Scouts query the graph instead of reading the repo |
| **RTK** | Compresses shell output | 15–30% fewer input tokens, transparent |
| **caveman** | Terse replies | Fewer output tokens and less re-read context |
| **Hermes Agent** | Always-on assistant (no shell) | Digest, alerts and questions from your phone |
| **agent-model-guard** | Hook that denies Opus subagents | Text rules don't work; enforcement does |
| **opencode-safe** | Kernel sandbox that denies `.env`/keys | Free model + file access = leak risk |

Details: [docs/01-architecture.md](docs/01-architecture.md).

## Install

| Method | Command |
|---|---|
| **npx (any OS)** | `npx agentic-dev-stack install --all` |
| **macOS / Linux** | `git clone https://github.com/Gildaciolopes/agentic-dev-stack && cd agentic-dev-stack && ./install.sh --all` |
| **Windows (PowerShell)** | `git clone https://github.com/Gildaciolopes/agentic-dev-stack; cd agentic-dev-stack; .\install.ps1 --all` |

Instead of `--all`, you can pick phases: `--core`, `--workers`, `--free-models`, `--extras`, `--hermes`. Add `--dry-run` to preview. The installer:
- can be re-run safely (nothing is duplicated);
- backs up any config it edits;
- never deletes your content.

Then wire each project and check the result:

```bash
npx agentic-dev-stack add-project ~/code/my-app   # --lang pt-BR for Portuguese blocks
npx agentic-dev-stack doctor
```

`add-project` never deletes anything: it appends a marked block to `CLAUDE.md`/`AGENTS.md`. Brand-new, empty project? Wire it now and run `add-project . --refresh` after scaffolding to re-detect test/lint commands and Spec Kit. To undo: `add-project <dir> --remove` for a project, `uninstall` for the whole stack (both back up what they touch, and both accept `--dry-run`).

Prerequisites: Node ≥ 18, git and Claude Code. Python ≥ 3.9 is also needed for alethe, the curator and the digest. Per-OS details and the manual steps (logins, keys) are in [docs/02-installation.md](docs/02-installation.md).

| Platform | Support |
|---|---|
| macOS | Full (launchd, `sandbox-exec` for the free worker) |
| Linux | Full (crontab/systemd, bubblewrap sandbox) |
| Windows | Core, workers, alethe, 9Router, Task Scheduler. The free worker is off by default (no kernel sandbox; use WSL2). Hermes via WSL2 |

CI runs the test suite and a real `--core` install on **Ubuntu, macOS and Windows (PowerShell)**, on Node 20 and 22.

## Templates for your projects

- [`templates/project/CLAUDE.md`](templates/project/CLAUDE.md): a starter CLAUDE.md covering SDD, token economy, delegation and definition of done.
- [`templates/project/AGENTS.md`](templates/project/AGENTS.md): the cross-agent version (Codex, OpenCode, Antigravity, Cursor), with the worker contract.
- Portuguese versions are in [`templates/pt-BR/`](templates/pt-BR/).

## Hermes: your always-on dev assistant

Scripts collect the data; Hermes summarizes it. Every morning you get a digest with:
- free-model status, token usage and available updates;
- Spec Kit progress and an AI radar;
- yesterday's work and hours per project;
- **3 priorities for today**.

The docs also include 10 productive recipes: CI triage, uptime/SSL checks, weekly CVEs, a phone inbox that becomes tasks, billable hours, client-friendly release notes and more. Works on Discord or Telegram. → [docs/06-hermes.md](docs/06-hermes.md)

## Documentation

| | English | Português |
|---|---|---|
| 0 | [Smart vibe coding: the complete guide](docs/00-smart-vibe-coding.md) | [Vibe coding inteligente: o guia completo](docs/pt-BR/00-vibe-coding-inteligente.md) |
| 1 | [Architecture](docs/01-architecture.md) | [Arquitetura](docs/pt-BR/01-arquitetura.md) |
| 2 | [Installation (macOS, Linux, Windows)](docs/02-installation.md) | [Instalação](docs/pt-BR/02-instalacao.md) |
| 3 | [alethe orchestration](docs/03-alethe.md) | [alethe](docs/pt-BR/03-alethe.md) |
| 4 | [Codex and other CLIs](docs/04-codex-and-other-clis.md) | [Codex e outros CLIs](docs/pt-BR/04-codex-e-outros-clis.md) |
| 5 | [Free models: 9Router + curator](docs/05-free-models.md) | [Modelos grátis](docs/pt-BR/05-modelos-gratis.md) |
| 6 | [Hermes + 10 use cases](docs/06-hermes.md) | [Hermes + 10 usos](docs/pt-BR/06-hermes.md) |
| 7 | [Security: sandbox, secrets, audits](docs/07-security.md) | [Segurança](docs/pt-BR/07-seguranca.md) |
| 8 | [Troubleshooting](docs/08-troubleshooting.md) | [Troubleshooting](docs/pt-BR/08-troubleshooting.md) |
| 9 | [Maintenance](docs/09-maintenance.md) | [Manutenção](docs/pt-BR/09-manutencao.md) |

## FAQ

**What is "smart vibe coding"?**
You steer intent and decisions; agents do the typing. "Smart" means spec first, cheap models for volume, independent review, verification before "done", and minimal tokens. See the [guide](docs/00-smart-vibe-coding.md).

**How do I save tokens in Claude Code?**
Stack four things:
1. RTK, for shell output;
2. caveman, for replies;
3. graphify, for reading code;
4. a lean CLAUDE.md, with one topic per chat.

Then stop paying Opus prices for reading and boilerplate: delegate those to Haiku, Gemini, Sonnet and free models.

**Can I use free models with Claude Code?**
Yes, as workers: OpenCode + 9Router with free NVIDIA NIM models. The curator keeps them healthy, and the sandbox makes sure they never see your secrets.

**How do I run multiple Claude Code agents in parallel?**
Two ways: native subagents (`scout`/`builder`/`reviewer`) with worktree isolation, or alethe playbooks such as `parallel-worktrees` for Spec Kit `[P]` tasks.

**Does it work with Codex, Gemini, Kiro or Copilot CLI?**
Codex is a native alethe provider (`WITH_CODEX=1`); the others plug in as custom workers. See [docs/04](docs/04-codex-and-other-clis.md).

**Does it work on Windows?**
Yes for the core, workers, orchestration and schedules (PowerShell, Task Scheduler). The free-model worker needs a kernel sandbox, so on Windows run it under WSL2.

**Will it delete or overwrite my files?**
No. It only appends blocks between `BEGIN/END` markers, merges JSON settings, and backs up every file it edits to `~/.local/share/agentic-dev-stack/backups/`. `uninstall` and `add-project --remove` take out only those blocks and entries.

**Is it safe?**
- Third-party pieces were audited and pinned to a reviewed version.
- The free worker is blocked from reading secrets at the kernel level.
- Hermes runs without a shell.

See [docs/07-security.md](docs/07-security.md).

## Principles

1. **Plan big, execute small**: strong model for decisions, cheap model for volume.
2. **Delegate only when it pays**: small or coupled tasks stay with the lead.
3. **Enforcement over instructions**: hooks, sandboxes and policies, not sentences in CLAUDE.md.
4. **Secrets never leave the machine.**
5. **Deterministic where possible**: scripts collect and decide; models summarize and reason.
6. **Audit before installing**: third-party code is read and pinned.

## Contributing

Issues and PRs are welcome: new worker adapters, Linux/Windows sandboxes, Hermes recipes, translations. Start with [CONTRIBUTING.md](CONTRIBUTING.md); security reports go through [SECURITY.md](SECURITY.md) (privately). Release notes: [CHANGELOG.md](CHANGELOG.md).

## License

MIT. Third-party tools keep their own licenses.
