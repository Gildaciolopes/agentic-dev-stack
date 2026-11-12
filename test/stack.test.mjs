// Cross-platform tests (node --test). Run in CI on ubuntu, macos and windows.
// Everything happens inside a throwaway HOME (ADS_HOME); nothing third-party is downloaded.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "ads-home-"));
process.env.ADS_HOME = HOME;
process.env.ADS_SKIP_INSTALLS = "1";
process.env.NO_COLOR = "1";

const { decide } = await import("../hooks/agent-model-guard.mjs");
const { appendBlock, loadConfig } = await import("../lib/util.mjs");
const { mergeClaudeSettings, phaseCore } = await import("../lib/core.mjs");
const { addProject, detectGates, detectUnits, removeProject } = await import("../lib/add-project.mjs");

const cli = (...args) => spawnSync(process.execPath, [path.join(REPO, "bin", "cli.mjs"), ...args],
  { encoding: "utf8", env: { ...process.env, ADS_HOME: HOME, ADS_SKIP_INSTALLS: "1", NO_COLOR: "1" } });
const git = (cwd, ...a) => spawnSync("git", a, { cwd, encoding: "utf8" });

test("agent-model-guard denies Opus-bound subagents and allows cheap ones", () => {
  const deny = (ti) => decide({ tool_input: ti }, {})?.hookSpecificOutput?.permissionDecision === "deny";
  assert.equal(deny({ subagent_type: "Explore" }), true);
  assert.equal(deny({}), true, "missing type defaults to general-purpose");
  assert.equal(deny({ subagent_type: "general-purpose", model: "opus" }), true);
  assert.equal(deny({ subagent_type: "fork" }), true);
  assert.equal(deny({ subagent_type: "general-purpose", model: "sonnet" }), false);
  assert.equal(deny({ subagent_type: "Explore", model: "haiku" }), false);
  assert.equal(deny({ subagent_type: "scout" }), false);
  assert.equal(decide({ tool_input: { subagent_type: "Explore" } }, { ALLOW_OPUS_SUBAGENT: "1" }), null);
});

test("agent-model-guard works as a real hook process (stdin -> stdout)", () => {
  const r = spawnSync(process.execPath, [path.join(REPO, "hooks", "agent-model-guard.mjs")], { input: JSON.stringify({ tool_input: { subagent_type: "Plan" } }), encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /"permissionDecision":"deny"/);
  const ok = spawnSync(process.execPath, [path.join(REPO, "hooks", "agent-model-guard.mjs")], { input: JSON.stringify({ tool_input: { subagent_type: "builder" } }), encoding: "utf8" });
  assert.equal(ok.stdout, "");
});

test("settings merge preserves user keys, is idempotent and replaces old guard entries", () => {
  const f = path.join(HOME, "settings-test.json");
  fs.writeFileSync(f, JSON.stringify({ theme: "dark", hooks: { PreToolUse: [
    { matcher: "Bash", hooks: [{ type: "command", command: "rtk hook claude" }] },
    { matcher: "Agent|Task", hooks: [{ type: "command", command: "python3 -I /old/agent-model-guard.py" }] }] } }));
  mergeClaudeSettings(f);
  const c = mergeClaudeSettings(f);
  assert.equal(c.theme, "dark");
  assert.equal(c.env.CLAUDE_CODE_SUBAGENT_MODEL, "sonnet");
  const guards = JSON.stringify(c.hooks.PreToolUse).match(/agent-model-guard/g) || [];
  assert.equal(guards.length, 1, "exactly one guard entry");
  assert.match(JSON.stringify(c.hooks.PreToolUse), /agent-model-guard\.mjs/);
  assert.match(JSON.stringify(c.hooks.PreToolUse), /rtk hook claude/);
});

test("appendBlock never rewrites existing content and skips when present", () => {
  const f = path.join(HOME, "CLAUDE-test.md");
  fs.writeFileSync(f, "# mine\nkeep me\n");
  assert.equal(appendBlock(f, "<!-- BEGIN X -->\nblock\n<!-- END X -->", "BEGIN X"), "appended");
  assert.equal(appendBlock(f, "<!-- BEGIN X -->\nblock\n<!-- END X -->", "BEGIN X"), "skip");
  const s = fs.readFileSync(f, "utf8");
  assert.ok(s.startsWith("# mine\nkeep me\n"));
  assert.equal(s.match(/BEGIN X/g).length, 1);
});

test("config loads defaults and expands $HOME", () => {
  const cfg = loadConfig();
  assert.equal(cfg.ALETHE_COMMIT, "ab81104");
  assert.ok(cfg.PROJECTS_DIR.startsWith(HOME));
  assert.equal(cfg.WITH_CODEX, "0");
});

test("install --core (real run in fake HOME) is idempotent", () => {
  for (let i = 0; i < 2; i++) {
    const r = cli("install", "--core");
    assert.equal(r.status, 0, r.stderr + r.stdout);
  }
  for (const a of ["scout", "builder", "reviewer"]) assert.ok(fs.existsSync(path.join(HOME, ".claude", "agents", `${a}.md`)));
  assert.ok(fs.existsSync(path.join(HOME, ".claude", "hooks", "agent-model-guard.mjs")));
  assert.ok(fs.existsSync(path.join(HOME, ".config", "agentic-dev-stack", "stack.env")), "editable config created");
  const md = fs.readFileSync(path.join(HOME, ".claude", "CLAUDE.md"), "utf8");
  assert.equal(md.match(/BEGIN AGENTIC-DEV-STACK/g).length, 1);
  const s = JSON.parse(fs.readFileSync(path.join(HOME, ".claude", "settings.json"), "utf8"));
  assert.equal(JSON.stringify(s).match(/agent-model-guard/g).length, 1);
});

test("install --all --dry-run touches nothing and exits 0", () => {
  const r = cli("install", "--all", "--dry-run");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /dry-run/);
});

