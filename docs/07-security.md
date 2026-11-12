# 07. Security: Sandboxing AI Agents, Secrets and Third-Party Audits

## Threat model

A multi-agent setup widens three risks:
1. **Secret leakage:** a worker (especially one on a free model) reads `.env` files or keys and sends them to an external provider.
2. **Unwanted execution:** prompt injection (in a file, log, issue or web page) makes an agent run a command.
3. **Third-party code:** skills, plugins and `curl | bash` installers run with your user's privileges.

## Layers of defense

| Layer | Protects against | Where |
|---|---|---|
| Isolated worktree | the worker cannot see `.env` (git does not copy ignored files) | alethe `isolate: true`; no secret `seedPaths` |
| Kernel sandbox: `sandbox-exec` (macOS) / `bubblewrap` (Linux) | reading `.env*`, keys, credentials, `~/.ssh`, `~/.aws`, Keychain, **whatever the command** | `bin/opencode-safe` + `sandbox/deny-secrets.sb.template` (macOS); `bin/opencode-safe-linux` (Linux) |
| `--standalone` | OpenCode's background service running outside the sandbox | both wrappers |
| OpenCode permissions | 2nd layer (bypassable, e.g. `grep -r KEY .`) | `templates/opencode-permissions.json` |
| alethe env filter | `*_TOKEN/_KEY/_SECRET/_PASSWORD` variables removed from workers | built into alethe |
| Unsafe flags refused | `--yolo`, `--dangerously-skip-permissions`, `--auto`... | alethe (`trust.allowUnsafe` off) |
| Hermes without a shell | injection cannot execute anything | `hermes tools disable ...` |
| Chat allowlist | only your ID can talk to the bot | `*_ALLOWED_USERS` |
| Masking | the collector masks secret-like patterns and personal data (e-mails, CPF/CNPJ, phone numbers), and drops text pasted into prompts, before the LLM sees anything | `scripts/daily-digest/collect.py` (`SECRET`, `PERSONAL`, `prompt_text`) |

## Leak tests you can reproduce

Create a throwaway repo with a fake secret:
```bash
mkdir /tmp/leak && cd /tmp/leak && git init -q && echo 'def add(a,b): return a+b' > calc.py && git add -A && git commit -qm init
echo "API_KEY=FAKE-SECRET-123" > .env
git worktree add -q ../leak-wt && cd ../leak-wt
```

| Attempt | plain `opencode` | `opencode-safe` |
|---|---|---|
| read tool on `.env` | denied (permission) | denied |
| `cat .env` | denied (bash pattern) | denied |
| `grep -r API_KEY /tmp/leak` (absolute path) | **LEAKED** | `Operation not permitted` |
| `python3 -c "print(open('/tmp/leak/.env').read())"` | denied (external_directory) | `Operation not permitted` |
| `cat .env.example` | ok | ok (template allowed) |
| edit `calc.py` and run tests | ok | ok |

Lesson: **command-pattern filtering is decorative**. Only the kernel (or a container) holds the line. And without `--standalone` the sandbox catches nothing, because the process that actually executes is the background service (`opencode serve --service`).

```bash
# does the sandbox work? (macOS)
/usr/bin/sandbox-exec -f ~/.config/agentic-dev-stack/deny-secrets.sb cat /tmp/leak/.env   # -> Operation not permitted
```

## macOS: sandbox-exec

The installer writes `~/.config/agentic-dev-stack/deny-secrets.sb` (from `sandbox/deny-secrets.sb.template`, with your home path filled in) and installs `~/.local/bin/opencode-safe`. The profile denies reads of `.env*`, keys, credentials files and the sensitive home directories at the kernel level, while still allowing `.env.example`. The wrapper always passes `--standalone`.

## Linux: bubblewrap

