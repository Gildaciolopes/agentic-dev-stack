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
const { addProject, detectGates, detectUnits } = await import("../lib/add-project.mjs");

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

test("integration: real alethe clone + profile (set ALETHE_IT=1)", { skip: process.env.ALETHE_IT !== "1" }, async () => {
  fs.rmSync(path.join(HOME, ".agents", "skills", "alethe"), { recursive: true, force: true });
  const { installAlethe, configureAlethe } = await import("../lib/alethe.mjs");
  const cfg = loadConfig();
  installAlethe(cfg, {});
  const valid = configureAlethe(cfg, { detect: { codex: true, opencode: false, agy: { ids: ["gemini-9-flash-high", "claude-opus-9"], gem: "gemini-9-flash", opus: "claude-opus-9", sonnet: null } } });
  assert.equal(valid, true);
  const pb = fs.readFileSync(path.join(HOME, ".config", "alethe", "alethe-playbooks.yaml"), "utf8");
  assert.match(pb, /providers: \[claude, agy, codex\]/);
  assert.match(pb, /provider: agy/);
});
