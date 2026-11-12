// doctor: what is installed and healthy, judged against what the user enabled in stack.env.
// doctor --fix: re-runs only the phases that own a failing check (idempotent; backups as usual), recreates the
// 9Router 'free' combo when the provider exists, then checks again.
import fs from "node:fs";
import { aletheDir } from "./alethe.mjs";
import { phaseCore } from "./core.mjs";
import { configure9Router, status9Router } from "./ninerouter.mjs";
import { phaseExtras, phaseFreeModels, phaseHermes, phaseWorkers } from "./phases.mjs";
import { isScheduled } from "./schedule.mjs";
import { IS_LINUX, IS_MAC, IS_WIN, TODOS, flag, has, home, keeps, loadConfig, log, p, readJSON, skipInstalls } from "./util.mjs";

const PHASES = { core: phaseCore, workers: phaseWorkers, "free-models": phaseFreeModels, extras: phaseExtras, hermes: phaseHermes };

// ok: true | false | null (unknown / not applicable). fix: phase name, "combo", or undefined (only the user can fix it)
async function checks(cfg) {
  const settings = readJSON(p(home(), ".claude", "settings.json"));
  const pre = JSON.stringify(settings.hooks?.PreToolUse || []);
  const claudeMd = p(home(), ".claude", "CLAUDE.md");
  const on = (k, d) => flag(cfg, k, d);
  const workers = on("WITH_AGY", 1) || on("WITH_OPENCODE", 1) || on("WITH_CODEX", 0);
  const free = on("WITH_FREE_MODELS", 1), hermes = on("WITH_HERMES", 1) && !IS_WIN;
  const nr = free && has("9router") && !skipInstalls() ? await status9Router() : null;
  const sched = (label, keepId) => (keeps(cfg, keepId) ? true : isScheduled(label));
  const c = [
    { name: "Claude Code", ok: has("claude"), hint: "install Claude Code: https://docs.claude.com/en/docs/claude-code" },
    { name: "RTK", ok: has("rtk"), fix: "core" },
    { name: "agent-model-guard hook", ok: pre.includes("agent-model-guard"), fix: "core" },
    { name: "default subagent model = sonnet", ok: settings.env?.CLAUDE_CODE_SUBAGENT_MODEL === "sonnet", fix: "core" },
    { name: "subagents scout/builder/reviewer", ok: ["scout", "builder", "reviewer"].every((a) => fs.existsSync(p(home(), ".claude", "agents", `${a}.md`))), fix: "core" },
    { name: "orchestration block in ~/.claude/CLAUDE.md", ok: keeps(cfg, "claude-md") || (fs.existsSync(claudeMd) && fs.readFileSync(claudeMd, "utf8").includes("BEGIN AGENTIC-DEV-STACK")), fix: "core" },
    { name: "caveman", off: !on("WITH_CAVEMAN", 1), ok: fs.existsSync(p(home(), ".config", "caveman", "config.json")), fix: "core" },
    { name: "Spec Kit (specify)", off: !on("WITH_SPECKIT", 1), ok: has("specify"), fix: "core" },
    { name: "graphify", off: !on("WITH_GRAPHIFY", 1), ok: has("graphify"), fix: "core" },
    { name: "alethe (audited)", off: !workers, ok: fs.existsSync(p(aletheDir(), ".audited-commit")), fix: "workers" },
    { name: "Antigravity CLI (agy)", off: !on("WITH_AGY", 1), ok: has("agy"), fix: "workers", hint: "https://antigravity.google/product/antigravity-cli" },
    { name: "OpenCode", off: !on("WITH_OPENCODE", 1), ok: has("opencode"), fix: "workers" },
    { name: "opencode-safe (sandboxed free worker)", off: !on("WITH_OPENCODE", 1), ok: fs.existsSync(p(home(), ".local", "bin", IS_WIN ? "opencode-safe.cmd" : "opencode-safe")), fix: IS_WIN ? undefined : "workers", hint: IS_WIN ? "use WSL2" : "" },
    { name: "Codex", off: !on("WITH_CODEX", 0), ok: has("codex"), fix: "workers" },
    { name: "9Router", off: !free, ok: has("9router"), fix: "free-models" },
    { name: "9Router running", off: !free, ok: nr ? nr.up : null, hint: "start it: 9router (autostart: doctor --fix after enabling free models)" },
    { name: "NVIDIA NIM provider in 9Router", off: !free, ok: nr?.up ? !!nr.nvidia : null, hint: "npx agentic-dev-stack -> Change settings (asks for the free key)" },
    { name: "combo 'free'", off: !free, ok: nr?.up ? !!nr.free : null, fix: nr?.nvidia ? "combo" : undefined },
    { name: "curator scheduled", off: !free, ok: sched("com.agentic-dev-stack.model-curator", "curator"), fix: "free-models" },
    { name: "Hermes Agent", off: !hermes, ok: has("hermes") || fs.existsSync(p(home(), ".local", "bin", "hermes")), fix: "hermes" },
    { name: "digest collector scheduled", off: !hermes, ok: sched("com.agentic-dev-stack.daily-digest", "collector"), fix: "hermes" },
  ];
  return c;
}

function print(list) {
  for (const x of list) {
    const mark = x.off ? "·" : x.ok === true ? "✓" : x.ok === false ? "✗" : "–";
    const tail = x.off ? "  (disabled)" : x.ok === false ? `  -> ${x.fix && x.fix !== "combo" ? `doctor --fix (install --${x.fix})` : x.fix === "combo" ? "doctor --fix" : x.hint || "see docs/08-troubleshooting.md"}` : x.ok === null ? "  (unknown here)" : "";
    console.log(`  ${mark} ${x.name}${tail}`);
  }
  console.log(`\n  platform: ${IS_MAC ? "macOS" : IS_LINUX ? "Linux" : IS_WIN ? "Windows" : process.platform}`);
}

export async function doctor({ fix = false, cfg = loadConfig(undefined, { noCopy: true }) } = {}) {
  log.step("doctor");
  let list = await checks(cfg);
  print(list);
  const bad = list.filter((x) => !x.off && x.ok === false);
  if (!fix) {
    if (bad.some((x) => x.fix)) console.log("\n  Fix what can be fixed automatically: npx agentic-dev-stack doctor --fix");
    return bad;
  }
  const phases = [...new Set(bad.map((x) => x.fix).filter((f) => PHASES[f]))];
  if (!phases.length && !bad.some((x) => x.fix === "combo")) { log.ok(bad.length ? "nothing here can be fixed automatically (see the hints above)" : "nothing to fix"); return bad; }
  for (const ph of ["core", "workers", "free-models", "extras", "hermes"].filter((x) => phases.includes(x))) {
    log.step(`fix: re-running ${ph}`);
    // secrets: empty strings = never prompt again for bot tokens / user IDs (they are already saved, or set in the wizard)
    await PHASES[ph](ph === "core" ? { dryRun: false, cfg } : cfg, { dryRun: false, secrets: { uid: "", token: "" } });
  }
  if (bad.some((x) => x.fix === "combo")) {
    log.step("fix: 9Router combo 'free'");
    try { for (const line of await configure9Router({})) log.ok(line); } catch (e) { log.warn(e.message); }
  }
  log.step("doctor (after fix)");
  list = await checks(cfg);
  print(list);
  if (TODOS.length) { console.log("\nManual steps:"); TODOS.forEach((t, i) => console.log(`  ${i + 1}. ${t}`)); }
  return list.filter((x) => !x.off && x.ok === false);
}
