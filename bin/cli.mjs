#!/usr/bin/env node
// agentic-dev-stack CLI. Cross-platform (macOS, Linux, Windows), zero dependencies.
//   npx agentic-dev-stack install --all
import fs from "node:fs";
import { addProject, removeProject } from "../lib/add-project.mjs";
import { aletheDir, configureAlethe } from "../lib/alethe.mjs";
import { phaseCore } from "../lib/core.mjs";
import { phaseExtras, phaseFreeModels, phaseHermes, phaseWorkers } from "../lib/phases.mjs";
import { uninstall } from "../lib/uninstall.mjs";
import { newProject, wizard } from "../lib/wizard.mjs";
import { interactive } from "../lib/prompt.mjs";
import { IS_LINUX, IS_MAC, IS_WIN, REPO, TODOS, backupLocation, has, home, loadConfig, log, p, python, readJSON } from "../lib/util.mjs";

const VERSION = readJSON(p(REPO, "package.json")).version;
const HELP = `agentic-dev-stack ${VERSION}: smart vibe coding stack for Claude Code

Usage:
  agentic-dev-stack                      interactive setup (questions, like create-next-app); re-run any time
  agentic-dev-stack setup [--yes]        same; --yes accepts the recommended answers without asking
  agentic-dev-stack new [name]           create a project (optional framework + Spec Kit) already wired to the stack
  agentic-dev-stack install [phases] [--dry-run] [--config <file>]
  agentic-dev-stack add-project <dir> [--refresh | --remove] [--dry-run] [--no-docs] [--lang en|pt-BR]
  agentic-dev-stack configure-alethe [--force]
  agentic-dev-stack doctor
  agentic-dev-stack uninstall [--dry-run] [--purge]

add-project:
  (default)      append the orchestration block to CLAUDE.md/AGENTS.md (never rewrites your content)
  --refresh      regenerate only that block (re-detects gates, units, Spec Kit); run after scaffolding
  --remove       unwire the project: drop the block, the alethe link, its hooks and git-exclude lines

uninstall:       removes only what the installer created/appended (backups kept); --purge also removes
                 the alethe skill and your stack.env. Third-party tools stay installed.

Phases (install):
  --core         RTK, subagents scout/builder/reviewer, agent-model-guard hook, default subagent model, global CLAUDE.md block
  --workers      OpenCode, Antigravity CLI (agy), Codex (WITH_CODEX=1), claude-squad, sandboxed free worker, alethe + profile
  --free-models  9Router (+ autostart) and the free-model curator
  --extras       yt-dlp, uv, Headroom (WITH_HEADROOM=1)
  --hermes       Hermes Agent (hardened) + daily digest + alerts on Discord/Telegram
  --all          everything

Config: ~/.config/agentic-dev-stack/stack.env (created from config/stack.env.example on first run)
Docs:   https://github.com/Gildaciolopes/agentic-dev-stack`;

function parse(argv) {
  const a = { _: [], phases: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--all") a.phases = ["core", "workers", "free-models", "extras", "hermes"];
    else if (["--core", "--workers", "--free-models", "--extras", "--hermes"].includes(x)) a.phases.push(x.slice(2));
    else if (x === "--dry-run") a.dryRun = true;
    else if (x === "--force") a.force = true;
    else if (x === "--no-docs") a.noDocs = true;
    else if (x === "--refresh") a.refresh = true;
    else if (x === "--remove") a.remove = true;
    else if (x === "--purge") a.purge = true;
    else if (x === "--yes" || x === "-y") a.yes = true;
    else if (x === "--config") a.config = argv[++i];
    else if (x === "--lang") a.lang = argv[++i];
    else if (x === "-h" || x === "--help") a.help = true;
    else if (x === "-v" || x === "--version") a.version = true;
    else a._.push(x);
  }
  return a;
}

function preflight() {
  log.step(`Preflight (${process.platform}, node ${process.version})`);
  const [maj] = process.versions.node.split(".").map(Number);
  if (maj < 18) throw new Error("Node >= 18 required");
  for (const [cmd, why] of [["git", "required"], ["claude", "Claude Code: https://docs.claude.com/en/docs/claude-code"], ["npm", "required for npm-based tools"]])
    has(cmd) ? log.ok(cmd) : log.warn(`${cmd} not found (${why})`);
  python() ? log.ok(`python: ${python()}`) : log.warn("Python >= 3.9 not found (needed by alethe, curator and digest collector)");
}

