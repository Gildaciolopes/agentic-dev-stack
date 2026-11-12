// Phases: workers, free-models, extras, hermes. Each is idempotent and OS-aware.
import fs from "node:fs";
import os from "node:os";
import readline from "node:readline";
import { configureAlethe, installAlethe } from "./alethe.mjs";
import { schedule } from "./schedule.mjs";
import { IS_LINUX, IS_MAC, IS_WIN, REPO, backup, flag, has, home, keeps, log, p, pin, python, readJSON, run, skipInstalls, todo, which, writeJSON } from "./util.mjs";

const BIN = () => p(home(), ".local", "bin");
const DATA = () => p(home(), ".local", "share", "agentic-dev-stack");
const times = (s) => String(s || "").split(/\s+/).filter(Boolean);

// Daily digest sections (DIGEST_SECTIONS = comma-separated ids, in this order)
export const DIGEST_SECTIONS = {
  models: "🤖 Free models (current combo and changes)",
  tokens: "📊 Tokens and quota",
  updates: "⬆️ Available updates",
  speckit: "📋 Spec Kit (features per project; ignore projects marked as paused in the map)",
  radar: "📡 AI radar (only what affects the setup: Claude Code, alethe, Spec Kit, RTK, caveman, graphify, Hermes, headroom, Codex and free models; say what is worth applying)",
  yesterday: "📓 Yesterday (what was done, per project)",
  hours: "⏱️ Hours (24h and 7 days)",
  plan: "🎯 Plan for today: 3 concrete priorities among active projects, using the map priorities, nearly finished Spec Kit features and what was left pending yesterday",
};
export const digestSections = (cfg) => String(cfg.DIGEST_SECTIONS || Object.keys(DIGEST_SECTIONS).join(",")).split(",").map((x) => x.trim()).filter((x) => DIGEST_SECTIONS[x]);

function npmGlobal(pkg, bin, version) {
  if (has(bin)) return log.ok(`${bin} (already installed)`);
  if (skipInstalls()) return log.warn(`${pkg} install skipped (ADS_SKIP_INSTALLS=1)`);
  const r = run("npm", ["install", "-g", version ? `${pkg}@${version}` : pkg]);
  r.code === 0 && has(bin) ? log.ok(`${bin} (npm ${pkg})`) : log.warn(`npm install -g ${pkg} failed: ${r.err.split("\n").pop()}`);
}
function brew(pkg, { cask = false } = {}) {
  if (!has("brew") || skipInstalls()) return false;
  const list = run("brew", ["list", cask ? "--cask" : "--formula", pkg]);
  if (list.code === 0) { log.ok(`${pkg} (already installed)`); return true; }
  const r = run("brew", ["install", ...(cask ? ["--cask"] : []), pkg]);
  r.code === 0 ? log.ok(pkg) : log.warn(`brew install ${pkg} failed`);
  return r.code === 0;
}

// ---------------------------------------------------------------- workers
export function phaseWorkers(cfg, { dryRun }) {
  log.step("workers: agent CLIs");
  if (dryRun) log.ok("(dry-run) would install opencode, agy, claude-squad, codex (optional)");
  else {
    if (!IS_WIN && flag(cfg, "WITH_SQUAD", 1)) { brew("tmux"); brew("claude-squad") || todo("claude-squad (optional TUI for parallel sessions): https://github.com/smtg-ai/claude-squad"); }
    if (flag(cfg, "WITH_OPENCODE", 1)) IS_MAC && has("brew") ? brew("opencode") : npmGlobal("opencode-ai", "opencode");
    if (flag(cfg, "WITH_AGY", 1)) {
      if (!(IS_MAC && brew("antigravity-cli", { cask: true })) && !has("agy")) todo("Antigravity CLI (agy): install from https://antigravity.google/product/antigravity-cli, then run `agy` once and sign in with Google");
      else todo("agy: run `agy` once and sign in with your Google account");
    }
    if (flag(cfg, "WITH_CODEX", 0)) { npmGlobal("@openai/codex", "codex"); todo("Codex: run `codex login` (ChatGPT account), then `npx agentic-dev-stack configure-alethe --force`"); }
  }

  if (flag(cfg, "WITH_OPENCODE", 1)) {
    log.step("workers: opencode-safe (sandboxed free-model worker)");
    if (!dryRun) installSandbox(cfg);
    if (!dryRun && has("opencode")) {
      const oc = p(home(), ".config", "opencode", "opencode.json");
      backup(oc);
      const c = readJSON(oc);
      c.permission = readJSON(p(REPO, "templates", "opencode-permissions.json")).permission;
      writeJSON(oc, c);
      log.ok("OpenCode permissions (second layer)");
    }
  }
  if (!dryRun && has("rtk") && !skipInstalls()) {
    if (has("opencode")) run("rtk", ["init", "-g", "--opencode"]);
    if (has("agy")) run("rtk", ["init", "-g", "--agent", "antigravity"]);
    if (has("codex")) run("rtk", ["init", "-g", "--codex"]);
    log.ok("rtk enabled for the installed worker CLIs");
  }

  log.step(`workers: alethe orchestrator (audited commit ${cfg.ALETHE_COMMIT})`);
  installAlethe(cfg, { dryRun });
  configureAlethe(cfg, { dryRun });
  todo("In each project: npx agentic-dev-stack add-project <project-dir>");
}

