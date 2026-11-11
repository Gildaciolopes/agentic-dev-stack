// Renders an .excalidraw scene to SVG (fonts embedded) and a PNG preview with headless Chrome.
// Usage: node render.mjs <in.excalidraw> <out.svg> <out.png>   (needs: npm i --no-save playwright-core, Google Chrome)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [, , input, outSvg, outPng] = process.argv;
const root = path.dirname(new URL(import.meta.url).pathname);
const types = { ".js": "text/javascript", ".mjs": "text/javascript", ".woff2": "font/woff2", ".json": "application/json", ".html": "text/html" };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (req.url === "/" ) { res.writeHead(200, { "content-type": "text/html" }); return res.end("<!doctype html><html><body></body></html>"); }
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const port = server.address().port;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1600, height: 1100 } });
page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
await page.goto(`http://127.0.0.1:${port}/`);
const scene = JSON.parse(fs.readFileSync(input, "utf8"));
const svg = await page.evaluate(async (scene) => {
  window.EXCALIDRAW_ASSET_PATH = "https://esm.sh/@excalidraw/excalidraw@0.18.1/dist/prod/";
  const lib = await import("https://esm.sh/@excalidraw/excalidraw@0.18.1?bundle&deps=react@19.1.0,react-dom@19.1.0");
  const el = await lib.exportToSvg({
    elements: scene.elements,
    appState: { ...scene.appState, exportBackground: true, exportWithDarkMode: false, exportPadding: 30 },
    files: scene.files || {},
  });
  return el.outerHTML;
}, scene);
fs.writeFileSync(outSvg, svg);
const bg = scene.appState?.viewBackgroundColor || "#ffffff";
await page.setContent(`<html><body style="margin:0;background:${bg}">${svg}</body></html>`);
await page.waitForTimeout(800);
const box = await page.locator("svg").first().boundingBox();
await page.screenshot({ path: outPng, clip: box, fullPage: true });
await browser.close();
server.close();
console.log("ok", outSvg, (svg.length / 1024).toFixed(0) + "KB");