function doctor() {
  const row = (ok, name, hint = "") => console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && hint ? `  -> ${hint}` : ""}`);
  log.step("doctor");
  const settings = readJSON(p(home(), ".claude", "settings.json"));
  const pre = JSON.stringify(settings.hooks?.PreToolUse || []);
  row(has("claude"), "Claude Code", "install Claude Code");
  row(has("rtk"), "RTK", "install --core");
  row(pre.includes("agent-model-guard"), "agent-model-guard hook", "install --core");
  row(settings.env?.CLAUDE_CODE_SUBAGENT_MODEL === "sonnet", "default subagent model = sonnet", "install --core");
  row(["scout", "builder", "reviewer"].every((a) => fs.existsSync(p(home(), ".claude", "agents", `${a}.md`))), "subagents scout/builder/reviewer", "install --core");
  row(fs.existsSync(p(aletheDir(), ".audited-commit")), "alethe (audited)", "install --workers");
  row(has("agy"), "Antigravity CLI (agy)", "optional");
  row(has("opencode"), "OpenCode", "optional");
  row(fs.existsSync(p(home(), ".local", "bin", IS_WIN ? "opencode-safe.cmd" : "opencode-safe")), "opencode-safe (sandboxed free worker)", IS_WIN ? "use WSL2" : "install --workers");
  row(has("codex"), "Codex", "optional (WITH_CODEX=1)");
  row(has("9router"), "9Router", "install --free-models");
  row(has("hermes") || fs.existsSync(p(home(), ".local", "bin", "hermes")), "Hermes Agent", "install --hermes");
  console.log(`\n  platform: ${IS_MAC ? "macOS" : IS_LINUX ? "Linux" : IS_WIN ? "Windows" : process.platform}`);
}

async function main() {
  const a = parse(process.argv.slice(2));
  const cmd = a._[0];
  if (a.version) return console.log(VERSION);
  if (a.yes) process.env.ADS_YES = "1";
  if (a.help) return console.log(HELP);
  if (!cmd || cmd === "setup") {
    if (!cmd && !interactive() && !a.yes && !process.env.ADS_ANSWERS) return console.log(HELP);
    return wizard({ version: VERSION, doctor });
  }
  if (cmd === "new") return newProject({ name: a._[1], lang: a.lang });
  const cfg = loadConfig(a.config);

  if (cmd === "install") {
    if (!a.phases.length) return console.log(HELP);
    preflight();
    // first real run: give the user an editable copy of the defaults
    const userCfg = p(home(), ".config", "agentic-dev-stack", "stack.env");
    if (!a.config && !a.dryRun && !fs.existsSync(userCfg)) {
      fs.mkdirSync(p(home(), ".config", "agentic-dev-stack"), { recursive: true });
      fs.copyFileSync(p(REPO, "config", "stack.env.example"), userCfg);
      Object.assign(cfg, loadConfig());
      log.ok(`config created: ${userCfg} (edit it and re-run to change defaults)`);
    }
    for (const ph of a.phases) {
      if (ph === "core") phaseCore({ dryRun: a.dryRun, cfg });
      if (ph === "workers") phaseWorkers(cfg, { dryRun: a.dryRun });
      if (ph === "free-models") phaseFreeModels(cfg, { dryRun: a.dryRun });
      if (ph === "extras") phaseExtras(cfg, { dryRun: a.dryRun });
      if (ph === "hermes") await phaseHermes(cfg, { dryRun: a.dryRun });
    }
    log.step("Done");
    if (backupLocation()) log.ok(`backups of edited configs: ${backupLocation()}`);
    if (TODOS.length) {
      console.log("\nManual steps (logins/keys only you can do):");
      TODOS.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
    }
    console.log(`\nConfig: ${cfg.__file}\nDocs:   https://github.com/Gildaciolopes/agentic-dev-stack/tree/main/docs`);
  } else if (cmd === "add-project") {
    if (!a._[1]) throw new Error("usage: add-project <dir>");
    if (a.remove) removeProject(a._[1], { dryRun: a.dryRun });
    else addProject(a._[1], { dryRun: a.dryRun, noDocs: a.noDocs, refresh: a.refresh, lang: a.lang || cfg.PROJECT_DOCS_LANG || "en" });
  } else if (cmd === "configure-alethe") {
    configureAlethe(cfg, { force: a.force });
  } else if (cmd === "doctor") {
    doctor();
  } else if (cmd === "uninstall") {
    uninstall({ dryRun: a.dryRun, purge: a.purge });
  } else {
    console.log(HELP);
    process.exitCode = 1;
  }
}

main().catch((e) => { log.err(e.message); process.exit(1); });
