// Uninstall: removes only what the installer created or appended (marker blocks, our hook entries,
// our files, our schedules). Your own content is never touched; every edited file is backed up first.
// Third-party tools (rtk, opencode, agy, 9router, hermes, codex) stay installed: the end of the run
// prints how to remove each one.
import fs from "node:fs";
import { aletheDir } from "./alethe.mjs";
import { GUARD_MARK } from "./core.mjs";
import { unschedule } from "./schedule.mjs";
import { IS_LINUX, IS_MAC, IS_WIN, REPO, backup, backupLocation, has, home, log, p, readJSON, removeBlock, run, skipInstalls, writeJSON } from "./util.mjs";

const DATA = () => p(home(), ".local", "share", "agentic-dev-stack");
const LABELS = ["com.agentic-dev-stack.model-curator", "com.agentic-dev-stack.daily-digest"];

export function cleanClaudeSettings(file, { dryRun = false } = {}) {
  if (!fs.existsSync(file)) return false;
  const c = readJSON(file);
  const before = JSON.stringify(c);
  if (c.hooks?.PreToolUse) {
    for (const e of c.hooks.PreToolUse) e.hooks = (e.hooks || []).filter((h) => !String(h.command || "").includes(GUARD_MARK));
    c.hooks.PreToolUse = c.hooks.PreToolUse.filter((e) => e.hooks.length);
    if (!c.hooks.PreToolUse.length) delete c.hooks.PreToolUse;
    if (!Object.keys(c.hooks).length) delete c.hooks;
  }
  // only remove the value we set; a different value means the user chose it
  if (c.env?.CLAUDE_CODE_SUBAGENT_MODEL === "sonnet") delete c.env.CLAUDE_CODE_SUBAGENT_MODEL;
  if (c.env && !Object.keys(c.env).length) delete c.env;
  if (JSON.stringify(c) === before) return false;
  if (dryRun) return true;
  backup(file);
  writeJSON(file, c);
  return true;
}

export function uninstall({ dryRun = false, purge = false } = {}) {
  const tag = dryRun ? "(dry-run) " : "";
  const rm = (f, label = f) => {
    if (!fs.existsSync(f)) return;
    if (!dryRun) fs.rmSync(f, { recursive: true, force: true });
    log.ok(`${tag}removed ${label}`);
  };

  log.step("uninstall: Claude Code (global)");
  const claudeMd = p(home(), ".claude", "CLAUDE.md");
  const r = removeBlock(claudeMd, "<!-- BEGIN AGENTIC-DEV-STACK -->", "<!-- END AGENTIC-DEV-STACK -->", { dryRun });
  log.ok(`${tag}~/.claude/CLAUDE.md: ${r === "missing" ? "no block (nothing to do)" : r}`);
  const settings = p(home(), ".claude", "settings.json");
  log.ok(`${tag}~/.claude/settings.json: ${cleanClaudeSettings(settings, { dryRun }) ? "guard hook + default subagent model removed" : "nothing to do"}`);
  rm(p(home(), ".claude", "hooks", "agent-model-guard.mjs"), "~/.claude/hooks/agent-model-guard.mjs");
  for (const a of ["scout", "builder", "reviewer"]) {
    const f = p(home(), ".claude", "agents", `${a}.md`);
    if (!fs.existsSync(f)) continue;
    // a subagent you edited is yours now: keep it
    if (fs.readFileSync(f, "utf8") === fs.readFileSync(p(REPO, "agents", `${a}.md`), "utf8")) rm(f, `~/.claude/agents/${a}.md`);
    else log.warn(`kept ~/.claude/agents/${a}.md (you edited it)`);
  }

  log.step("uninstall: schedules and autostart");
  for (const l of LABELS) { if (!dryRun && !skipInstalls()) unschedule(l); log.ok(`${tag}schedule ${l}`); }
  if (!dryRun && !skipInstalls()) {
    if (IS_MAC) {
      run("launchctl", ["bootout", `gui/${process.getuid()}/com.agentic-dev-stack.9router`]);
      fs.rmSync(p(home(), "Library", "LaunchAgents", "com.agentic-dev-stack.9router.plist"), { force: true });
    } else if (IS_LINUX && has("systemctl")) {
      run("systemctl", ["--user", "disable", "--now", "agentic-dev-stack-9router.service"]);
      fs.rmSync(p(home(), ".config", "systemd", "user", "agentic-dev-stack-9router.service"), { force: true });
    } else if (IS_WIN) run("schtasks", ["/Delete", "/F", "/TN", "agentic-dev-stack-9router"], { noShell: true });
  }
  log.ok(`${tag}9Router autostart`);

  log.step("uninstall: free-worker sandbox and scripts");
  rm(p(home(), ".local", "bin", IS_WIN ? "opencode-safe.cmd" : "opencode-safe"), "~/.local/bin/opencode-safe");
  rm(p(home(), ".config", "agentic-dev-stack", "deny-secrets.sb"), "sandbox profile");
  rm(p(DATA(), "model-curator"), "model curator");
  rm(p(DATA(), "daily-digest"), "digest collector");
  if (purge) {
    rm(aletheDir(), "alethe skill (~/.agents/skills/alethe)");
    rm(p(home(), ".config", "agentic-dev-stack", "stack.env"), "stack.env");
  }

  log.step("Done");
  if (backupLocation()) log.ok(`backups of every edited file: ${backupLocation()}`);
  console.log(`
Kept on purpose (remove manually if you want):
  - projects wired with add-project  -> npx agentic-dev-stack add-project <dir> --remove
  - Hermes routines                  -> hermes cron list, then remove daily-digest and combo-alert
  - RTK hook                         -> rtk init -g --uninstall
  - tools                            -> npm rm -g 9router opencode-ai @openai/codex · brew uninstall rtk · see each tool's docs for agy/Hermes
  - OpenCode permissions             -> "permission" key in ~/.config/opencode/opencode.json
  - backups and logs                 -> ${DATA()}${purge ? "" : "\n  - alethe skill + your stack.env    -> run again with --purge"}`);
}
