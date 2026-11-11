// Wire one project into the stack (idempotent, append-only), refresh its block, or unwire it.
import fs from "node:fs";
import path from "node:path";
import { aletheDir } from "./alethe.mjs";
import { IS_WIN, REPO, appendBlock, backup, home, log, p, python, readJSON, removeBlock, replaceBlock, run, writeJSON } from "./util.mjs";

const EXCLUDES = [".claude/skills/alethe", ".claude/settings.local.json", ".alethe/"];
const SKIP = new Set(["node_modules", ".git", ".venv", "dist", "build", ".next", ".turbo", ".alethe"]);
const BEGIN = "<!-- BEGIN ALETHE ORCHESTRATION -->";
const END = "<!-- END ALETHE ORCHESTRATION -->";
const AGENTS_HEADER = "# AGENTS.md\n\nFull project rules: `CLAUDE.md`.\n";

const gitRoot = (d) => { const r = run("git", ["-C", d, "rev-parse", "--show-toplevel"], { noShell: true }); return r.code === 0 ? path.resolve(r.out) : null; };

function subRepos(root, depth = 2) {
  const found = [];
  const walk = (d, lvl) => {
    if (lvl && fs.existsSync(p(d, ".git"))) return found.push(d);
    if (lvl >= depth) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true }))
      if (e.isDirectory() && !e.isSymbolicLink() && !SKIP.has(e.name) && !e.name.startsWith(".")) walk(p(d, e.name), lvl + 1);
  };
  walk(root, 0);
  return found;
}

const makeTargets = (d) => fs.existsSync(p(d, "Makefile")) ? [...fs.readFileSync(p(d, "Makefile"), "utf8").matchAll(/^([a-zA-Z][\w-]*):/gm)].map((m) => m[1]) : [];
const pkgScripts = (d) => Object.keys(readJSON(p(d, "package.json")).scripts || {});
function pkgRunner(d) {
  for (const [lock, r] of [["pnpm-lock.yaml", "pnpm"], ["bun.lock", "bun run"], ["bun.lockb", "bun run"], ["yarn.lock", "yarn"]]) if (fs.existsSync(p(d, lock))) return r;
  return "npm run";
}

export function detectGates(root, dirs) {
  const wanted = new Set(["typecheck", "type-check", "lint", "test", "check", "verify", "test-e2e", "e2e"]);
  const gates = [];
  for (const d of dirs) {
    const label = d === root ? "" : `\`${path.relative(root, d).replace(/\\/g, "/")}/\`: `;
    const mk = makeTargets(d).filter((t) => wanted.has(t) || t.startsWith("test"));
    if (mk.length) { gates.push(label + mk.slice(0, 5).map((t) => `\`make ${t}\``).join(" · ")); continue; }
    const sc = pkgScripts(d).filter((s) => wanted.has(s) || /^(test|lint|typecheck)/.test(s));
    if (sc.length) { const r = pkgRunner(d); gates.push(label + sc.slice(0, 5).map((s) => `\`${r} ${s}\``).join(" · ")); continue; }
    if (fs.existsSync(p(d, "pyproject.toml")) || fs.existsSync(p(d, "requirements.txt"))) gates.push(label + "`pytest` · `ruff check .` (adjust if the project uses another runner)");
    else if (fs.existsSync(p(d, "Cargo.toml"))) gates.push(label + "`cargo test` · `cargo clippy`");
    else if (fs.existsSync(p(d, "go.mod"))) gates.push(label + "`go test ./...` · `go vet ./...`");
  }
  return gates.length ? gates : ["No check detected automatically. Write here the test/lint/typecheck commands that accept a worker's output."];
}

export function detectUnits(root, dirs) {
  const units = [];
  const mono = ["apps", "packages", "services", "libs"].filter((g) => fs.existsSync(p(root, g)));
  if (mono.length) units.push(mono.map((g) => `\`${g}/*\``).join(", ") + ": one builder per package, disjoint paths.");
  const sides = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && !SKIP.has(e.name) && /(front|back|web|api|mobile|admin|server|client)/i.test(e.name)).map((e) => e.name).sort();
  if (sides.length && !mono.length) units.push(sides.map((s) => `\`${s}/\``).join(", ") + ": full-stack feature = one builder per side, with the contract (API/types) defined by the lead first.");
  const repos = dirs.filter((d) => d !== root);
  if (repos.length) units.push(`Separate repos (${repos.map((r) => `\`${path.relative(root, r).replace(/\\/g, "/")}\``).join(", ")}): one builder per repo, each in a worktree of its own repo.`);
  return units.length ? units : ["Single project: units = feature folders/modules with disjoint file ownership."];
}

const WORKFLOW_SDD = `### How it plugs into the existing flow (Spec Kit + graphify + RTK)
- Spec Kit stays the flow. alethe joins mid-way without restarting: \`tasks.md\` becomes the units and the project checks become the gates.
- \`specify\`, \`clarify\`, \`plan\` and \`analyze\` stay with the lead (Opus). They are decisions; do not delegate them.
- \`implement\`:
  - independent \`[P]\` tasks -> playbook \`parallel-worktrees\` (one builder per task, isolated worktree, disjoint paths);
  - sequential tasks -> \`plan-execute\`;
  - final diff -> \`review-gate\` before calling it done.
`;
const WORKFLOW_PLAIN = `### How it plugs into the existing flow (graphify + RTK)
- Big task -> the lead writes a short plan with units and gates; independent units -> \`parallel-worktrees\`; final diff -> \`review-gate\`.
`;

