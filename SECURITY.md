# Security policy

This project wires AI agents into your machine, so security reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead:
**[Report a vulnerability](https://github.com/Gildaciolopes/agentic-dev-stack/security/advisories/new)**.

You'll get an answer within 7 days. Once a fix is released, you'll be credited in the advisory unless you prefer otherwise.

## In scope

- A way for the free-model worker (`opencode-safe`) to read `.env*`, keys or credential files despite the sandbox.
- The installer writing secrets to logs, backups, briefs or anywhere outside `~/.hermes/.env` (mode 600).
- `agent-model-guard` being bypassed in a way that isn't the documented `ALLOW_OPUS_SUBAGENT=1` escape hatch.
- Command injection through config values, project paths or file names.
- The digest collector leaking secrets into Hermes context (it is supposed to mask them).

## Out of scope

- Vulnerabilities in third-party tools (Claude Code, alethe, OpenCode, 9Router, Hermes, agy, Codex). Report those upstream; we'll bump the pinned version once fixed.
- The Windows free worker, which is documented as **not** sandboxed. Use WSL2.
- Prompt-injection attacks against models in general. Reports showing that one of *our* defaults makes them worse are in scope.

## Supported versions

Only the latest release on npm receives fixes.

See [docs/07-security.md](docs/07-security.md) for the threat model and how each layer works.
