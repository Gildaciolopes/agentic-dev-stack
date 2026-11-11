// alethe: install pinned (audited) commit + apply the stack profile. Port of the original python script.
import fs from "node:fs";
import os from "node:os";
import { IS_WIN, backup, has, home, log, p, python, readJSON, run, writeJSON } from "./util.mjs";

export const aletheDir = () => p(home(), ".agents", "skills", "alethe");
// alethe's own config location: %APPDATA%\Alethe on Windows, $XDG_CONFIG_HOME/alethe (or ~/.config/alethe) elsewhere
const appData = () => (process.env.ADS_HOME ? p(home(), "AppData", "Roaming") : process.env.APPDATA || p(home(), "AppData", "Roaming"));
export const aletheCfgDir = () => (IS_WIN ? p(appData(), "Alethe") : p(process.env.ADS_HOME ? p(home(), ".config") : process.env.XDG_CONFIG_HOME || p(home(), ".config"), "alethe"));
const cfgDir = aletheCfgDir;
const policyFile = () => p(cfgDir(), IS_WIN ? "alethe-orchestrate.json" : "orchestrate.json");
const MARK = "# agentic-dev-stack profile";
// alethe resolves its config from HOME/XDG_CONFIG_HOME; pin them so ADS_HOME (tests, custom homes) is honored
const aenv = () => ({ ...process.env, HOME: home(), USERPROFILE: home(), APPDATA: appData(), XDG_CONFIG_HOME: p(home(), ".config") });

export function installAlethe(cfg, { dryRun }) {
  const dst = aletheDir();
  const want = cfg.ALETHE_COMMIT || "ab81104";
  const audited = p(dst, ".audited-commit");
  if (fs.existsSync(audited) && fs.readFileSync(audited, "utf8").split(/\s/)[0] === want) return log.ok(`alethe ${want} (already installed)`);
  if (dryRun) return log.ok(`(dry-run) would clone ${cfg.ALETHE_REPO} @ ${want}`);
  if (!has("git")) throw new Error("git is required");
  const tmp = fs.mkdtempSync(p(os.tmpdir(), "alethe-"));
  let r = run("git", ["clone", "-q", cfg.ALETHE_REPO || "https://github.com/Kc1t/alethe-orchestrate-skill", p(tmp, "src")], { noShell: true });
  if (r.code !== 0) throw new Error(`git clone failed: ${r.err}`);
  r = run("git", ["-C", p(tmp, "src"), "checkout", "-q", want], { noShell: true });
  if (r.code !== 0) throw new Error(`commit ${want} not found`);
  if (fs.existsSync(dst)) { backup(dst); fs.rmSync(dst, { recursive: true, force: true }); }
  fs.mkdirSync(p(home(), ".agents", "skills"), { recursive: true });
  fs.cpSync(p(tmp, "src", "skills", "alethe"), dst, { recursive: true });
  fs.writeFileSync(audited, `${want} ${new Date().toISOString().slice(0, 10)} audited\n`);
  fs.rmSync(tmp, { recursive: true, force: true });
  log.ok(`alethe ${want} -> ${dst}`);
}

function agyModels() {
  if (!has("agy")) return { ids: [], gem: null, opus: null, sonnet: null };
  const out = run("agy", ["models"], { timeout: 60_000 }).out;
  const ids = out.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("Fetching")).map((l) => l.split(/\s+/)[0]);
  const gemRaw = ids.find((i) => i.includes("gemini") && i.includes("flash"));
  return {
    ids,
    gem: gemRaw ? gemRaw.replace(/-(high|medium|low)$/, "") : null,
    opus: ids.find((i) => i.includes("opus")) || null,
    sonnet: ids.find((i) => i.includes("sonnet")) || null,
  };
}

function rep(s, oldS, newS) {
  const n = s.split(oldS).length - 1;
  if (n !== 1) throw new Error(`alethe playbooks anchor not found/unique (upstream changed?): ${oldS.slice(0, 70)}`);
  return s.replace(oldS, newS);
}