test("add-project detects gates/units and wires a git repo", () => {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "ads-proj-"));
  fs.mkdirSync(path.join(proj, "apps", "web"), { recursive: true });
  fs.writeFileSync(path.join(proj, "package.json"), JSON.stringify({ scripts: { test: "x", lint: "y", typecheck: "z", build: "b" } }));
  fs.writeFileSync(path.join(proj, "pnpm-lock.yaml"), "");
  fs.writeFileSync(path.join(proj, "CLAUDE.md"), "# existing rules\n");
  git(proj, "init", "-q");
  const gates = detectGates(proj, [proj]).join("\n");
  assert.match(gates, /pnpm test/);
  assert.match(gates, /pnpm typecheck/);
  assert.doesNotMatch(gates, /build/);
  assert.match(detectUnits(proj, [proj]).join("\n"), /apps\/\*/);
  // fake alethe install so wiring can run without network
  fs.mkdirSync(path.join(HOME, ".agents", "skills", "alethe", "scripts"), { recursive: true });
  fs.writeFileSync(path.join(HOME, ".agents", "skills", "alethe", "scripts", "hook.py"), "");
  addProject(proj, {});
  addProject(proj, {});
  const md = fs.readFileSync(path.join(proj, "CLAUDE.md"), "utf8");
  assert.ok(md.startsWith("# existing rules\n"));
  assert.equal(md.match(/BEGIN ALETHE ORCHESTRATION/g).length, 1);
  assert.ok(fs.existsSync(path.join(proj, "AGENTS.md")));
  const local = JSON.parse(fs.readFileSync(path.join(proj, ".claude", "settings.local.json"), "utf8"));
  assert.equal(local.hooks.UserPromptSubmit.length, 1);
  const exclude = fs.readFileSync(path.join(proj, ".git", "info", "exclude"), "utf8");
  assert.match(exclude, /\.claude\/skills\/alethe/);
  assert.match(exclude, /\.alethe\//);
});

test("add-project --lang pt-BR uses Portuguese templates", () => {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "ads-proj-pt-"));
  git(proj, "init", "-q");
  addProject(proj, { lang: "pt-BR" });
  assert.match(fs.readFileSync(path.join(proj, "CLAUDE.md"), "utf8"), /Orquestração multi-agente/);
});