function gitExclude(dir, prefix) {
  const r = run("git", ["-C", dir, "rev-parse", "--git-path", "info/exclude"], { noShell: true });
  if (r.code !== 0) return;
  const gp = path.isAbsolute(r.out) ? r.out : p(dir, r.out);
  const cur = fs.existsSync(gp) ? fs.readFileSync(gp, "utf8") : "";
  const add = EXCLUDES.map((e) => `/${prefix}${e}`).filter((e) => !cur.includes(e));
  if (add.length) { fs.mkdirSync(path.dirname(gp), { recursive: true }); fs.appendFileSync(gp, `\n# agentic-dev-stack (local only)\n${add.join("\n")}\n`); }
}

function wireDir(d, dryRun) {
  const link = p(d, ".claude", "skills", "alethe");
  const py = python() || (IS_WIN ? "python" : "python3");
  const hook = `${py} -S "${p(aletheDir(), "scripts", "hook.py")}"`;
  if (dryRun) return;
  fs.mkdirSync(path.dirname(link), { recursive: true });
  try { if (fs.lstatSync(link).isSymbolicLink()) fs.rmSync(link); } catch { /* absent */ }
  if (!fs.existsSync(link)) {
    try { fs.symlinkSync(aletheDir(), link, IS_WIN ? "junction" : "dir"); }
    catch { fs.cpSync(aletheDir(), link, { recursive: true }); log.warn(`symlink not allowed here; copied alethe into ${link}`); }
  }
  const sp = p(d, ".claude", "settings.local.json");
  const cfg = readJSON(sp);
  cfg.hooks = cfg.hooks || {};
  for (const [ev, to] of [["UserPromptSubmit", 10], ["PostToolUse", 5]]) {
    const lst = (cfg.hooks[ev] = cfg.hooks[ev] || []);
    if (!lst.some((e) => (e.hooks || []).some((h) => String(h.command || "").includes("alethe") && String(h.command).includes("hook.py"))))
      lst.push({ hooks: [{ type: "command", command: hook, timeout: to }] });
  }
  writeJSON(sp, cfg);
  const top = gitRoot(d);
  if (top) { const rel = path.relative(top, path.resolve(d)).replace(/\\/g, "/"); gitExclude(d, rel ? rel + "/" : ""); }
}

const resolveDir = (project) => path.resolve(project.replace(/^~(?=$|[\\/])/, home()));

export function addProject(project, { dryRun = false, noDocs = false, refresh = false, lang = "en" } = {}) {
  const root = resolveDir(project);
  if (!fs.existsSync(root)) throw new Error(`not found: ${root}`);
  if (!fs.existsSync(aletheDir()) && !dryRun) throw new Error("alethe not installed; run: npx agentic-dev-stack install --workers");
  const repos = gitRoot(root) ? [] : subRepos(root);
  for (const d of [root, ...repos]) wireDir(d, dryRun);
  log.ok(`alethe wired in: ${[root, ...repos].map((d) => path.relative(root, d) || ".").join(", ")}`);
  if (noDocs) return;

  const dirs = [root, ...repos];
  const tdir = p(REPO, "templates", lang === "pt-BR" ? "pt-BR" : "");
  const sdd = fs.existsSync(p(root, ".specify")) || fs.existsSync(p(root, "specs"));
  const block = fs.readFileSync(p(tdir, "project-claude-block.md"), "utf8")
    .replace("{{WORKFLOW_SECTION}}", lang === "pt-BR" ? (sdd ? WORKFLOW_SDD_PT : WORKFLOW_PLAIN_PT) : (sdd ? WORKFLOW_SDD : WORKFLOW_PLAIN))
    .replace("{{GATES}}", detectGates(root, dirs).map((g) => `- ${g}`).join("\n"))
    .replace("{{UNITS}}", detectUnits(root, dirs).map((u) => `- ${u}`).join("\n"));
  const agents = fs.readFileSync(p(tdir, "project-agents-block.md"), "utf8");
  if (dryRun) { console.log("\n--- block that would be appended to CLAUDE.md ---\n" + block); return; }
  // --refresh rewrites only our block (between BEGIN/END); everything else in the file is untouched
  const put = (file, text, header) => {
    if (refresh) { const r = replaceBlock(file, text, BEGIN, END); if (r !== "missing") return r; }
    return appendBlock(file, text, BEGIN, header);
  };
  const r1 = put(p(root, "CLAUDE.md"), block, `# ${path.basename(root)}\n`);
  const r2 = put(p(root, "AGENTS.md"), agents, AGENTS_HEADER);
  log.ok(`CLAUDE.md: ${r1} | AGENTS.md: ${r2}`);
  if (r1 === "skip") log.info("Block already present. Use --refresh to regenerate it (gates, units, Spec Kit) without touching the rest of the file.");
  for (const sub of repos) if (fs.existsSync(p(sub, "AGENTS.md"))) log.ok(`${path.relative(root, sub)}/AGENTS.md: ${put(p(sub, "AGENTS.md"), agents)}`);
  log.info("Review the block at the end of CLAUDE.md: gates and units were auto-detected.");
}