export function configureAlethe(cfg, { force = false, dryRun = false, detect } = {}) {
  if (dryRun) return log.ok("(dry-run) would apply the alethe profile");
  const py = python();
  const orch = p(aletheDir(), "scripts", "orchestrate.py");
  if (!fs.existsSync(orch)) throw new Error("alethe not installed; run: install --workers");
  if (!py) { log.warn("Python >= 3.9 not found: alethe runs in manual mode (see references/manual.md). Profile not applied."); return; }
  const PB = p(cfgDir(), "alethe-playbooks.yaml");
  if (force && fs.existsSync(PB)) { fs.copyFileSync(PB, PB + ".bak"); fs.rmSync(PB); }
  if (!fs.existsSync(PB)) run(py, ["-I", orch, "playbook", "--init"], { cwd: home(), noShell: true, env: aenv() });
  let s = fs.readFileSync(PB, "utf8");

  const d = detect || {};
  const sandboxed = fs.existsSync(p(home(), ".local", "bin", IS_WIN ? "opencode-safe.cmd" : "opencode-safe"));
  const oc = d.opencode ?? (sandboxed && has("opencode"));
  const codex = d.codex ?? has("codex");
  const am = d.agy ?? agyModels();
  const agy = Boolean(am.gem || am.opus);

  if (s.includes(MARK)) {
    log.ok("alethe profile already applied (use --force to rebuild)");
  } else {
    const providers = ["claude", ...(agy ? ["agy"] : []), ...(codex ? ["codex"] : []), ...(oc ? ["opencode"] : [])];
    const reviewer = agy && am.opus ? "agy" : codex ? "codex" : "claude";
    const tier = (cl, ag, cx) => [
      `    claude: ${cl}`,
      ...(agy && ag ? [`    agy: ${ag}`] : []),
      ...(codex ? [`    codex: ${cx}`] : []),
      ...(oc ? ["    opencode: { model: 9router/free }"] : []),
    ].join("\n");
    const notes = [`${MARK}: claude lead; providers ${JSON.stringify(providers)}; reviewer ${reviewer}.`];
    if (agy) notes.push("agy Claude models reject --effort; Gemini uses the base id plus --effort.", "agy read-only workers cannot run shell; use claude for read-only units that need commands.");
    if (oc) notes.push("opencode adapter = ~/.local/bin/opencode-safe (kernel sandbox + --standalone); writer-only, isolated.");
    let head = "setup:\n  notes:\n" + notes.map((n) => `    - ${JSON.stringify(n)}\n`).join("");
    head += `\nproviders: [${providers.join(", ")}]\n\nmodels:\n  claude: [opus, sonnet, haiku]\n`;
    if (agy) head += `  agy: [${[am.gem, ...am.ids].filter(Boolean).join(", ")}]\n`;
    if (oc) {
      const cmd = p(home(), ".local", "bin", IS_WIN ? "opencode-safe.cmd" : "opencode-safe").replace(/\\/g, "/");
      head += `  opencode: [9router/free]\n\nadapters:\n  opencode:\n    command: ${cmd}\n    args: [run]\n    promptTransport: argument\n    outputFormat: text\n    modelFlag: "-m"\n    checked: "agentic-dev-stack configure-alethe"\n\nroutes:\n  router9:\n    port: 20128\n    running: true\n    carries: [opencode]\n`;
    }
    head += "\ntiers:\n  cheap:\n" + tier("{ model: haiku, effort: low }", am.gem && `{ model: ${am.gem}, effort: high }`, "{ effort: low }");
    head += "\n  standard:\n" + tier("{ model: sonnet, effort: medium }", am.sonnet && `{ model: ${am.sonnet} }`, "{ effort: medium }");
    head += "\n  strong:\n" + tier("{ model: opus, effort: high }", am.opus && `{ model: ${am.opus} }`, "{ effort: high }") + "\n";

    const i = s.indexOf("providers: [claude, codex]"), j = s.indexOf("\nquota:");
    if (i < 0 || j < 0) throw new Error("alethe playbooks layout changed upstream");
    s = s.slice(0, i) + head.trimEnd() + "\n" + s.slice(j);
    const prefer = ["codex", "agy", "claude"].filter((x) => providers.includes(x));
    s = rep(s, "  prefer: [codex, claude]", `  prefer: [${prefer.join(", ")}]`);
    s = rep(s, "  - A risky unit never runs on the cheap tier, and its diff goes through review-gate.\n",
      "  - A risky unit never runs on the cheap tier, and its diff goes through review-gate.\n" +
      '  - "agy briefs: use only file-read tools, never shell; do NOT create a plan nor ask for approval; execute and end with STATUS/SUMMARY."\n' +
      '  - "Read-only reviewers get the FULL diff as a file in the repo: git diff > .alethe/review.diff (git-excluded), never a hand-filtered diff."\n' +
      '  - "Before the first wave run usage --refresh-claude --refresh-agy so quota is known."\n' +
      '  - "Secrets (.env*, keys, credentials JSON) never go into briefs, plans or seedPaths."\n');
    s = rep(s, "          - if: light\n            use: { tier: cheap }\n      - id: review\n        role: reviewer\n        tier: standard\n        provider: codex",
      `          - if: light\n            use: { tier: standard, effort: low }\n      - id: review\n        role: reviewer\n        tier: strong\n        provider: ${reviewer}`);
    const esc = agy ? `use: { provider: agy${am.opus ? `, model: ${am.opus}` : ""} }` : codex ? "use: { provider: codex, effort: xhigh }" : "use: { provider: claude, model: opus, effort: xhigh }";
    s = s.split("use: { provider: codex, effort: xhigh }").join(esc);
    s = rep(s, "      - id: bugs\n        role: bug-hunter\n        tier: strong\n        readOnly: true",
      `      - id: bugs\n        role: bug-hunter\n        tier: strong\n        provider: ${reviewer}\n        readOnly: true`);
    if (oc) s = rep(s, "      - id: try-cheap\n        role: attempt\n        tier: cheap\n        readOnly: false\n        runner: economy\n        does: Make the change and run the check.",
      "      - id: try-cheap\n        role: attempt\n        tier: cheap\n        provider: opencode\n        isolate: true\n        readOnly: false\n        runner: economy\n" +
      "        does: Make the change and run the check. Mechanical units only.\n        rules:\n          - if: risky\n            use: { provider: claude, tier: standard }");
    if (!codex) s = s.replace(/\n\s+codex: \{ effort: [a-z]+ \}/g, "");
    s = rep(s, "    summary: Each tier on its usual model.", "    summary: Opus plans/validates, Sonnet builds, cheap scouts, independent reviewer, free worker for mechanical edits.");
    fs.writeFileSync(PB, s);
    log.ok(`alethe profile: providers=${providers.join(",")} reviewer=${reviewer}`);
  }

  const prices = p(cfgDir(), "alethe-prices.json");
  if (!fs.existsSync(prices)) writeJSON(prices, { version: 1, currency: "USD", unit: "per 1M tokens", billing: { claude: "subscription", agy: "subscription", codex: "subscription", opencode: "subscription" }, models: {} });
  const order = ["claude", "agy", "codex"].filter((x) => x === "claude" || (x === "agy" ? agy : codex));
  run(py, ["-I", orch, "policy", "set", "--backend", "skill", "--provider-order", ...order, "--provider-switch", "automatic"], { cwd: home(), noShell: true, env: aenv() });
  const pol = policyFile();
  const d2 = readJSON(pol);
  d2.trust = d2.trust || {};
  const roots = new Set(d2.trust.cwdRoots || []);
  roots.add(fs.realpathSync(os.tmpdir()));
  if (cfg.PROJECTS_DIR) roots.add(cfg.PROJECTS_DIR);
  d2.trust.cwdRoots = [...roots].sort();
  writeJSON(pol, d2);
  const doc = run(py, ["-I", orch, "doctor"], { cwd: home(), noShell: true, env: aenv() }).out;
  let valid = false;
  try { valid = JSON.parse(doc).playbooks.valid; } catch { /* ignore */ }
  valid ? log.ok("alethe doctor: playbooks valid") : log.warn("alethe doctor did not validate; run it manually");
  return valid;
}