test("add-project --refresh regenerates only the block; --remove unwires the project", () => {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "ads-proj-rf-"));
  git(proj, "init", "-q");
  fs.writeFileSync(path.join(proj, "CLAUDE.md"), "# keep me\n");
  addProject(proj, {});
  const first = fs.readFileSync(path.join(proj, "CLAUDE.md"), "utf8");
  assert.doesNotMatch(first, /pnpm test/);
  // project gets scaffolded after wiring -> refresh picks up the new gates
  fs.writeFileSync(path.join(proj, "package.json"), JSON.stringify({ scripts: { test: "x" } }));
  fs.writeFileSync(path.join(proj, "pnpm-lock.yaml"), "");
  fs.appendFileSync(path.join(proj, "CLAUDE.md"), "\n## my notes after the block\n");
  addProject(proj, { refresh: true });
  const md = fs.readFileSync(path.join(proj, "CLAUDE.md"), "utf8");
  assert.ok(md.startsWith("# keep me\n"));
  assert.match(md, /pnpm test/);
  assert.match(md, /## my notes after the block/);
  assert.equal(md.match(/BEGIN ALETHE ORCHESTRATION/g).length, 1);

  removeProject(proj, {});
  assert.equal(fs.readFileSync(path.join(proj, "CLAUDE.md"), "utf8"), "# keep me\n\n## my notes after the block\n");
  assert.equal(fs.existsSync(path.join(proj, "AGENTS.md")), false, "AGENTS.md we created is gone");
  assert.equal(fs.existsSync(path.join(proj, ".claude", "skills", "alethe")), false);
  assert.equal(fs.existsSync(path.join(proj, ".claude", "settings.local.json")), false);
  assert.doesNotMatch(fs.readFileSync(path.join(proj, ".git", "info", "exclude"), "utf8"), /alethe/);
});

test("uninstall removes only what the installer added", () => {
  const md = path.join(HOME, ".claude", "CLAUDE.md");
  fs.writeFileSync(md, "# mine\nkeep\n\n" + fs.readFileSync(md, "utf8"));
  const sf = path.join(HOME, ".claude", "settings.json");
  fs.writeFileSync(sf, JSON.stringify({ ...JSON.parse(fs.readFileSync(sf, "utf8")), theme: "dark" }));
  fs.appendFileSync(path.join(HOME, ".claude", "agents", "builder.md"), "\nmy tweak\n");
  const dry = cli("uninstall", "--dry-run");
  assert.equal(dry.status, 0, dry.stderr + dry.stdout);
  assert.match(fs.readFileSync(md, "utf8"), /BEGIN AGENTIC-DEV-STACK/, "dry-run changes nothing");
  const r = cli("uninstall");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(fs.readFileSync(md, "utf8"), "# mine\nkeep\n");
  const s = JSON.parse(fs.readFileSync(sf, "utf8"));
  assert.equal(s.theme, "dark");
  assert.doesNotMatch(JSON.stringify(s), /agent-model-guard|CLAUDE_CODE_SUBAGENT_MODEL/);
  assert.equal(fs.existsSync(path.join(HOME, ".claude", "agents", "scout.md")), false);
  assert.ok(fs.existsSync(path.join(HOME, ".claude", "agents", "builder.md")), "edited subagent is kept");
  assert.equal(fs.existsSync(path.join(HOME, ".claude", "hooks", "agent-model-guard.mjs")), false);
  assert.ok(fs.readdirSync(path.join(HOME, ".local", "share", "agentic-dev-stack", "backups")).length > 0);
});

// ---- setup wizard (non-interactive: answers file), each run in its own fresh HOME
function freshHome() {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "ads-wiz-"));
  fs.mkdirSync(path.join(h, ".agents", "skills", "alethe", "scripts"), { recursive: true });
  fs.writeFileSync(path.join(h, ".agents", "skills", "alethe", "scripts", "hook.py"), "");
  return h;
}
const cliIn = (h, answers, ...args) => {
  const af = path.join(h, "answers.json");
  fs.writeFileSync(af, JSON.stringify(answers));
  return spawnSync(process.execPath, [path.join(REPO, "bin", "cli.mjs"), ...args],
    { encoding: "utf8", env: { ...process.env, ADS_HOME: h, ADS_SKIP_INSTALLS: "1", NO_COLOR: "1", ADS_ANSWERS: af } });
};