function installSandbox(cfg) {
  fs.mkdirSync(BIN(), { recursive: true });
  const cfgDir = p(home(), ".config", "agentic-dev-stack");
  fs.mkdirSync(cfgDir, { recursive: true });
  if (IS_MAC) {
    fs.writeFileSync(p(cfgDir, "deny-secrets.sb"), fs.readFileSync(p(REPO, "sandbox", "deny-secrets.sb.template"), "utf8").replaceAll("__HOME__", home()));
    fs.copyFileSync(p(REPO, "bin", "opencode-safe"), p(BIN(), "opencode-safe"));
    fs.chmodSync(p(BIN(), "opencode-safe"), 0o755);
    return log.ok("~/.local/bin/opencode-safe (sandbox-exec + --standalone)");
  }
  if (IS_LINUX) {
    if (!has("bwrap")) { log.warn("bubblewrap not found: free worker disabled (apt install bubblewrap, then re-run --workers)"); return; }
    fs.copyFileSync(p(REPO, "bin", "opencode-safe-linux"), p(BIN(), "opencode-safe"));
    fs.chmodSync(p(BIN(), "opencode-safe"), 0o755);
    return log.ok("~/.local/bin/opencode-safe (bubblewrap + --standalone)");
  }
  // Windows: no kernel sandbox equivalent available to a normal user
  if (flag(cfg, "ALLOW_UNSANDBOXED_FREE_WORKER", 0)) {
    fs.writeFileSync(p(BIN(), "opencode-safe.cmd"), "@echo off\r\nREM UNSANDBOXED: relies on isolated worktrees (no .env) + OpenCode permissions only\r\nopencode --standalone %*\r\n");
    log.warn("Windows: opencode-safe.cmd is NOT sandboxed (worktree isolation + permissions only). Prefer WSL2 for the free worker.");
  } else {
    log.warn("Windows: free-model worker disabled (no kernel sandbox). Use WSL2, or set ALLOW_UNSANDBOXED_FREE_WORKER=1 to accept the risk.");
  }
}

// ---------------------------------------------------------------- free models
export function phaseFreeModels(cfg, { dryRun }) {
  log.step("free-models: 9Router (local OpenAI-compatible router with fallback combos)");
  if (dryRun) log.ok("(dry-run) would install 9router + autostart + curator");
  else {
    npmGlobal("9router", "9router", pin("ninerouter", cfg));
    if (keeps(cfg, "9router-autostart")) log.ok("kept your own 9Router autostart (KEEP_EXISTING=9router-autostart)");
    else if (!skipInstalls()) autostart9router();
  }
  todo("9Router: open http://127.0.0.1:20128 (default password 123456, CHANGE IT), add provider NVIDIA NIM (free key at build.nvidia.com), create combo 'free', then CLI Tools -> OpenCode -> Apply");

  log.step(`free-models: curator (probes models, rewrites the combo at ${cfg.CURATOR_TIMES})`);
  const py = python();
  if (!py) { log.warn("Python >= 3.9 required for the curator; skipped"); return; }
  const dst = p(DATA(), "model-curator", "curate.py");
  if (!dryRun) {
    fs.mkdirSync(p(DATA(), "model-curator"), { recursive: true });
    // models.json first: curate.py reads it at start
    fs.copyFileSync(p(REPO, "scripts", "model-curator", "models.json"), p(DATA(), "model-curator", "models.json"));
    fs.copyFileSync(p(REPO, "scripts", "model-curator", "curate.py"), dst);
  }
  if (keeps(cfg, "curator")) log.ok("kept your own curator schedule (KEEP_EXISTING=curator)");
  else schedule("com.agentic-dev-stack.model-curator", times(cfg.CURATOR_TIMES), [which(py) || py, "-I", dst], { dryRun });
  todo(`After creating the 'free' combo, run the curator once: ${py} -I "${dst}"`);
}

