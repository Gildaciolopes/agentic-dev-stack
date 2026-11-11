// Shared helpers. Zero dependencies: runs anywhere Node >= 18 runs (macOS, Linux, Windows).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const IS_WIN = process.platform === "win32";
export const IS_MAC = process.platform === "darwin";
export const IS_LINUX = process.platform === "linux";
export const home = () => process.env.ADS_HOME || os.homedir();
export const p = (...parts) => path.join(...parts);

const color = (c) => (s) => (process.stdout.isTTY && !process.env.NO_COLOR ? `\x1b[${c}m${s}\x1b[0m` : s);
const blue = color(34), green = color(32), yellow = color(33), red = color(31);
export const log = {
  step: (s) => console.log(`\n${blue("==> " + s)}`),
  ok: (s) => console.log(green(`  ✓ ${s}`)),
  warn: (s) => console.log(yellow(`  ! ${s}`)),
  err: (s) => console.error(red(`  ✗ ${s}`)),
  info: (s) => console.log(`    ${s}`),
};

export const TODOS = [];
export const todo = (s) => TODOS.push(s);

export function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: IS_WIN && !opts.noShell, timeout: opts.timeout ?? 300_000, ...opts });
  return { code: r.status ?? 1, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

export function has(cmd) {
  const r = IS_WIN ? run("where", [cmd]) : run("sh", ["-c", `command -v ${cmd}`]);
  return r.code === 0 && r.out.length > 0;
}

export function which(cmd) {
  const r = IS_WIN ? run("where", [cmd]) : run("sh", ["-c", `command -v ${cmd}`]);
  return r.code === 0 ? r.out.split(/\r?\n/)[0] : null;
}

export function python() {
  for (const c of IS_WIN ? ["python", "py", "python3"] : ["python3", "python"]) {
    const r = run(c, ["--version"]);
    const m = (r.out + r.err).match(/Python (\d+)\.(\d+)/);
    if (r.code === 0 && m && (+m[1] > 3 || (+m[1] === 3 && +m[2] >= 9))) return c;
  }
  return null;
}

export function readJSON(file, fallback = {}) {
  try {
    const t = fs.readFileSync(file, "utf8");
    return t.trim() ? JSON.parse(t) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

let backupDir = null;
export function backup(file) {
  if (!fs.existsSync(file)) return;
  if (!backupDir) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    backupDir = p(home(), ".local", "share", "agentic-dev-stack", "backups", stamp);
  }
  fs.mkdirSync(backupDir, { recursive: true });
  fs.cpSync(file, p(backupDir, path.basename(file)), { recursive: true });
}
export const backupLocation = () => backupDir;

// Appends a marked block once; never modifies existing content.
export function appendBlock(file, block, beginMarker, header = "") {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (cur.includes(beginMarker)) return "skip";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const prefix = cur ? (cur.endsWith("\n") ? "\n" : "\n\n") : header;
  fs.writeFileSync(file, cur + prefix + block.trimEnd() + "\n");
  if (!fs.readFileSync(file, "utf8").startsWith(cur)) throw new Error(`original content changed in ${file}`);
  return cur ? "appended" : "created";
}

// KEY="value" config (shell-compatible). $HOME and ~ are expanded.
export function loadConfig(explicit) {
  const userCfg = p(home(), ".config", "agentic-dev-stack", "stack.env");
  const file = explicit || (fs.existsSync(userCfg) ? userCfg : p(REPO, "config", "stack.env.example"));
  const cfg = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"#]*?)"?\s*(#.*)?$/);
    if (m) cfg[m[1]] = m[2].replace(/\$HOME|^~(?=\/|$)/g, home());
  }
  if (!fs.existsSync(userCfg)) {
    fs.mkdirSync(path.dirname(userCfg), { recursive: true });
    fs.copyFileSync(file, userCfg);
  }
  cfg.__file = file;
  return cfg;
}

export const flag = (cfg, key, dflt) => String(cfg[key] ?? dflt) === "1";
// CI/tests: exercise all logic without downloading third-party tools
export const skipInstalls = () => process.env.ADS_SKIP_INSTALLS === "1";
