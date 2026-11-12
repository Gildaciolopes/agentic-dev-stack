#!/usr/bin/env node
// Maintainer tool (used by .github/workflows/pins.yml): looks for newer releases of the pinned third-party tools
// in config/versions.json and rewrites the file. A release must be at least MIN_AGE_DAYS old, so a compromised
// release that gets yanked within days never reaches a pin. A human still reviews and merges the PR.
//   node scripts/maintainer/check-pins.mjs [--write]      prints a markdown table of changes
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "config", "versions.json");
const MIN_AGE_DAYS = Number(process.env.MIN_AGE_DAYS || 3);
const GH = { accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };

const semver = (v) => (String(v).match(/^v?(\d+)\.(\d+)\.(\d+)$/) || []).slice(1).map(Number);
const cmp = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const oldEnough = (date) => date && Date.now() - new Date(date).getTime() >= MIN_AGE_DAYS * 86_400_000;
const get = async (url, headers = {}) => { const r = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) }); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); };

async function latest(dep) {
  if (dep.source === "npm") {
    const d = await get(`https://registry.npmjs.org/${dep.package}`);
    return Object.keys(d.versions).filter((v) => semver(v).length && oldEnough(d.time[v])).sort(cmp).pop();
  }
  if (dep.source === "pypi") {
    const d = await get(`https://pypi.org/pypi/${dep.package}/json`);
    return Object.entries(d.releases).filter(([v, files]) => semver(v).length && files.length && !files.every((f) => f.yanked) && oldEnough(files[0].upload_time_iso_8601))
      .map(([v]) => v).sort(cmp).pop();
  }
  if (dep.source === "github-tags") {
    const tags = (await get(`https://api.github.com/repos/${dep.repo}/tags?per_page=100`, GH)).map((t) => t.name).filter((n) => semver(n).length).sort(cmp).reverse();
    for (const tag of tags.slice(0, 5)) {
      const c = await get(`https://api.github.com/repos/${dep.repo}/commits/${encodeURIComponent(tag)}`, GH);
      if (oldEnough(c.commit?.committer?.date)) return tag;
    }
    return null;
  }
  throw new Error(`unknown source ${dep.source}`);
}

const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
const changes = [];
for (const [name, dep] of Object.entries(data)) {
  if (name.startsWith("$")) continue;
  try {
    const v = await latest(dep);
    if (v && cmp(v, dep.version) > 0) { changes.push(`| ${name} | ${dep.version} | ${v} | ${dep.repo || dep.package} (${dep.source}) |`); dep.version = v; }
  } catch (e) { console.error(`! ${name}: ${e.message}`); }
}
if (!changes.length) { console.log("All pins are current."); process.exit(0); }
console.log(`| tool | pinned | newest (>= ${MIN_AGE_DAYS} days old) | source |\n|---|---|---|---|\n${changes.join("\n")}`);
if (process.argv.includes("--write")) fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