function autostart9router() {
  const nodeBin = which("node");
  const cli = p(run("npm", ["root", "-g"]).out, "9router", "cli.js");
  if (!fs.existsSync(cli)) return log.warn("9router cli.js not found; autostart skipped");
  const running = run(IS_WIN ? "powershell" : "sh", IS_WIN ? ["-c", "try{(iwr -UseBasicParsing http://127.0.0.1:20128/v1/models -TimeoutSec 3).StatusCode}catch{0}"] : ["-c", "curl -s -o /dev/null -m 3 -w '%{http_code}' http://127.0.0.1:20128/v1/models"]).out;
  if (IS_MAC) {
    const label = "com.agentic-dev-stack.9router";
    const plist = p(home(), "Library", "LaunchAgents", `${label}.plist`);
    fs.writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${nodeBin}</string><string>${cli}</string><string>--tray</string><string>--skip-update</string></array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
<key>StandardOutPath</key><string>${p(DATA(), "logs", "9router.log")}</string>
<key>StandardErrorPath</key><string>${p(DATA(), "logs", "9router.err")}</string>
</dict></plist>
`);
    fs.mkdirSync(p(DATA(), "logs"), { recursive: true });
    if (running === "200") log.warn("9Router already running: autostart takes effect at next login");
    else { run("launchctl", ["bootout", `gui/${process.getuid()}/${label}`]); run("launchctl", ["bootstrap", `gui/${process.getuid()}`, plist]); log.ok(`9Router autostart (launchd, node ${nodeBin})`); }
  } else if (IS_LINUX && has("systemctl")) {
    const unitDir = p(home(), ".config", "systemd", "user");
    fs.mkdirSync(unitDir, { recursive: true });
    fs.writeFileSync(p(unitDir, "agentic-dev-stack-9router.service"), `[Unit]\nDescription=9Router (agentic-dev-stack)\n\n[Service]\nExecStart=${nodeBin} ${cli} --skip-update\nRestart=on-failure\n\n[Install]\nWantedBy=default.target\n`);
    run("systemctl", ["--user", "daemon-reload"]);
    const r = run("systemctl", ["--user", "enable", "--now", "agentic-dev-stack-9router.service"]);
    r.code === 0 ? log.ok("9Router autostart (systemd --user)") : log.warn("systemd --user unavailable; start 9router manually");
  } else if (IS_WIN) {
    const r = run("schtasks", ["/Create", "/F", "/SC", "ONLOGON", "/TN", "agentic-dev-stack-9router", "/TR", `"${nodeBin}" "${cli}" --skip-update`], { noShell: true });
    r.code === 0 ? log.ok("9Router autostart (Task Scheduler, on logon)") : log.warn(`schtasks failed: ${r.err || r.out}`);
  }
}

// ---------------------------------------------------------------- extras
export function phaseExtras(cfg, { dryRun }) {
  log.step("extras: yt-dlp, uv, Headroom (optional)");
  if (dryRun) return log.ok("(dry-run) would install yt-dlp, uv and optionally headroom");
  if (skipInstalls()) return log.warn("(test mode) extras skipped");
  if (!has("yt-dlp")) (has("brew") && brew("yt-dlp")) || (IS_WIN && has("winget") && run("winget", ["install", "-e", "--id", "yt-dlp.yt-dlp"]).code === 0) || todo("yt-dlp (transcripts for the Hermes reading queue): https://github.com/yt-dlp/yt-dlp#installation");
  if (!has("uv")) (has("brew") && brew("uv")) || todo("uv (Python tool installer): https://docs.astral.sh/uv/getting-started/installation/");
  if (flag(cfg, "WITH_HEADROOM", 0)) {
    if (has("headroom")) log.ok("headroom (already installed)");
    else if (has("uv")) { run("uv", ["tool", "install", "--python", "3.12", "headroom-ai[all]"], { timeout: 900_000 }); log.ok("headroom (isolated Python 3.12)"); }
    todo(IS_WIN ? "Headroom telemetry off: setx HEADROOM_TELEMETRY off & setx HEADROOM_BEACON off" : "Headroom telemetry off: add `export HEADROOM_TELEMETRY=off HEADROOM_BEACON=off` to your shell rc");
  } else log.warn("Headroom skipped (WITH_HEADROOM=0). It trades some fidelity for tokens; read docs/01-architecture.md first.");
}

// ---------------------------------------------------------------- hermes
async function ask(question, { hidden = false } = {}) {
  if (!process.stdin.isTTY) return "";
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
  const answer = await new Promise((res) => rl.question(question, res));
  rl.close();
  if (hidden) process.stdout.write("\n");
  return answer.trim();
}

function setEnv(file, key, val) {
  let s = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  s = re.test(s) ? s.replace(re, `${key}=${val}`) : s + (s && !s.endsWith("\n") ? "\n" : "") + `${key}=${val}\n`;
  fs.writeFileSync(file, s, { mode: 0o600 });
}

export async function phaseHermes(cfg, { dryRun, secrets = {} }) {
  log.step("hermes: always-on assistant (Discord/Telegram), hardened");
  if (dryRun) return log.ok("(dry-run) would install Hermes Agent, harden it, schedule digest + alerts");
  if (skipInstalls()) return log.warn("(test mode) Hermes left untouched");
  const H = which("hermes") || p(home(), ".local", "bin", "hermes");
  if (!fs.existsSync(H) && !has("hermes")) {
    if (IS_WIN) { todo("Hermes on Windows: follow https://hermes-agent.nousresearch.com/docs/getting-started/installation (or run it inside WSL2), then re-run --hermes"); return; }
    const tmp = p(os.tmpdir(), "hermes-install.sh");
    run("curl", ["-fsSL", "https://hermes-agent.nousresearch.com/install.sh", "-o", tmp]);
    log.warn(`Hermes installer downloaded to ${tmp}. Read it if you want; press Enter to continue, Ctrl+C to abort.`);
    await ask("");
    run("bash", [tmp, "--channel", "stable", "--skip-browser", "--skip-computer-use", "--non-interactive"], { stdio: "inherit", timeout: 1_800_000 });
  }
  const h = (...a) => run(H, a, { noShell: true });
  for (const [k, v] of [["telemetry.shared_metrics.enabled", "false"], ["telemetry.shared_metrics.send", "false"], ["updates.check", "false"],
    ["approvals.mode", "manual"], ["approvals.cron_mode", "deny"], ["discord.auto_thread", "false"]]) h("config", "set", k, v);
  for (const plat of ["discord", "telegram", "cron"]) h("tools", "disable", "--platform", plat, "web", "browser", "terminal", "code_execution", "vision", "image_gen", "tts", "delegation", "discord_admin", "computer_use", "connections");
  log.ok("telemetry off, update checks off, manual approvals, no shell/web/browser on chat platforms and cron");

  const ocCfg = readJSON(p(home(), ".config", "opencode", "opencode.json"));
  const key = ocCfg?.provider?.["9router"]?.options?.apiKey;
  if (key) {
    h("config", "set", "model.provider", "custom"); h("config", "set", "model.base_url", "http://127.0.0.1:20128/v1");
    h("config", "set", "model.default", "free"); h("config", "set", "model.api_key", key);
    log.ok("Hermes model = 9Router 'free' combo (zero cost)");
  } else todo("Hermes model: run `hermes model` -> Custom endpoint http://127.0.0.1:20128/v1, model free (after setting up 9Router)");

  const envf = p(home(), ".hermes", ".env");
  fs.mkdirSync(p(home(), ".hermes"), { recursive: true });
  const plat = cfg.HERMES_PLATFORM || "discord";
  if (plat === "discord") {
    const uid = secrets.uid ?? await ask("  Your Discord user ID (Settings -> Advanced -> Developer Mode -> Copy User ID): ");
    if (uid) { setEnv(envf, "DISCORD_ALLOWED_USERS", uid); setEnv(envf, "DISCORD_REQUIRE_MENTION", "false"); }
    if (!/^DISCORD_BOT_TOKEN=./m.test(fs.existsSync(envf) ? fs.readFileSync(envf, "utf8") : "")) {
      const tok = secrets.token ?? await ask("  Bot token (hidden): ", { hidden: true });
      if (tok) setEnv(envf, "DISCORD_BOT_TOKEN", tok);
    }
    todo("Discord: in your channel, send /sethome (outside any thread). See docs/06-hermes.md");
  } else if (plat === "telegram") {
    const uid = secrets.uid ?? await ask("  Your numeric Telegram ID (ask @userinfobot): ");
    if (uid) setEnv(envf, "TELEGRAM_ALLOWED_USERS", uid);
    if (!/^TELEGRAM_BOT_TOKEN=./m.test(fs.existsSync(envf) ? fs.readFileSync(envf, "utf8") : "")) {
      const tok = secrets.token ?? await ask("  Bot token from @BotFather (hidden): ", { hidden: true });
      if (tok) setEnv(envf, "TELEGRAM_BOT_TOKEN", tok);
    }
    todo("Telegram: send /sethome in the chat with your bot. See docs/06-hermes.md");
  }

  log.step("hermes: daily digest collector + scheduled summaries");
  const py = python();
  const dst = p(DATA(), "daily-digest", "collect.py");
  fs.mkdirSync(p(DATA(), "daily-digest"), { recursive: true });
  fs.mkdirSync(p(home(), ".hermes", "workspace", "daily"), { recursive: true });
  fs.copyFileSync(p(REPO, "scripts", "daily-digest", "collect.py"), dst);
  if (keeps(cfg, "collector")) log.ok("kept your own digest collector (KEEP_EXISTING=collector)");
  else if (py) schedule("com.agentic-dev-stack.daily-digest", times(cfg.DIGEST_COLLECT_TIME), [which(py) || py, "-I", dst], { dryRun });
  const deliver = plat === "none" ? "local" : plat;
  const crons = h("cron", "list").out;
  const prompt = (f) => fs.readFileSync(p(REPO, "templates", f), "utf8").replaceAll("__HOME__", home().replace(/\\/g, "/")).replaceAll("__LANG__", cfg.SUMMARY_LANGUAGE || "English").replaceAll("__SECTIONS__", digestSections(cfg).map((k) => DIGEST_SECTIONS[k]).join(" · ")).trim();
  const [hh, mm] = String(cfg.DIGEST_SEND_TIME || "08:00").split(":").map(Number);
  // create or update (re-running the wizard with new times/sections updates the existing jobs)
  const jobId = (name) => (crons.match(new RegExp(`^\\s*([0-9a-f]{6,})\\s*\\[[^\\]]*\\]\\s*\\n\\s*Name:\\s*${name}\\s*$`, "m")) || [])[1];
  const upsert = (name, schedule, text, catchUp) => {
    const id = jobId(name);
    const common = ["--deliver", deliver, "--timezone", cfg.TIMEZONE || "UTC", "--catch-up", catchUp];
    return id ? h("cron", "edit", id, "--schedule", schedule, "--prompt", text, ...common) : h("cron", "create", schedule, text, "--name", name, ...common);
  };
  if (!keeps(cfg, "digest")) upsert("daily-digest", `${mm} ${hh} * * *`, prompt("hermes-prompt-digest.txt"), "on");
  const ct = times(cfg.CURATOR_TIMES);
  const cm = ((ct[0] ? +ct[0].split(":")[1] : 30) + 5) % 60;
  if (flag(cfg, "COMBO_ALERT", 1) && !keeps(cfg, "combo-alert")) upsert("combo-alert", `${cm} ${ct.map((t) => +t.split(":")[0]).join(",") || 7} * * *`, prompt("hermes-prompt-combo.txt"), "off");
  log.ok(`routines: daily-digest at ${cfg.DIGEST_SEND_TIME || "08:00"} (${digestSections(cfg).join(", ")})${flag(cfg, "COMBO_ALERT", 1) ? " + combo-alert (silent when nothing changed)" : ""}`);
  h("gateway", "install");
  (h("gateway", "restart").code === 0) || h("gateway", "start");
  log.ok("gateway installed as a user service");
}