test("setup wizard saves every answer, installs and wires the picked projects", () => {
  const h = freshHome();
  const pd = path.join(h, "projects");
  for (const d of ["a", "b"]) { fs.mkdirSync(path.join(pd, d), { recursive: true }); git(path.join(pd, d), "init", "-q"); }
  const r = cliIn(h, { lang: "pt-BR", preset: "custom", components: ["caveman", "speckit", "hermes"], caveman_mode: "ultracave", platform: "none",
    digest_time: "07:30", digest_sections: ["models", "plan"], summary_language: "Português do Brasil", timezone: "UTC",
    projects_dir: pd, docs_lang: "pt-BR", projects: [path.join(pd, "a")], git_email: "dev@example.com", confirm: true }, "setup");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const env = fs.readFileSync(path.join(h, ".config", "agentic-dev-stack", "stack.env"), "utf8");
  for (const kv of ['WITH_CAVEMAN=1', 'WITH_GRAPHIFY=0', 'WITH_HERMES=1', 'WITH_FREE_MODELS=0', 'CAVEMAN_MODE="ultracave"', 'DIGEST_SEND_TIME="07:30"',
    'DIGEST_COLLECT_TIME="07:20"', 'DIGEST_SECTIONS="models,plan"', 'PROJECT_DOCS_LANG="pt-BR"', 'WIZARD_LANG="pt-BR"']) assert.ok(env.includes(kv), `missing ${kv}`);
  assert.match(env, /^# Where your projects live/m, "comments from the example are kept");
  assert.equal(JSON.parse(fs.readFileSync(path.join(h, ".config", "caveman", "config.json"), "utf8")).defaultMode, "ultracave");
  assert.match(fs.readFileSync(path.join(pd, "a", "CLAUDE.md"), "utf8"), /Orquestração multi-agente/);
  assert.equal(fs.existsSync(path.join(pd, "b", "CLAUDE.md")), false, "unpicked project untouched");
  assert.ok(fs.existsSync(path.join(h, ".claude", "agents", "scout.md")));

  // second run: "update" replays the saved answers without asking anything
  const u = cliIn(h, { lang: "en", action: "update" }, "setup");
  assert.equal(u.status, 0, u.stderr + u.stdout);
  assert.match(u.stdout, /CLAUDE\.md: unchanged/);
});

test("setup wizard: declining the summary leaves no trace", () => {
  const h = freshHome();
  const r = cliIn(h, { lang: "en", preset: "savers", projects_dir_text: h, docs_lang: "en", confirm: false }, "setup");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(fs.existsSync(path.join(h, ".config", "agentic-dev-stack", "stack.env")), false);
  assert.equal(fs.existsSync(path.join(h, ".claude")), false);
});

test("new: creates a git repo already wired to the stack", () => {
  const h = freshHome();
  const r = cliIn(h, { new_parent: path.join(h, "code"), new_scaffold: "none", new_speckit: false }, "new", "shop");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const dir = path.join(h, "code", "shop");
  assert.ok(fs.existsSync(path.join(dir, ".git")));
  assert.match(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8"), /BEGIN ALETHE ORCHESTRATION/);
  assert.match(fs.readFileSync(path.join(h, ".config", "agentic-dev-stack", "projects.list"), "utf8"), /shop/);
});

test("9Router helpers: local CLI token and model ranking", async () => {
  const { cliToken, rankModels } = await import("../lib/ninerouter.mjs");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "ads-9r-"));
  process.env.NINEROUTER_DATA_DIR = d;
  assert.equal(cliToken(), null, "no files -> no token");
  fs.mkdirSync(path.join(d, "auth"));
  fs.writeFileSync(path.join(d, "machine-id"), "m1\n");
  fs.writeFileSync(path.join(d, "auth", "cli-secret"), "s1\n");
  const { createHash } = await import("node:crypto");
  assert.equal(cliToken(), createHash("sha256").update("m1" + "9r-cli-auth" + "s1").digest("hex").slice(0, 16));
  delete process.env.NINEROUTER_DATA_DIR;
  assert.deepEqual(rankModels(["meta/llama-3.1-8b-instruct", "qwen/qwen3-32b", "moonshotai/kimi-k2.6", "nvidia/nemotron-3-ultra-550b", "x/embed-qa"], 2),
    ["nvidia/nvidia/nemotron-3-ultra-550b", "nvidia/moonshotai/kimi-k2.6"]);
});

