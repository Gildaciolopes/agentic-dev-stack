# Contributing

Thanks for helping make smart vibe coding easier for everyone. Issues and PRs are welcome, in English or Portuguese.

## Good first contributions

- **Worker adapters**: plug another CLI (Gemini CLI, Kiro, Copilot CLI, Aider…) into alethe. See [docs/04](docs/04-codex-and-other-clis.md).
- **Sandboxes**: a kernel-level secret sandbox for the free worker on Windows, or hardening the Linux bubblewrap profile.
- **Hermes recipes**: a productive routine others can reuse. See [docs/06](docs/06-hermes.md).
- **Translations** of the docs and templates (`docs/<lang>/`, `templates/<lang>/`).
- **Gate detection** in `add-project` for more ecosystems (Gradle, Maven, .NET, Elixir…).

## Development

Requirements: Node ≥ 18, git, Python ≥ 3.9 (only for the integration test).

```bash
git clone https://github.com/Gildaciolopes/agentic-dev-stack && cd agentic-dev-stack
npm test                    # unit + install tests, all inside a throwaway HOME
ALETHE_IT=1 npm test        # also clones alethe and patches a real profile (network)
node bin/cli.mjs --help
```

The tests never touch your real `~`: `ADS_HOME` points every path at a temp dir and `ADS_SKIP_INSTALLS=1` skips package managers and schedulers. Keep it that way for any new test.

## Rules of the codebase

1. **Zero runtime dependencies.** Node built-ins only, so `npx agentic-dev-stack` stays fast and auditable.
2. **Cross-platform.** Anything that touches the OS goes through `lib/util.mjs` / `lib/schedule.mjs` and must work on macOS, Linux and Windows (CI runs all three).
3. **Append, never rewrite.** User files are only changed between our `BEGIN/END` markers, and every edited file is backed up first.
4. **Idempotent.** Running any command twice gives the same result as running it once. Add a test for it.
5. **Enforcement over instructions.** If a rule matters, prefer a hook, sandbox or policy to a sentence in a markdown file.
6. **No secrets, no personal data** in code, docs, tests or fixtures.
7. **Pin and audit third-party code** (see how `ALETHE_COMMIT` works) instead of tracking `main`.

## Pull requests

- One topic per PR. Update the EN docs; the PT docs are welcome but not required (open an issue and we'll translate).
- `npm test` passes locally. CI must be green on Ubuntu, macOS and Windows.
- Add a line to the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md).
- Conventional commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `test:`) are preferred.

## Releasing (maintainers)

```bash
npm version minor            # or patch; updates package.json and creates the tag
git push --follow-tags       # the release workflow tests, publishes to npm with provenance and creates the GitHub release
```

Move the `Unreleased` CHANGELOG entries under the new version before tagging.
