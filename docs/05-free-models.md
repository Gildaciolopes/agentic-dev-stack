# 05. Free Models: 9Router, NVIDIA NIM and the Model Curator

## Why use free models for coding agents

Mechanical edits (renames, boilerplate, i18n strings, test scaffolding, docs) do not need Sonnet. When an automatic check (typecheck or test run) decides whether the result passes, a free model gets it right most of the time. When it fails, the `cascade` playbook escalates to Sonnet **starting from the error**, not from the cheap model's transcript.

## Components

| Component | Role |
|---|---|
| **NVIDIA NIM** (build.nvidia.com) | Dozens of free open models through an API: Nemotron, Kimi, GLM, DeepSeek, MiniMax, Mistral, Qwen... Limit of 40 requests/min per key. You do not need an NVIDIA GPU. |
| **9Router** (`npm i -g 9router`) | Local OpenAI-compatible router on `:20128`. Groups providers into **combos**: `fallback` (tries in order), `round robin` (spreads load) and `fusion` (all in parallel, picks the best answer). |
| **`free` combo** | The name OpenCode, Hermes and the curator all use. |
| **Curator** | A script that probes the models and rewrites the combo 3 times a day. |

## The problem the curator solves: free models die without notice

In a single day of real testing:
- GLM 5.2 returned `410 Gone: reached its end of life`
- DeepSeek V4 Pro returned `410 Gone`
- Kimi K2.6 returned `404 Function not found for account` (it shows up in the list, but the account has no access)
- MiMo Auto returned `Unsupported model`
- GLM 5.3 Flash and DeepSeek V4.1 Flash took more than 200 s to answer
- "OpenCode Free" models returned `Model is unavailable` / `ModelProtocolUnsupported`

Worse: 9Router **does not skip to the next model on a 410/404**, only on rate limits and server errors. One dead model at the top of the combo takes down every call. And the 9Router UI does not let you add a model by ID.

## How the curator picks models

`scripts/model-curator/curate.py` (installed under `~/.local/share/agentic-dev-stack/model-curator/`):

1. Fetches `https://integrate.api.nvidia.com/v1/models` (public).
2. Filters candidates: drops embedding, rerank, safety, vision, nano and small models; accepts known good families (Nemotron Ultra, Kimi K2, GLM 5, DeepSeek V4, large Qwen 3.x, MiniMax M3, Mistral Large, GPT-OSS 120B, Llama 4).
3. Probes up to 14 of them (two requests each, respecting the 40 req/min limit):
   - `"Reply with exactly: OK"`: does it answer?
   - a request with a `get_time` tool: **does it call the tool?** (OpenCode does not work without tool calling)
   - maximum latency of 30 s or less
4. Ranks by family (quality) and latency, then writes the **4 best** straight into 9Router's SQLite database (`~/.9router/db/data.sqlite`, table `combos`), after a backup (the last 20 are kept).
5. If none pass, it **leaves the combo alone** and records an alert.
6. Writes `status.json` (result for every model) and `history.jsonl` (changes). Hermes notifies you in chat when the combo changes (routine `combo-alert`).

Environment variables: `NINEROUTER_API_KEY` (otherwise read from `~/.config/opencode/opencode.json`), `CURATOR_COMBO` (default `free`), `CURATOR_STATE_DIR`.

```bash
python3 -I ~/.local/share/agentic-dev-stack/model-curator/curate.py     # manual run (Windows: py -3 -I ...)
python3 -m json.tool ~/.local/share/agentic-dev-stack/model-curator/status.json | less
```

### Schedule

`npx agentic-dev-stack install --free-models` registers the curator at the times in `CURATOR_TIMES` (default `07:30 13:30 19:30`) in `~/.config/agentic-dev-stack/stack.env`:

| OS | Scheduler | Job name |
|---|---|---|
| macOS | launchd | `com.agentic-dev-stack.model-curator` |
| Linux | crontab | entries tagged `# com.agentic-dev-stack.model-curator` |
| Windows | Task Scheduler | `com.agentic-dev-stack.model-curator[-N]` |

Logs go to `~/.local/share/agentic-dev-stack/logs/` (`*.log` and `*.err`).

## Adding other free providers to the combo

The curator only writes `nvidia/...` models. If you want a fallback from **another provider** (for when all of NVIDIA is down):
- **Gemini via an AI Studio key:** add the provider in the 9Router web UI.
- **OpenRouter free models:** same.

Then edit `FAMILIES` and `candidates()` in `curate.py` to include those IDs, or keep one fixed model at the end of the combo and adjust `write_combo` to preserve it.

## Using the combo

- **OpenCode:** `opencode run -m 9router/free "..."`. As an alethe worker, always go through `opencode-safe`.
- **Hermes:** `model.base_url http://127.0.0.1:20128/v1`, `model.default free`.
- **Any OpenAI client:** `base_url=http://127.0.0.1:20128/v1`, `model="free"`, `api_key=<local 9Router key>`.

## 9Router autostart

The installer registers 9Router so it comes up at login, using the `node` found at install time:

| OS | Mechanism |
|---|---|
| macOS | launchd agent `com.agentic-dev-stack.9router` (restarts on crash) |
| Linux | `systemd --user` unit `agentic-dev-stack-9router.service` |
| Windows | Task Scheduler task `agentic-dev-stack-9router` (`ONLOGON`) |

9Router's own autostart stores an absolute path to Node. If you switch Node versions it breaks silently (launchd shows `EX_CONFIG`). Re-run `install --free-models` after changing Node.

## 9Router Token Saver

9Router has its own compression (built-in RTK, output compression, "lazy senior dev"). **Leave it off.** You already have RTK and caveman, and stacking compressors degrades quality.

## Privacy and safety notes

- **Privacy:** free models may train on or log your data. Never put secrets in the prompt; `opencode-safe` enforces that at the kernel level on macOS and Linux (see [07-security.md](07-security.md)). Models with "Contributor" in the name state explicitly that they use your data.
- **Web UI password:** change the default `123456`. Do not enable remote/tunnel mode with the default key.
- **Free worker sandbox by OS:** macOS uses `sandbox-exec`, Linux uses `bubblewrap`. Windows has no kernel sandbox, so the free worker is off by default (WSL2 recommended).
