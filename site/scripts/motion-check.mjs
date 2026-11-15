// Motion + 3D checks. Usage: SHOT_DIR=... BASE=http://localhost:3330 node scripts/motion-check.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3330";
const DIR = process.env.SHOT_DIR ?? "screenshots";
mkdirSync(DIR, { recursive: true });
const shot = (page, name, opts = {}) => page.screenshot({ path: join(DIR, name), ...opts });
const results = [];
const check = (name, ok, note = "") => {
  results.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? "  -- " + note : ""}`);
};

const initScript = () => {
  localStorage.setItem("theme", "dark");
  window.__vt = 0;
  const orig = document.startViewTransition?.bind(document);
  if (orig) {
    document.startViewTransition = (...a) => {
      window.__vt++;
      return orig(...a);
    };
  }
  window.__lt = [];
  window.__cls = 0;
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => {
        if (!e.hadRecentInput) window.__cls += e.value;
      }),
    ).observe({ type: "layout-shift", buffered: true });
  } catch {}
};

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const logs = [];
const hook = (page, tag) => {
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) logs.push(`[${tag}] ${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => logs.push(`[${tag}] pageerror: ${String(e).slice(0, 300)}`));
};

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(initScript);
const page = await ctx.newPage();
hook(page, "1440");
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

// (a) hero animates
await page.waitForTimeout(600);
const a1 = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 700 } });
await page.waitForTimeout(1000);
const a2 = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 700 } });
await shot(page, "hero-t0.png", { clip: { x: 0, y: 0, width: 1440, height: 700 } });
await page.waitForTimeout(1000);
await shot(page, "hero-t1.png", { clip: { x: 0, y: 0, width: 1440, height: 700 } });
check("a) hero differs after 1s", !a1.equals(a2));

console.log("DBG-b", await page.evaluate(() => [...document.querySelectorAll("main > div")].map((e) => Math.round(e.getBoundingClientRect().height)).join(",")));
// (b) architecture scroll steps
const wrapInfo = await page.evaluate(() => {
  const w = document.querySelector("[data-mode]")?.firstElementChild;
  const r = w?.getBoundingClientRect();
  return r ? { top: r.top + scrollY, h: r.height } : null;
});
const dockText = () => page.evaluate(() => (document.querySelector('[class*="dock"]')?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120));
const visibleNodes = () =>
  page.evaluate(() => [...document.querySelectorAll('g[class*="_node"]')].filter((n) => n.style.visibility !== "hidden" && parseFloat(n.style.opacity || "1") > 0.5).length);
const counts = [];
const captions = new Set();
if (wrapInfo) {
  const wtop = wrapInfo.top;
  const span = wrapInfo.h - 900;
  for (let i = 0; i < 7; i++) {
    const y = wtop + 40 + (span * (i + 0.5)) / 7;
    await page.evaluate((yy) => scrollTo({ top: yy, behavior: "instant" }), y);
    await page.waitForTimeout(1800);
    const n = await visibleNodes();
    const c = await dockText();
    counts.push(n);
    captions.add(c);
    await shot(page, `arch-step-${i + 1}.png`);
  }
}
const progressive = counts.length === 7 && counts[6] > counts[0] && counts.every((v, i) => i === 0 || v >= counts[i - 1]);
check("b) nodes appear progressively", progressive, `visible nodes per step: ${counts.join(",")}`);
check("b) captions change", captions.size >= 4, `${captions.size} distinct captions`);

console.log("DBG-c", await page.evaluate(() => [...document.querySelectorAll("main > div")].map((e) => Math.round(e.getBoundingClientRect().height)).join(",")));
// (c) run a feature
const archTop = await page.evaluate(() => scrollY);
await page.getByRole("button", { name: /run a feature/i }).first().click();
await page.waitForTimeout(400);
await shot(page, "run-1.png");
await page.waitForTimeout(1500);
await shot(page, "run-2.png");
await page.waitForTimeout(2500);
await shot(page, "run-3.png");
const toastSeen = await page.waitForFunction(() => [...document.querySelectorAll("p,span,div")].some((e) => e.children.length === 0 && /committed on your ok/i.test(e.textContent ?? "") && e.getBoundingClientRect().width > 0), null, { timeout: 40000 }).then(() => true).catch(() => false);
await shot(page, "run-toast.png");
check("c) toast 'committed on your ok'", toastSeen);

