// Find pieces of a setup the user already runs (built by hand, or by an older copy of these scripts) that would
// run twice next to the stack's own: a scheduled curator / digest collector / 9Router autostart, Hermes jobs that
// already send the digest or the combo alert, an orchestration section in ~/.claude/CLAUDE.md.
// For each one the user picks:
//   replace -> the stack takes over; theirs is backed up first, then disabled (Hermes jobs are renamed, keeping history)
//   keep    -> theirs stays untouched and the stack skips its own copy (KEEP_EXISTING in stack.env)
import fs from "node:fs";
import { t } from "./i18n.mjs";
import { color, interactive, note, select } from "./prompt.mjs";
import { IS_MAC, IS_WIN, backup, backupLocation, home, log, p, run, skipInstalls, which } from "./util.mjs";

const HERMES_NAME = { digest: "daily-digest", "combo-alert": "combo-alert" };
const BEGIN = "<!-- BEGIN AGENTIC-DEV-STACK -->", END = "<!-- END AGENTIC-DEV-STACK -->";

// What a scheduled command is, judged by what it runs. Our own jobs never match (their paths/labels say so).
// Matches script/binary names as path components only (accurate.py or a URL mentioning 9router never match).
export function classifyCommand(cmd) {
  if (/agentic-dev-stack/.test(cmd)) return null;
  if (/(^|[\s/\\"'])curate\.py(\s|$|["'])/.test(cmd)) return "curator";
  if (/(^|[\s/\\"'])collect\.py(\s|$|["'])/.test(cmd) && /digest/i.test(cmd)) return "collector";
  if (/[/\\]9router[/\\](cli\.js|bin)\b|(^|[\s/\\"'])9router(\.cmd|\.exe)?(\s|$|["'])/i.test(cmd)) return "9router-autostart";
  return null;
}

// ------------------------------------------------------------------ detection
function launchdJobs() {
  const dir = p(home(), "Library", "LaunchAgents");
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".plist") && !x.startsWith("com.agentic-dev-stack.") && !x.startsWith("com.apple."))) {
    const file = p(dir, f);
    let xml = "";
    try { xml = fs.readFileSync(file, "utf8"); } catch { continue; }
    if (xml.startsWith("bplist") && IS_MAC) xml = run("plutil", ["-convert", "xml1", "-o", "-", file]).out;
    const args = (xml.match(/<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/) || [])[1] || "";
    const cmd = [...args.matchAll(/<string>([\s\S]*?)<\/string>/g)].map((m) => m[1]).join(" ");
    const kind = classifyCommand(cmd);
    // launchctl addresses a job by its Label, which need not match the file name
    const lbl = (xml.match(/<key>Label<\/key>\s*<string>([^<]+)<\/string>/) || [])[1] || f.replace(/\.plist$/, "");
    if (kind) out.push({ kind, where: "launchd", id: lbl, file, detail: cmd });
  }
  return out;
}

function cronJobs() {
  if (skipInstalls() || !which("crontab")) return [];
  return run("crontab", ["-l"]).out.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#") && !l.includes("# com.agentic-dev-stack"))
    .map((l) => ({ kind: classifyCommand(l), where: "crontab", id: l, detail: l })).filter((x) => x.kind);
}

function systemdUnits() {
  const dir = p(home(), ".config", "systemd", "user");
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  return files.filter((f) => f.endsWith(".service") && !f.startsWith("agentic-dev-stack-")).map((f) => {
    const exec = (fs.readFileSync(p(dir, f), "utf8").match(/^ExecStart=(.*)$/m) || [])[1] || "";
    // a .timer that triggers this service (same base name, or Unit=<service>)
    const timers = files.filter((x) => x.endsWith(".timer") && (x === f.replace(/\.service$/, ".timer")
      || new RegExp(`^Unit=${f.replace(/\./g, "\\.")}\\s*$`, "m").test(fs.readFileSync(p(dir, x), "utf8"))));
    return { kind: classifyCommand(exec), where: "systemd", id: f, file: p(dir, f), timers: timers.map((x) => p(dir, x)), detail: exec };
  }).filter((x) => x.kind);
}

function windowsTasks() {
  if (skipInstalls()) return [];
  const rows = run("schtasks", ["/Query", "/FO", "CSV", "/V", "/NH"]).out.split(/\r?\n/);
  const seen = new Set(), out = [];
  for (const row of rows) {
    const cols = [...row.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1]);
    const [name, cmd] = [cols[1], cols[8]];
    if (!name || seen.has(name) || /agentic-dev-stack/.test(name)) continue;
    seen.add(name);
    const kind = classifyCommand(cmd || "");
    if (kind) out.push({ kind, where: "schtasks", id: name.replace(/^\\/, ""), detail: cmd });
  }
  return out;
}

function hermesJobs() {
  let jobs = [];
  try { jobs = JSON.parse(fs.readFileSync(p(home(), ".hermes", "cron", "jobs.json"), "utf8")).jobs || []; } catch { return []; }
  const ours = new Set(Object.values(HERMES_NAME));
  return jobs.filter((j) => !ours.has(j.name)).map((j) => {
    const pr = String(j.prompt || "");
    const kind = /workspace[\\/]daily/.test(pr) ? "digest" : /model-curator[\\/]status\.json/.test(pr) ? "combo-alert" : null;
    return { kind, where: "hermes", id: j.id, name: j.name, detail: `${j.name} (${j.schedule?.display || j.schedule?.expr || ""})` };
  }).filter((x) => x.kind);
}

// An "# Orchestration ... plan big, execute small" section outside the stack's own block.
// The section ends at the next heading of the same or higher level, at the stack's BEGIN marker, or at EOF.
// Lines inside fenced code blocks (``` or ~~~) are never taken as headings.
export function findOrchestrationSection(text) {
  const outside = text.replace(new RegExp(`${BEGIN}[\\s\\S]*?(${END}|$)`), (m) => m.replace(/[^\n]/g, " "));
  const lines = outside.split("\n");
  let pos = 0, fence = null, start = -1, level = 0;
  for (const line of lines) {
    const f = line.match(/^\s*(```|~~~)/);
    if (f) fence = fence === f[1] ? null : fence || f[1];
    else if (!fence) {
      const h = line.match(/^(#{1,6}) +/);
      if (start < 0 && h && h[1].length <= 3 && /^#{1,3} +Orchestration\b.*plan big/i.test(line)) { start = pos; level = h[1].length; }
      else if (start >= 0 && h && h[1].length <= level) return [start, pos];
    }
    // the stack's block was blanked out above: stop where it begins
    if (start >= 0 && text.startsWith(BEGIN, pos)) return [start, pos];
    pos += line.length + 1;
  }
  return start < 0 ? null : [start, text.length];
}

// Remove [a, b) and tidy only the seam (never other blank lines in the file).
export function cutSection(text, [a, b]) {
  const before = text.slice(0, a).replace(/\n+$/, ""), after = text.slice(b).replace(/^\n+/, "");
  return before && after ? `${before}\n\n${after}` : before ? `${before}\n` : after;
}

function claudeMdSection() {
  const file = p(home(), ".claude", "CLAUDE.md");
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  const at = findOrchestrationSection(text);
  return at ? [{ kind: "claude-md", where: "file", id: file, file, detail: text.slice(at[0], at[1]).split("\n")[0] }] : [];
}

export function findExisting() {
  return [...(IS_MAC ? launchdJobs() : []), ...(!IS_MAC && !IS_WIN ? [...cronJobs(), ...systemdUnits()] : []), ...(IS_WIN ? windowsTasks() : []),
    ...hermesJobs(), ...claudeMdSection()];
}

// ------------------------------------------------------------------ actions
function saveText(name, text) {
  const dir = p(home(), ".local", "share", "agentic-dev-stack", "backups", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p(dir, name), text);
  return dir;
}

// Runs a system command; throws when it fails, so the caller reports the item as kept instead of "replaced".
function must(cmd, args, opts = {}) {
  const r = run(cmd, args, opts);
  if (r.code !== 0) throw new Error(`${cmd} ${args[0]} failed: ${(r.err || r.out).split("\n").pop()}`);
  return r;
}

function replace(f, all) {
  const live = !skipInstalls();
  if (f.where === "launchd") {
    backup(f.file);
    if (live) {
      const r = run("launchctl", ["bootout", `gui/${process.getuid()}/${f.id}`]);
      // 3 / 113 = "no such process / not loaded": already stopped, fine
      if (r.code !== 0 && ![3, 36, 113].includes(r.code) && !/No such process|not find/i.test(r.err)) throw new Error(`launchctl bootout failed: ${r.err}`);
    }
    fs.rmSync(f.file, { force: true });
  } else if (f.where === "systemd") {
    for (const x of [...(f.timers || []), f.file]) backup(x);
    if (live) for (const x of [...(f.timers || []), f.file]) run("systemctl", ["--user", "disable", "--now", x.split(/[\\/]/).pop()]);
    for (const x of [...(f.timers || []), f.file]) fs.rmSync(x, { force: true });
    if (live) run("systemctl", ["--user", "daemon-reload"]);
  } else if (f.where === "crontab") {
    const cur = must("crontab", ["-l"]).out;
    saveText("crontab.txt", cur + "\n");
    must("sh", ["-c", "crontab -"], { input: cur.split("\n").filter((l) => l !== f.id).join("\n") + "\n" });
  } else if (f.where === "schtasks") {
    // noShell: task names with spaces reach schtasks as one argument
    saveText(`${f.id.replace(/[\\/:*?"<>| ]/g, "_")}.xml`, must("schtasks", ["/Query", "/TN", f.id, "/XML"], { noShell: true }).out);
    must("schtasks", ["/Delete", "/F", "/TN", f.id], { noShell: true });
  } else if (f.where === "hermes") {
    backup(p(home(), ".hermes", "cron", "jobs.json"));
    const target = HERMES_NAME[f.kind];
    // rename keeps the job's run history; the next install updates its schedule/prompt in place
    const H = which("hermes") || p(home(), ".local", "bin", "hermes");
    let names = [];
    try { names = JSON.parse(fs.readFileSync(p(home(), ".hermes", "cron", "jobs.json"), "utf8")).jobs.map((j) => j.name); } catch { /* none */ }
    // the stack's job already exists (or another duplicate was renamed first) -> drop this one instead
    const taken = names.includes(target) || all.some((x) => x !== f && x.renamedTo === target);
    if (live) must(H, taken ? ["cron", "remove", f.id] : ["cron", "edit", f.id, "--name", target], { noShell: true });
    if (!taken) f.renamedTo = target;
  } else if (f.where === "file") {
    backup(f.file);
    const text = fs.readFileSync(f.file, "utf8");
    const at = findOrchestrationSection(text);
    if (at) fs.writeFileSync(f.file, cutSection(text, at));
  }
}

const label = (f) => `${t(`k_${f.kind}`)} · ${f.where === "hermes" ? `Hermes job ${f.detail}` : f.where === "file" ? f.detail : `${f.where}: ${f.id}`}`;

// For `install` (scripted, no questions): everything found is kept, and the user is told how to replace it.
export function keepAllFound(keep = []) {
  const keepSet = new Set(keep);
  const found = findExisting().filter((f) => !keepSet.has(f.kind));
  if (!found.length) return null;
  note(t("ad_title"), [...found.map(label), color.gray("kept (the stack skips its own copy). To replace: npx agentic-dev-stack adopt")]);
  for (const f of found) keepSet.add(f.kind);
  return [...keepSet];
}

/**
 * Ask (or apply decisions) for every finding. Returns the KEEP_EXISTING list to save.
 * decisions: { [kind]: "replace" | "keep" } (from ADS_ANSWERS ids adopt_<kind>); defaults: interactive "replace",
 * non-interactive "keep" (never disables something of yours unless asked).
 */
export async function adoptExisting({ findings = findExisting(), dryRun = false, keep = [], all = false } = {}) {
  const keepSet = new Set(keep);
  if (!all) findings = findings.filter((f) => !keepSet.has(f.kind)); // already decided: don't ask on every run
  if (!findings.length) return [...keepSet];
  note(t("ad_title"), findings.map((f) => `${label(f)}${f.detail && f.where !== "file" && f.where !== "hermes" ? color.gray(`  ${String(f.detail).slice(0, 90)}`) : ""}`));
  if (dryRun) return [...keepSet];
  const keptNow = new Set(); // two jobs of one kind: keeping either one means the stack must skip its copy
  for (const f of findings) {
    const choice = await select({ id: `adopt_${f.kind}`, message: `${t(`k_${f.kind}`)}: ${f.where === "hermes" ? f.name : f.id.split(/[\\/]/).pop()}`,
      initial: interactive() ? 0 : 1, choices: [
        { value: "replace", label: t("ad_replace"), hint: t("ad_replace_h") },
        { value: "keep", label: t("ad_keep"), hint: t("ad_keep_h") }] });
    if (choice === "keep") { keepSet.add(f.kind); keptNow.add(f.kind); log.ok(`kept: ${label(f)}`); continue; }
    try { replace(f, findings); if (!keptNow.has(f.kind)) keepSet.delete(f.kind); log.ok(`replaced: ${label(f)}`); }
    catch (e) { keepSet.add(f.kind); keptNow.add(f.kind); log.warn(`${label(f)}: ${e.message} (kept)`); }
  }
  if (backupLocation()) log.info(`backups: ${backupLocation()}`);
  return [...keepSet];
}
