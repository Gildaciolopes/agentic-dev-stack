// Cross-platform daily schedules: launchd (macOS), crontab (Linux), Task Scheduler (Windows).
import fs from "node:fs";
import { IS_MAC, IS_WIN, home, log, p, run, skipInstalls } from "./util.mjs";

const LOGS = () => p(home(), ".local", "share", "agentic-dev-stack", "logs");
const xml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// label: reverse-dns id, times: ["07:30", ...], argv: [program, ...args]
export function schedule(label, times, argv, { dryRun = false } = {}) {
  fs.mkdirSync(LOGS(), { recursive: true });
  if (dryRun) return log.ok(`(dry-run) would schedule ${label} at ${times.join(" ")}`);
  if (skipInstalls()) return log.warn(`(test mode) not registering ${label} with the OS scheduler`);
  if (IS_MAC) return launchd(label, times, argv);
  if (IS_WIN) return schtasks(label, times, argv);
  return crontab(label, times, argv);
}

export function unschedule(label) {
  if (skipInstalls()) return;
  if (IS_MAC) {
    run("launchctl", ["bootout", `gui/${process.getuid()}/${label}`]);
    fs.rmSync(p(home(), "Library", "LaunchAgents", `${label}.plist`), { force: true });
  } else if (IS_WIN) {
    const list = run("schtasks", ["/Query", "/FO", "CSV", "/NH"]).out;
    for (const m of list.matchAll(new RegExp(`"\\\\(${label.replace(/\./g, "\\.")}[^"]*)"`, "g"))) run("schtasks", ["/Delete", "/F", "/TN", m[1]]);
  } else {
    const cur = run("crontab", ["-l"]).out.split("\n").filter((l) => !l.includes(`# ${label}`));
    run("sh", ["-c", "crontab -"], { input: cur.join("\n") + "\n" });
  }
}

function launchd(label, times, argv) {
  const plist = p(home(), "Library", "LaunchAgents", `${label}.plist`);
  const cal = times.map((t) => {
    const [h, m] = t.split(":").map(Number);
    return `<dict><key>Hour</key><integer>${h}</integer><key>Minute</key><integer>${m}</integer></dict>`;
  }).join("");
  const args = argv.map((a) => `<string>${xml(a)}</string>`).join("");
  fs.mkdirSync(p(home(), "Library", "LaunchAgents"), { recursive: true });
  fs.writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array>${args}</array>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(p(home(), ".local", "bin"))}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
<key>StartCalendarInterval</key><array>${cal}</array>
<key>StandardOutPath</key><string>${xml(p(LOGS(), label + ".log"))}</string>
<key>StandardErrorPath</key><string>${xml(p(LOGS(), label + ".err"))}</string>
</dict></plist>
`);
  const uid = process.getuid();
  run("launchctl", ["bootout", `gui/${uid}/${label}`]);
  const r = run("launchctl", ["bootstrap", `gui/${uid}`, plist]);
  r.code === 0 ? log.ok(`launchd: ${label} (${times.join(" ")})`) : log.warn(`launchd bootstrap failed for ${label}: ${r.err}`);
}

function crontab(label, times, argv) {
  const q = (a) => `'${a.replace(/'/g, "'\\''")}'`;
  const cmd = argv.map(q).join(" ") + ` >> ${q(p(LOGS(), label + ".log"))} 2>> ${q(p(LOGS(), label + ".err"))}`;
  const lines = times.map((t) => { const [h, m] = t.split(":").map(Number); return `${m} ${h} * * * ${cmd} # ${label}`; });
  const cur = run("crontab", ["-l"]);
  const keep = (cur.code === 0 ? cur.out.split("\n") : []).filter((l) => l && !l.includes(`# ${label}`));
  const r = run("sh", ["-c", "crontab -"], { input: [...keep, ...lines].join("\n") + "\n" });
  r.code === 0 ? log.ok(`crontab: ${label} (${times.join(" ")})`) : log.warn(`crontab unavailable (${r.err}). Add manually:\n${lines.join("\n")}`);
}

function schtasks(label, times, argv) {
  const tr = argv.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ");
  times.forEach((t, i) => {
    const name = times.length > 1 ? `${label}-${i + 1}` : label;
    const r = run("schtasks", ["/Create", "/F", "/SC", "DAILY", "/ST", t, "/TN", name, "/TR", tr], { noShell: true });
    r.code === 0 ? log.ok(`Task Scheduler: ${name} (${t})`) : log.warn(`schtasks failed for ${name}: ${r.err || r.out}`);
  });
}