console.log("DBG-d", await page.evaluate(() => [...document.querySelectorAll("main > div")].map((e) => Math.round(e.getBoundingClientRect().height)).join(",")));
// (d) node -> dialog
await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), archTop);
await page.waitForTimeout(800);
const nodeBtn = page.locator('button[class*="nodeBtn"]:not([aria-hidden="true"])').first();
let dlg = false;
try {
  await nodeBtn.click({ timeout: 4000, force: true });
  await page.waitForTimeout(900);
  dlg = await page.locator('dialog[open]').first().isVisible();
  const txt = (await page.locator('dialog[open]').first().textContent())?.length ?? 0;
  await shot(page, "dialog-open.png");
  await page.keyboard.press("Escape");
  const closed = await page.waitForSelector("dialog[open]", { state: "detached", timeout: 5000 }).then(() => true).catch(() => false);
  check("d) node opens MorphDialog with content, Esc closes", dlg && txt > 20 && closed, `open=${dlg} chars=${txt} closed=${closed}`);
} catch (e) {
  check("d) node opens MorphDialog", false, String(e).slice(0, 150));
}

console.log("DBG-e", await page.evaluate(() => [...document.querySelectorAll("main > div")].map((e) => Math.round(e.getBoundingClientRect().height)).join(",")));
// (e) Architecture <-> Workflow
await page.getByRole("radio", { name: "Workflow" }).first().click();
await page.waitForTimeout(1800);
await shot(page, "view-workflow.png");
const dv = await page.locator('[data-view]').first().getAttribute("data-view");
await page.getByRole("radio", { name: "Architecture" }).first().click();
await page.waitForTimeout(1800);
await shot(page, "view-architecture.png");
const dv2 = await page.locator('[data-view]').first().getAttribute("data-view");
check("e) picker switches views", dv === "workflow" && dv2 === "architecture", `${dv} -> ${dv2}`);

// (f) 3D
const toggle = page.getByRole("button", { name: /^3D view$/ }).first();
const toggleVisible = await toggle.isVisible().catch(() => false);
if (toggleVisible) {
  const before = logs.length;
  await toggle.click();
  let canvas = false;
  try {
    await page.waitForSelector("canvas", { timeout: 15000 });
    canvas = true;
  } catch {}
  await page.waitForTimeout(2500);
  const gl = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return null;
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  });
  await shot(page, "arch-3d.png");
  check("f) 3D architecture canvas + WebGL", canvas && gl !== false, `canvas=${canvas} gl=${gl} newLogs=${logs.length - before}`);
  await page.getByRole("button", { name: /^2D view$/ }).first().click().catch(() => {});
  await page.waitForTimeout(600);
} else {
  check("f) 3D toggle shown", false, "toggle not visible (device capability gate?)");
}
// token funnel
console.log("DBG", page.url(), await page.evaluate(() => [document.querySelectorAll("section").length, document.querySelectorAll("[id]").length, [...document.querySelectorAll("main > div, main > section")].map((e) => (e.querySelector("section")?.id || e.id) + ":" + Math.round(e.getBoundingClientRect().height)).join(" ")].join(",")));
await page.evaluate(() => scrollTo({ top: document.querySelector("#tokens")?.getBoundingClientRect().top + scrollY, behavior: "instant" }));
await page.waitForTimeout(1200);
for (let i = 0; i < 6; i++) {
  await page.mouse.wheel(0, 250);
  await page.waitForTimeout(500);
}
await page.waitForSelector("canvas", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2500);
const canvases = await page.locator("canvas").count();
await shot(page, "funnel-3d.png");
check("f) token funnel canvas", canvases > 0, `${canvases} canvas in DOM`);