The repository ships `bin/opencode-safe-linux`. When `bwrap` is installed (`apt install bubblewrap` or your distro's equivalent), `install --workers` copies it to `~/.local/bin/opencode-safe`. It:
- masks every `.env*`, `*.pem`, `*.key`, `*credentials*.json` and `*service-account*.json` in the current repo by binding `/dev/null` over it;
- hides `~/.ssh`, `~/.aws`, `~/.config/gcloud`, `~/.gemini` and `~/.codex` behind empty `tmpfs` mounts;
- always passes `--standalone` to OpenCode.

Without `bwrap` the installer disables the free worker and tells you why. Verify it the same way as on macOS: inside the wrapper, `cat /tmp/leak/.env` should show an empty file. You can also run the worker in a container that never mounts your secrets.

## Windows: no kernel sandbox

Windows has no practical equivalent of `sandbox-exec` or `bwrap` that a normal user can apply to an arbitrary CLI and that blocks file reads by path. So the stack does not pretend:

- **Default:** the free-model worker (`opencode-safe`) is **disabled** on Windows. Everything else (Claude Code, the hook, alethe with Sonnet/Haiku/agy, Hermes under WSL2) works.
- **Recommended:** run the stack inside **WSL2** and use the Linux path above. You get the real bubblewrap sandbox.
- **`ALLOW_UNSANDBOXED_FREE_WORKER=1`** (in `~/.config/agentic-dev-stack/stack.env`) installs `opencode-safe.cmd`, which just runs `opencode --standalone` **without any sandbox**. The only things protecting you are isolated worktrees (the `.env` is never copied into them) and OpenCode's permission rules. As the leak test above shows, permission rules by command pattern can be bypassed (`grep -r` with an absolute path). Accept this only on machines that hold no secrets outside the repo, and never with `seedPaths` that include secrets.

## Third-party audits (what was verified)

### alethe (commit `ab81104`)
- **Hooks:** `UserPromptSubmit` and `PostToolUse`. Silent when no mode is active; in passive mode they read the local transcript to estimate spend and write state to `~/.config/alethe/`.
- **Network:** no network code (no urllib/requests/socket). Nothing leaves the machine except what the worker CLIs send to their own providers.
- **Subprocess:** always with an argument array, `shell=False`, no `eval`/`exec`.
- **Workers:** Claude in `acceptEdits` with `--permission-prompts none`; Codex sandboxed; unsafe flags require double confirmation (in the plan and in the user policy).
- **Caveat:** the Claude worker edits and runs shell without asking, so use an isolated worktree.

### Hermes Agent (v0.23.x)
- **Installer:** sha256-verified downloads (uv, python, node, ripgrep, deps via `uv.lock`), no sudo on macOS, stable release (tag resolved at install time). Writes to `~/.hermes`, `~/.local/bin` and one PATH line in the shell rc.
- **Telemetry:** `shared_metrics` is off by default, with separate consent for sending. The cua-driver PostHog is off.
- **Discord authorization:** with `DISCORD_ALLOWED_USERS` set, everything else is denied (DMs and slash commands). All bypasses are opt-in.
- **Risk:** with `terminal.backend: local` (the default), an authorized user (or an injection) can run shell, and `approvals.mode: smart` auto-approves through an LLM. That is why the stack disables the terminal and sets approvals to manual.

### Headroom
A local proxy that all API traffic flows through. Telemetry and beacon are disabled with `HEADROOM_TELEMETRY=off` and `HEADROOM_BEACON=off`.

### 9Router
The `postinstall` only pre-warms dependencies (SQLite, wreq-js); it is safe to skip. The web UI ships with a default password (change it). Remote/tunnel mode exposes the API, so do not enable it without changing the key.

## Pinned versions (supply chain)

Every third-party tool the stack installs from source is pinned in [config/versions.json](../config/versions.json): Spec Kit (`git+…spec-kit.git@<tag>`), RTK (`cargo install --tag`, when not from Homebrew), caveman (marketplace `JuliusBrussee/caveman#<tag>`), graphify (`graphifyy==<version>`) and 9Router (`9router@<version>`); alethe is pinned by commit (`ALETHE_COMMIT`). A compromised `main` branch upstream therefore never reaches a machine running the wizard. `.github/workflows/pins.yml` proposes bumps weekly, only for releases at least 3 days old, after running the tests; GitHub Actions themselves are updated by Dependabot. Not pinned on purpose: Homebrew formulas and the official vendor CLIs (OpenCode, Codex, agy, Claude Code), which update themselves.

## Checklist before adding a new tool

1. Read the installer before any `curl | bash`.
2. `grep` for network code (`requests|urllib|fetch|axios|posthog|sentry|telemetry`), `shell=True`, `eval` and bypass flags.
3. Which hooks does it register, and when do they fire?
4. Which files does it read and write outside its own folder?
5. Does it have telemetry? How do you turn it off?
6. Pin the audited version (commit/tag) and update only after auditing the diff.

## Secrets already committed

If a scan finds a private key in git history (for example a committed `*service-account*.json`):
1. **Revoke/rotate the key first**, in the provider's console.
2. `git rm --cached <file>` and add it to `.gitignore`.
3. Tell the repo owner. Rewriting history (`git filter-repo`) comes only after the key is revoked, because it already lives in clones and forks.

See also: [05-free-models.md](05-free-models.md), [06-hermes.md](06-hermes.md) and [08-troubleshooting.md](08-troubleshooting.md).
