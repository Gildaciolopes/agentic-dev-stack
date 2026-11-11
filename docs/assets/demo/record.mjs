// Renders demo.html frame by frame (deterministic, 2x) and encodes an optimized GIF with ffmpeg.
// Usage: node record.mjs [fps=20] [width=1200]   (needs: npm i --no-save playwright-core, Google Chrome, ffmpeg)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const here = path.dirname(new URL(import.meta.url).pathname);
const fps = Number(process.argv[2] || 20), width = Number(process.argv[3] || 1200);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ads-demo-"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 });
await page.goto("file://" + path.join(here, "demo.html"));
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
const total = await page.evaluate(() => window.TOTAL);
const n = Math.ceil(total * fps);
for (let i = 0; i < n; i++) {
  await page.evaluate((t) => window.render(t), i / fps);
  await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(4, "0")}.png`) });
}
await browser.close();
const out = path.join(here, "..", "demo.gif");
const vf = `scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle`;
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(tmp, "f%04d.png"), "-vf", vf, "-loop", "0", out]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${n} frames -> ${out} (${(fs.statSync(out).size / 1e6).toFixed(2)} MB)`);