const WORKFLOW_SDD_PT = `### Integração com o fluxo que já existe (Spec Kit + graphify + RTK)
- O Spec Kit continua sendo o fluxo. O alethe entra no meio sem recomeçar: \`tasks.md\` vira as unidades e os checks do projeto viram os gates.
- \`specify\`, \`clarify\`, \`plan\` e \`analyze\` ficam com o lead (Opus). São decisões e não se delegam.
- \`implement\`:
  - tasks \`[P]\` independentes -> playbook \`parallel-worktrees\` (1 builder por task, worktree isolada, paths disjuntos);
  - tasks sequenciais -> \`plan-execute\`;
  - diff final -> \`review-gate\` antes de declarar pronto.
`;
const WORKFLOW_PLAIN_PT = `### Integração com o fluxo que já existe (graphify + RTK)
- Tarefa grande -> o lead escreve um plano curto com unidades e gates; unidades independentes -> \`parallel-worktrees\`; diff final -> \`review-gate\`.
`;

// Undo add-project: remove our blocks, the alethe link, our hook entries and our git-exclude lines.
export function removeProject(project, { dryRun = false } = {}) {
  const root = resolveDir(project);
  if (!fs.existsSync(root)) throw new Error(`not found: ${root}`);
  const dirs = [root, ...(gitRoot(root) ? [] : subRepos(root))];
  const tag = dryRun ? "(dry-run) " : "";
  for (const d of dirs) {
    const rel = path.relative(root, d) || ".";
    for (const f of ["CLAUDE.md", "AGENTS.md"]) {
      const header = f === "AGENTS.md" ? AGENTS_HEADER : `# ${path.basename(d)}\n`;
      const r = removeBlock(p(d, f), BEGIN, END, { dryRun, createdHeader: header });
      if (r !== "missing") log.ok(`${tag}${rel}/${f}: ${r}`);
    }
    const link = p(d, ".claude", "skills", "alethe");
    try {
      const st = fs.lstatSync(link);
      if (st.isSymbolicLink()) { if (!dryRun) { try { fs.unlinkSync(link); } catch { fs.rmdirSync(link); } } log.ok(`${tag}${rel}/.claude/skills/alethe link removed`); }
      else if (fs.existsSync(p(link, "scripts", "hook.py"))) { if (!dryRun) fs.rmSync(link, { recursive: true, force: true }); log.ok(`${tag}${rel}/.claude/skills/alethe copy removed`); }
    } catch { /* absent */ }
    const sp = p(d, ".claude", "settings.local.json");
    if (fs.existsSync(sp)) {
      const cfg = readJSON(sp);
      let changed = false;
      for (const ev of Object.keys(cfg.hooks || {})) {
        const before = JSON.stringify(cfg.hooks[ev]);
        cfg.hooks[ev] = cfg.hooks[ev].map((e) => ({ ...e, hooks: (e.hooks || []).filter((h) => !(String(h.command || "").includes("alethe") && String(h.command).includes("hook.py"))) })).filter((e) => e.hooks.length);
        if (!cfg.hooks[ev].length) delete cfg.hooks[ev];
        if (JSON.stringify(cfg.hooks[ev]) !== before) changed = true;
      }
      if (cfg.hooks && !Object.keys(cfg.hooks).length) delete cfg.hooks;
      if (changed && !dryRun) { backup(sp); Object.keys(cfg).length ? writeJSON(sp, cfg) : fs.rmSync(sp); }
      if (changed) log.ok(`${tag}${rel}/.claude/settings.local.json: alethe hooks removed`);
    }
    const r = run("git", ["-C", d, "rev-parse", "--git-path", "info/exclude"], { noShell: true });
    if (r.code === 0) {
      const gp = path.isAbsolute(r.out) ? r.out : p(d, r.out);
      if (fs.existsSync(gp)) {
        const cur = fs.readFileSync(gp, "utf8");
        const next = cur.split("\n").filter((l) => l !== "# agentic-dev-stack (local only)" && !EXCLUDES.some((e) => l.startsWith("/") && l.endsWith(e))).join("\n").replace(/\n{3,}/g, "\n\n");
        if (next !== cur) { if (!dryRun) fs.writeFileSync(gp, next); log.ok(`${tag}${rel}: git exclude lines removed`); }
      }
    }
  }
}