// (g) theme toggle
await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
await page.waitForTimeout(500);
const cls0 = await page.evaluate(() => document.documentElement.className);
await page.getByRole("radio", { name: "Light" }).first().click();
await page.waitForTimeout(1200);
const cls1 = await page.evaluate(() => document.documentElement.className);
const vt = await page.evaluate(() => window.__vt);
check("g) theme toggle flips html class + view transition", cls0 !== cls1 && vt >= 1, `class "${cls0}" -> "${cls1}", startViewTransition calls=${vt}`);
await shot(page, "theme-light.png");

// perf: scripted scroll of whole home page (dark)
await page.getByRole("radio", { name: "Dark" }).first().click();
await page.waitForTimeout(800);
await page.evaluate(() => scrollTo(0, 0));
await page.evaluate(() => (window.__lt.length = 0));
await page.evaluate(async () => {
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += 300) {
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 40));
  }
});
const lt = await page.evaluate(() => window.__lt);
console.log(`LONGTASKS during scroll: count=${lt.length} max=${Math.max(0, ...lt).toFixed(0)}ms total=${lt.reduce((a, b) => a + b, 0).toFixed(0)}ms`);
await ctx.close();

// (h) reduced motion
const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
await rctx.addInitScript(initScript);
const rp = await rctx.newPage();
hook(rp, "reduced");
await rp.goto(BASE + "/", { waitUntil: "networkidle" });
await rp.evaluate(() => document.querySelector("#architecture")?.scrollIntoView());
await rp.waitForTimeout(1500);
const rinfo = await rp.evaluate(() => {
  const w = document.querySelector("[data-mode]")?.firstElementChild;
  const stage = document.querySelector('[class*="_stage"]');
  const pos = stage ? getComputedStyle(stage).position : "";
  const nodes = [...document.querySelectorAll('g[class*="_node"]')];
  return { wrapH: w?.getBoundingClientRect().height, pos, shown: nodes.filter((n) => n.style.visibility !== "hidden" && parseFloat(n.style.opacity || "1") > 0.5).length, total: nodes.length };
});
await shot(rp, "arch-reduced.png");
check("h) reduced motion: assembled, no pin", rinfo.pos !== "sticky" && rinfo.shown >= (counts[6] ?? 1) && rinfo.wrapH < 1500, JSON.stringify(rinfo));
await rctx.close();

// (i) mobile step-through
const mctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
await mctx.addInitScript(initScript);
const mp = await mctx.newPage();
hook(mp, "375");
await mp.goto(BASE + "/architecture", { waitUntil: "networkidle" });
await mp.waitForTimeout(1200);
await mp.getByRole("button", { name: "Next step" }).scrollIntoViewIfNeeded();
const c1 = await mp.locator('[class*="storyCount"]').textContent();
await shot(mp, "mobile-step-1.png");
await mp.getByRole("button", { name: "Next step" }).click();
await mp.getByRole("button", { name: "Next step" }).click();
await mp.waitForTimeout(1500);
const c2 = await mp.locator('[class*="storyCount"]').textContent();
await shot(mp, "mobile-step-3.png");
await mp.getByRole("button", { name: "Previous step" }).click();
await mp.waitForTimeout(800);
const c3 = await mp.locator('[class*="storyCount"]').textContent();
check("i) mobile Prev/Next", /1 of 7/.test(c1 ?? "") && /3 of 7/.test(c2 ?? "") && /2 of 7/.test(c3 ?? ""), `${c1} | ${c2} | ${c3}`);
await mctx.close();

// CLS on load
for (const w of [375, 1440]) {
  for (const path of ["/", "/architecture"]) {
    const c = await browser.newContext({ viewport: { width: w, height: 900 } });
    await c.addInitScript(initScript);
    const p = await c.newPage();
    hook(p, `cls${w}`);
    await p.goto(BASE + path, { waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    const cls = await p.evaluate(() => window.__cls);
    console.log(`CLS ${path} @${w}: ${cls.toFixed(4)}`);
    await c.close();
  }
}

console.log("\nCONSOLE/PAGE ERRORS:", logs.length ? "\n" + [...new Set(logs)].join("\n") : "none");
await browser.close();
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
