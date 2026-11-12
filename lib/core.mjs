// Phase "core": RTK, subagents, agent-model-guard, default subagent model, global CLAUDE.md block.
import fs from "node:fs";
import { IS_MAC, IS_WIN, REPO, appendBlock, backup, flag, has, home, keeps, log, p, pin, readJSON, run, skipInstalls, todo, writeJSON } from "./util.mjs";

export const GUARD_MARK = "agent-model-guard";

export function guardCommand() {
  return `node "${p(home(), ".claude", "hooks", "agent-model-guard.mjs")}"`;
}

export function mergeClaudeSettings(file) {
  const c = readJSON(file);
  c.env = c.env || {};
  c.env.CLAUDE_CODE_SUBAGENT_MODEL = c.env.CLAUDE_CODE_SUBAGENT_MODEL || "sonnet";
  c.hooks = c.hooks || {};
  const pre = (c.hooks.PreToolUse = c.hooks.PreToolUse || []);
  // replace any older guard entry (e.g. the python version) instead of duplicating
  for (const e of pre) e.hooks = (e.hooks || []).filter((h) => !String(h.command || "").includes(GUARD_MARK));
  c.hooks.PreToolUse = pre.filter((e) => (e.hooks || []).length);
  c.hooks.PreToolUse.push({ matcher: "Agent|Task", hooks: [{ type: "command", command: guardCommand(), timeout: 5 }] });
  writeJSON(file, c);
  return c;
}

export const speckitArgs = (cfg) => ["specify-cli", "--from", `git+https://github.com/github/spec-kit.git@${pin("speckit", cfg)}`];
export const graphifyArgs = (cfg) => [`graphifyy==${pin("graphify", cfg)}`];
export const cavemanSource = (cfg) => `JuliusBrussee/caveman#${pin("caveman", cfg)}`;
const cavemanCmd = (cfg) => `claude plugin marketplace add ${cavemanSource(cfg)} && claude plugin install caveman@caveman`;

function installRtk(cfg) {
  if (has("rtk")) return log.ok("rtk (already installed)");
  if (skipInstalls()) return log.warn("rtk install skipped (ADS_SKIP_INSTALLS=1)");
  if (has("brew")) { run("brew", ["install", "rtk"]); if (has("rtk")) return log.ok("rtk (brew)"); }
  if (has("cargo")) { run("cargo", ["install", "--git", "https://github.com/rtk-ai/rtk", "--tag", pin("rtk", cfg), "--locked"], { timeout: 900_000 }); if (has("rtk")) return log.ok("rtk (cargo)"); }
  log.warn("rtk not installed automatically on this platform");
  todo(IS_WIN
    ? "RTK: download the Windows zip from https://github.com/rtk-ai/rtk/releases, extract, add the folder to PATH, then run: rtk init -g"
    : "RTK: install from https://github.com/rtk-ai/rtk (brew, cargo or release binary), then run: rtk init -g");
}

export function phaseCore({ dryRun, cfg = {} }) {
  log.step("core: RTK (compresses terminal output before it reaches the model)");
  if (!dryRun) {
    installRtk(cfg);
    if (has("rtk") && !skipInstalls()) {
      const r = run("rtk", ["init", "-g", "--auto-patch"]);
      r.code === 0 ? log.ok("rtk global hook in Claude Code") : log.warn("run manually: rtk init -g");
    }
  }

  log.step("core: subagents scout / builder / reviewer");
  const agentsDir = p(home(), ".claude", "agents");
  for (const f of fs.readdirSync(p(REPO, "agents"))) {
    const dst = p(agentsDir, f);
    if (dryRun) { log.ok(`(dry-run) ${f}`); continue; }
    fs.mkdirSync(agentsDir, { recursive: true });
    const src = fs.readFileSync(p(REPO, "agents", f), "utf8");
    if (fs.existsSync(dst) && fs.readFileSync(dst, "utf8") !== src) backup(dst);
    fs.writeFileSync(dst, src);
    log.ok(f);
  }

  log.step("core: agent-model-guard hook + default subagent model");
  if (!dryRun) {
    const hooksDir = p(home(), ".claude", "hooks");
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.copyFileSync(p(REPO, "hooks", "agent-model-guard.mjs"), p(hooksDir, "agent-model-guard.mjs"));
    const settings = p(home(), ".claude", "settings.json");
    backup(settings);
    mergeClaudeSettings(settings);
  }
  log.ok("PreToolUse(Agent|Task) guard + CLAUDE_CODE_SUBAGENT_MODEL=sonnet");

  log.step("core: global ~/.claude/CLAUDE.md block");
  const claudeMd = p(home(), ".claude", "CLAUDE.md");
  if (keeps(cfg, "claude-md")) log.ok("kept your own orchestration section (KEEP_EXISTING=claude-md)");
  else if (!dryRun) {
    if (fs.existsSync(claudeMd)) backup(claudeMd);
    const r = appendBlock(claudeMd, fs.readFileSync(p(REPO, "templates", "claude-global.md"), "utf8"), "BEGIN AGENTIC-DEV-STACK");
    log.ok(r === "skip" ? "already present" : `${r} (nothing removed)`);
  }

  log.step("core: token savers and SDD (caveman, Spec Kit, graphify)");
  if (dryRun) log.ok("(dry-run) would install the selected ones: caveman, Spec Kit, graphify");
  else {
    if (flag(cfg, "WITH_CAVEMAN", 1)) installCaveman(cfg);
    else todo(`caveman (optional): ${cavemanCmd(cfg)}`);
    if (flag(cfg, "WITH_SPECKIT", 1)) installUvTool("specify", speckitArgs(cfg), "Spec Kit");
    else todo(`Spec Kit (optional): uv tool install ${speckitArgs(cfg).join(" ")}`);
    if (flag(cfg, "WITH_GRAPHIFY", 1)) {
      if (installUvTool("graphify", graphifyArgs(cfg), "graphify") && !skipInstalls()) {
        run("graphify", ["install", "--platform", "claude"]).code === 0 ? log.ok("graphify skill for Claude Code (/graphify)") : todo("graphify: run `graphify install --platform claude`");
      }
    } else todo(`graphify (optional): uv tool install ${graphifyArgs(cfg)[0]} && graphify install --platform claude`);
  }
  if (!IS_MAC && !IS_WIN) todo("Linux: install bubblewrap (apt install bubblewrap) to sandbox the free-model worker");
}