test("wizard in a real terminal: arrows, space, typing (pty, macOS/Linux)", { skip: process.platform === "win32" }, () => {
  const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
  if (!py) return;
  const r = spawnSync(py, ["-I", path.join(REPO, "test", "tty_wizard.py"), REPO, freshHome()], { encoding: "utf8", timeout: 180_000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /tty wizard ok/);
});

test("adopt: finds a hand-made setup; replace backs it up and disables it, keep is saved", async () => {
  const { classifyCommand, findOrchestrationSection } = await import("../lib/adopt.mjs");
  assert.equal(classifyCommand("/usr/bin/python3 -I /Users/x/.local/share/model-curator/curate.py"), "curator");
  assert.equal(classifyCommand("python3 -I ~/.local/share/daily-digest/collect.py"), "collector");
  assert.equal(classifyCommand("/usr/local/bin/node /x/node_modules/9router/cli.js --tray"), "9router-autostart");
  assert.equal(classifyCommand("python3 ~/.local/share/agentic-dev-stack/model-curator/curate.py"), null, "ours never matches");
  assert.equal(classifyCommand("/usr/bin/hermes gateway run"), null);
  const md = "# Mine\nkeep\n\n# Orchestration — plan big, execute small\n- old rule\n\n# graphify\n- g\n";
  const at = findOrchestrationSection(md);
  assert.equal(md.slice(0, at[0]) + md.slice(at[1]), "# Mine\nkeep\n\n# graphify\n- g\n");
  assert.equal(findOrchestrationSection("<!-- BEGIN AGENTIC-DEV-STACK -->\n# Orchestration: plan big, execute small\n<!-- END AGENTIC-DEV-STACK -->\n"), null, "our block is not foreign");
  const { cutSection } = await import("../lib/adopt.mjs");
  const tpl = fs.readFileSync(path.join(REPO, "templates", "claude-global.md"), "utf8");
  const mixed = "# Mine\na\n\n\n\nb\n\n# Orchestration — plan big, execute small\n- old\n```sh\n# not a heading\n```\n- old2\n\n" + tpl;
  const cut = cutSection(mixed, findOrchestrationSection(mixed));
  assert.equal(cut, "# Mine\na\n\n\n\nb\n\n" + tpl, "section right before the stack block: block intact, fenced '#' skipped, other blank lines untouched");
  assert.equal(classifyCommand("python3 /x/accurate.py"), null);
  assert.equal(classifyCommand("curl http://x/9router-backup"), null);
  assert.equal(classifyCommand("9router --skip-update"), "9router-autostart");

  const h = freshHome();
  fs.mkdirSync(path.join(h, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(h, ".claude", "CLAUDE.md"), md);
  fs.mkdirSync(path.join(h, ".hermes", "cron"), { recursive: true });
  fs.writeFileSync(path.join(h, ".hermes", "cron", "jobs.json"), JSON.stringify({ jobs: [
    { id: "aaa111", name: "resumo", prompt: `Leia ${h}/.hermes/workspace/daily/ e resuma`, schedule: { display: "0 8 * * *" } },
    { id: "bbb222", name: "aviso", prompt: `Leia ${h}/.local/share/model-curator/status.json`, schedule: { display: "35 7 * * *" } },
    { id: "ccc333", name: "other", prompt: "unrelated" }] }));
  let plist;
  if (process.platform === "darwin") {
    plist = path.join(h, "Library", "LaunchAgents", "com.me.model-curator.plist");
    fs.mkdirSync(path.dirname(plist), { recursive: true });
    fs.writeFileSync(plist, `<?xml version="1.0"?><plist><dict><key>Label</key><string>com.me.model-curator</string><key>ProgramArguments</key><array><string>/usr/bin/python3</string><string>${h}/.local/share/model-curator/curate.py</string></array></dict></plist>`);
  }
  const dry = cliIn(h, {}, "adopt", "--dry-run");
  assert.equal(dry.status, 0, dry.stderr + dry.stdout);
  assert.match(dry.stdout, /resumo/);
  assert.match(dry.stdout, /aviso/);
  assert.doesNotMatch(dry.stdout, /other/);
  assert.equal(fs.readFileSync(path.join(h, ".claude", "CLAUDE.md"), "utf8"), md, "dry-run changes nothing");

  const r = cliIn(h, { adopt_digest: "replace", "adopt_combo-alert": "keep", "adopt_claude-md": "replace", adopt_curator: "replace" }, "adopt");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(fs.readFileSync(path.join(h, ".claude", "CLAUDE.md"), "utf8"), "# Mine\nkeep\n\n# graphify\n- g\n", "only the duplicate section left");
  if (plist) assert.equal(fs.existsSync(plist), false, "replaced launchd job removed");
  const env = fs.readFileSync(path.join(h, ".config", "agentic-dev-stack", "stack.env"), "utf8");
  assert.match(env, /^KEEP_EXISTING="combo-alert"$/m);
  const backups = path.join(h, ".local", "share", "agentic-dev-stack", "backups");
  const all = fs.readdirSync(backups, { recursive: true }).map(String);
  assert.ok(all.some((f) => f.endsWith("CLAUDE.md")) && all.some((f) => f.endsWith("jobs.json")), "originals backed up");

  // kept -> the stack skips its own copy; not asked again on the next wizard run
  const { keeps } = await import("../lib/util.mjs");
  assert.equal(keeps({ KEEP_EXISTING: "combo-alert,curator" }, "curator"), true);
  assert.equal(keeps({ KEEP_EXISTING: "combo-alert" }, "digest"), false);
});

test("doctor --fix re-runs only the broken phases and checks again", () => {
  const h = freshHome();
  fs.mkdirSync(path.join(h, ".config", "agentic-dev-stack"), { recursive: true });
  fs.writeFileSync(path.join(h, ".config", "agentic-dev-stack", "stack.env"),
    "WITH_AGY=0\nWITH_OPENCODE=0\nWITH_CODEX=0\nWITH_FREE_MODELS=0\nWITH_HERMES=0\nWITH_SPECKIT=0\nWITH_GRAPHIFY=0\nWITH_CAVEMAN=0\n");
  const before = cliIn(h, {}, "doctor");
  assert.equal(before.status, 0, before.stderr);
  assert.match(before.stdout, /✗ agent-model-guard hook/);
  assert.match(before.stdout, /doctor --fix/);
  assert.match(before.stdout, /· OpenCode {2}\(disabled\)/);
  const fix = cliIn(h, {}, "doctor", "--fix");
  assert.equal(fix.status, 0, fix.stderr + fix.stdout);
  assert.match(fix.stdout, /fix: re-running core/);
  assert.doesNotMatch(fix.stdout, /re-running (workers|free-models|hermes)/, "disabled components are not touched");
  const after = fix.stdout.split("doctor (after fix)")[1];
  assert.match(after, /✓ agent-model-guard hook/);
  assert.match(after, /✓ subagents scout\/builder\/reviewer/);
});

test("update notice: semver compare, daily cache, silent when offline", async () => {
  const { checkForUpdate, newer } = await import("../lib/update-check.mjs");
  assert.equal(newer("1.10.0", "1.9.9"), true);
  assert.equal(newer("1.2.0", "1.2.0"), false);
  assert.equal(newer("1.2.0", "1.3.0"), false);
  let calls = 0;
  const fake = async () => { calls++; return { ok: true, json: async () => ({ version: "9.0.0" }) }; };
  assert.equal(await checkForUpdate("1.2.0", { force: true, fetchImpl: fake }), "9.0.0");
  assert.equal(await checkForUpdate("9.0.0", { force: true, fetchImpl: fake }), null);
  assert.equal(await checkForUpdate("1.2.0", { force: true, fetchImpl: async () => { throw new Error("offline"); } }), "9.0.0", "offline -> cached answer");
  assert.equal(calls, 2);
  assert.equal(await checkForUpdate("1.2.0", { fetchImpl: fake }), null, "disabled in tests (ADS_HOME/CI/non-TTY)");
});

test("third-party tools are pinned; PIN_<NAME> overrides", async () => {
  const { speckitArgs, graphifyArgs, cavemanSource } = await import("../lib/core.mjs");
  const v = JSON.parse(fs.readFileSync(path.join(REPO, "config", "versions.json"), "utf8"));
  assert.match(speckitArgs({}).join(" "), new RegExp(`spec-kit\\.git@${v.speckit.version}$`));
  assert.deepEqual(graphifyArgs({}), [`graphifyy==${v.graphify.version}`]);
  assert.equal(cavemanSource({}), `JuliusBrussee/caveman#${v.caveman.version}`);
  assert.match(speckitArgs({ PIN_SPECKIT: "v9.9.9" }).join(" "), /@v9\.9\.9$/);
  for (const f of ["lib/core.mjs", "lib/phases.mjs"]) {
    const src = fs.readFileSync(path.join(REPO, f), "utf8");
    assert.doesNotMatch(src, /spec-kit\.git"|"graphifyy"|marketplace", "add", "JuliusBrussee\/caveman"/, `${f}: unpinned install`);
  }
});

test("curator and wizard rank models from the same models.json", () => {
  const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
  if (!py) return;
  const ids = ["moonshotai/kimi-k2.6", "meta/llama-3.1-8b-instruct", "z-ai/glm-5", "qwen/qwen3-32b", "x/embed-qa", "nvidia/nemotron-3-ultra-550b"];
  const code = `import json,runpy,sys; m=runpy.run_path(sys.argv[1], run_name="x"); ids=json.loads(sys.argv[2]);
r=sorted([(m["rank"](i), i) for i in ids if not m["EXCLUDE"].search(i) and m["rank"](i) is not None]); print(json.dumps(["nvidia/"+i for _, i in r]))`;
  const r = spawnSync(py, ["-I", "-c", code, path.join(REPO, "scripts", "model-curator", "curate.py"), JSON.stringify(ids)], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return import("../lib/ninerouter.mjs").then(({ rankModels }) => assert.deepEqual(rankModels(ids, 10), JSON.parse(r.stdout)));
});

test("digest diary drops pasted text and masks personal data", () => {
  const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
  if (!py) return;
  const cases = ["fix this <pasted_content id=\"x\"> [{\"email\": \"ana@corp.com\"}] </pasted_content> please",
    "<pasted_content id=\"y\"> [{\"uid\": 1", "send to joao@empresa.com.br, call (11) 98765-4321, cpf 123.456.789-09",
    "{\"rows\": []}", "token=abc123 ok", "APP10-446 release 1.3.0 on 2026-11-12", "look ```SELECT * FROM users``` now"];
  const code = `import json,runpy,sys; m=runpy.run_path(sys.argv[1], run_name="x"); print(json.dumps([m["prompt_text"](c) for c in json.loads(sys.argv[2])]))`;
  const r = spawnSync(py, ["-I", "-c", code, path.join(REPO, "scripts", "daily-digest", "collect.py"), JSON.stringify(cases)], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), ["fix this [colado] please", "[colado]", "send to [personal], call [personal], cpf [personal]",
    "", "[REDACTED] ok", "APP10-446 release 1.3.0 on 2026-11-12", "look [código] now"]);
});

test("caveman counts as installed as a plugin, a skill copy or a config file", async () => {
  const { cavemanInstalled } = await import("../lib/core.mjs");
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "ads-cave-"));
  const prev = process.env.ADS_HOME;
  process.env.ADS_HOME = h;
  try {
    assert.equal(cavemanInstalled(), false);
    fs.mkdirSync(path.join(h, ".claude", "skills", "caveman"), { recursive: true });
    fs.writeFileSync(path.join(h, ".claude", "skills", "caveman", "SKILL.md"), "x");
    assert.equal(cavemanInstalled(), true, "skill copy");
    fs.rmSync(path.join(h, ".claude", "skills"), { recursive: true });
    fs.mkdirSync(path.join(h, ".claude", "plugins"), { recursive: true });
    fs.writeFileSync(path.join(h, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({ version: 2, plugins: { "caveman@caveman": [{}] } }));
    assert.equal(cavemanInstalled(), true, "plugin");
  } finally { process.env.ADS_HOME = prev; }
});

test("integration: real alethe clone + profile (set ALETHE_IT=1)", { skip: process.env.ALETHE_IT !== "1" }, async () => {
  fs.rmSync(path.join(HOME, ".agents", "skills", "alethe"), { recursive: true, force: true });
  const { installAlethe, configureAlethe, aletheCfgDir } = await import("../lib/alethe.mjs");
  const cfg = loadConfig();
  installAlethe(cfg, {});
  const valid = configureAlethe(cfg, { detect: { codex: true, opencode: false, agy: { ids: ["gemini-9-flash-high", "claude-opus-9"], gem: "gemini-9-flash", opus: "claude-opus-9", sonnet: null } } });
  assert.equal(valid, true);
  const pb = fs.readFileSync(path.join(aletheCfgDir(), "alethe-playbooks.yaml"), "utf8");
  assert.match(pb, /providers: \[claude, agy, codex\]/);
  assert.match(pb, /provider: agy/);
});
