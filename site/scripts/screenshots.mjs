// Visual QA screenshots. Usage: SHOT_DIR=... BASE=http://localhost:3330 node scripts/screenshots.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3330";
const DIR = process.env.SHOT_DIR ?? "screenshots";
mkdirSync(DIR, { recursive: true });

const pages = [
  ["home", "/"],
  ["architecture", "/architecture"],
  ["docs", "/docs"],
  ["docs-01", "/docs/01-architecture"],
  ["changelog", "/changelog"],
  ["404", "/nope"],
];
const themes = ["light", "dark"];
const widths = [375, 768, 1440];

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(innerHeight * 0.4));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 300));
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
}

const browser = await chromium.launch();
const overflow = [];
for (const theme of themes) {
  for (const width of widths) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme);
    const page = await ctx.newPage();
    for (const [name, path] of pages) {
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      if (name === "home") {
        await page.waitForTimeout(800);
        await page.screenshot({ path: join(DIR, `home-fold-${theme}-${width}.png`) });
      }
      await scrollThrough(page);
      await page.screenshot({ path: join(DIR, `${name}-${theme}-${width}.png`), fullPage: true });
    }
    await ctx.close();
  }
}
// horizontal overflow check at 320 and 375
for (const width of [320, 375]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    if (r.sw > r.iw) overflow.push(`${name}@${width}: scrollWidth ${r.sw} > ${r.iw}`);
  }
  await ctx.close();
}
await browser.close();
console.log(overflow.length ? "OVERFLOW:\n" + overflow.join("\n") : "no horizontal overflow at 320/375");
