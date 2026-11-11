// Phase "core": RTK, subagents, agent-model-guard, default subagent model, global CLAUDE.md block.
import fs from "node:fs";
import { IS_MAC, IS_WIN, REPO, appendBlock, backup, has, home, log, p, readJSON, run, skipInstalls, todo, writeJSON } from "./util.mjs";

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

function installRtk() {
  if (has("rtk")) return log.ok("rtk (already installed)");
  if (skipInstalls()) return log.warn("rtk install skipped (ADS_SKIP_INSTALLS=1)");
  if (has("brew")) { run("brew", ["install", "rtk"]); if (has("rtk")) return log.ok("rtk (brew)"); }
  if (has("cargo")) { run("cargo", ["install", "--git", "https://github.com/rtk-ai/rtk"], { timeout: 900_000 }); if (has("rtk")) return log.ok("rtk (cargo)"); }
  log.warn("rtk not installed automatically on this platform");
  todo(IS_WIN
    ? "RTK: download the Windows zip from https://github.com/rtk-ai/rtk/releases, extract, add the folder to PATH, then run: rtk init -g"
    : "RTK: install from https://github.com/rtk-ai/rtk (brew, cargo or release binary), then run: rtk init -g");
}

export function phaseCore({ dryRun }) {
  log.step("core: RTK (compresses terminal output before it reaches the model)");
  if (!dryRun) {
    installRtk();
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
  if (!dryRun) {
    if (fs.existsSync(claudeMd)) backup(claudeMd);
    const r = appendBlock(claudeMd, fs.readFileSync(p(REPO, "templates", "claude-global.md"), "utf8"), "BEGIN AGENTIC-DEV-STACK");
    log.ok(r === "skip" ? "already present" : `${r} (nothing removed)`);
  }

  todo("caveman (inside claude): /plugin marketplace add JuliusBrussee/caveman  ->  /plugin install caveman  ->  /caveman ultra");
  todo("Spec Kit (SDD): uv tool install specify-cli --from git+https://github.com/github/spec-kit.git  ->  specify init <project>");
  todo("graphify (code knowledge graph): see https://github.com/safishamsi/graphify  ->  /graphify inside each project");
  if (!IS_MAC && !IS_WIN) todo("Linux: install bubblewrap (apt install bubblewrap) to sandbox the free-model worker");
}
