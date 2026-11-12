// "New version available" notice. At most one registry request per day (cached), 1.5 s budget, never blocks or fails
// a command. Off in CI, tests, non-TTY output, or with NO_UPDATE_NOTIFIER=1.
import { home, p, readJSON, writeJSON } from "./util.mjs";

const DAY = 86_400_000;
const cacheFile = () => p(home(), ".local", "share", "agentic-dev-stack", "update-check.json");

export function newer(a, b) {
  const x = String(a).split(/[.-]/).map(Number), y = String(b).split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

export const updateCheckEnabled = () => !process.env.NO_UPDATE_NOTIFIER && !process.env.CI && !process.env.ADS_HOME && !!process.stdout.isTTY;

/** Resolves to the latest version string when it is newer than `current`, else null. */
export async function checkForUpdate(current, { force = false, fetchImpl = fetch } = {}) {
  if (!force && !updateCheckEnabled()) return null;
  const cache = readJSON(cacheFile());
  let latest = cache.latest;
  if (force || !cache.checked || Date.now() - cache.checked > DAY) {
    try {
      const r = await fetchImpl("https://registry.npmjs.org/agentic-dev-stack/latest", { signal: AbortSignal.timeout(1500), headers: { accept: "application/json" } });
      if (r.ok) latest = (await r.json()).version;
    } catch { /* offline: say nothing */ }
    // cached even when offline, so a machine without network waits at most once a day
    try { writeJSON(cacheFile(), { checked: Date.now(), latest }); } catch { /* read-only home */ }
  }
  return latest && newer(latest, current) ? latest : null;
}

export function updateNotice(current, latest) {
  const y = (s) => (process.stdout.isTTY && !process.env.NO_COLOR ? `\x1b[33m${s}\x1b[0m` : s);
  return `\n  ${y("Update available")} ${current} → ${latest}\n  Run: npx agentic-dev-stack@latest   (changelog: https://github.com/Gildaciolopes/agentic-dev-stack/blob/main/CHANGELOG.md)\n`;
}