// caveman: Claude Code plugin (auto-starts every session) + default intensity in ~/.config/caveman/config.json
export function writeCavemanMode(mode) {
  const f = p(home(), ".config", "caveman", "config.json");
  const c = readJSON(f);
  if (c.defaultMode === mode) return;
  backup(f);
  c.defaultMode = mode;
  writeJSON(f, c);
}

/** caveman counts as installed when any of its forms is present: the plugin, a skill copy, or its config file. */
export function cavemanInstalled() {
  const plugins = readJSON(p(home(), ".claude", "plugins", "installed_plugins.json"));
  return /"caveman@/.test(JSON.stringify(plugins.plugins || plugins))
    || [p(home(), ".claude", "skills", "caveman", "SKILL.md"), p(home(), ".agents", "skills", "caveman", "SKILL.md"), p(home(), ".config", "caveman", "config.json")].some((f) => fs.existsSync(f));
}

function installCaveman(cfg) {
  const mode = cfg.CAVEMAN_MODE || "caveman";
  writeCavemanMode(mode);
  if (skipInstalls()) return log.warn("caveman plugin install skipped (ADS_SKIP_INSTALLS=1)");
  // a hand-installed skill copy already auto-loads; adding the plugin too would run caveman twice
  if (["claude", "agents"].some((d) => fs.existsSync(p(home(), `.${d}`, "skills", "caveman", "SKILL.md")))) return log.ok(`caveman (skill already installed) · default mode ${mode}`);
  if (!has("claude")) return todo(`caveman: install Claude Code first, then: ${cavemanCmd(cfg)}`);
  const listed = run("claude", ["plugin", "list"]).out;
  if (/caveman@/.test(listed)) return log.ok(`caveman (already installed) · default mode ${mode}`);
  run("claude", ["plugin", "marketplace", "add", cavemanSource(cfg)], { timeout: 120_000 });
  const r = run("claude", ["plugin", "install", "caveman@caveman"], { timeout: 180_000 });
  r.code === 0 ? log.ok(`caveman plugin · default mode ${mode} (change: /caveman, or ~/.config/caveman/config.json)`)
    : todo(`caveman: ${cavemanCmd(cfg)}`);
}

// uv is the installer for the Python tools (Spec Kit, graphify)
export function ensureUv() {
  if (has("uv")) return true;
  if (skipInstalls()) return false;
  if (has("brew")) run("brew", ["install", "uv"], { timeout: 600_000 });
  else if (IS_WIN && has("winget")) run("winget", ["install", "-e", "--id", "astral-sh.uv", "--accept-source-agreements", "--accept-package-agreements"], { timeout: 600_000 });
  else if (!IS_WIN && has("curl")) run("sh", ["-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"], { timeout: 600_000 });
  if (!has("uv") && fs.existsSync(p(home(), ".local", "bin", IS_WIN ? "uv.exe" : "uv"))) process.env.PATH = `${p(home(), ".local", "bin")}${IS_WIN ? ";" : ":"}${process.env.PATH}`;
  return has("uv");
}

function installUvTool(bin, args, name) {
  if (has(bin)) { log.ok(`${name} (already installed)`); return true; }
  if (skipInstalls()) { log.warn(`${name} install skipped (ADS_SKIP_INSTALLS=1)`); return false; }
  if (!ensureUv()) { todo(`${name}: install uv (https://docs.astral.sh/uv/), then: uv tool install ${args.join(" ")}`); return false; }
  const r = run("uv", ["tool", "install", ...args], { timeout: 900_000 });
  if (r.code === 0) { log.ok(`${name} (uv tool)`); return true; }
  todo(`${name}: uv tool install ${args.join(" ")}  (failed automatically: ${(r.err || "").split("\n").pop()})`);
  return false;
}
