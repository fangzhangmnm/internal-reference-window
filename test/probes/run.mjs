// 浏览器探针入口：起一个只听本机的静态服务器 → 无头 Chromium 打开 page.html → 读 window.__PROBE__。
// created 2026-09-29 by Claude Fable 5.1
// 用法：npm run build && node test/probes/run.mjs
// playwright 借 WeebPaint 的 node_modules（家族惯例：兄弟仓的探针都借它，本库不另装一份浏览器）。
// 服务器只服务本库目录、只听 127.0.0.1，探针跑完就关——它是测试脚手架，不是库的一部分。
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.resolve(root, "../20260524 WeebPaint/package.json"));
const { chromium } = require("playwright");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json" };
const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const t0 = Date.now();
const browser = await chromium.launch();
let failed = 0, results = [];
const pageErrors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/test/probes/page.html`);
  await page.waitForFunction(() => window.__PROBE__, null, { timeout: 60_000 });
  results = await page.evaluate(() => window.__PROBE__);
} catch (e) {
  results.push({ name: "探针没跑完", ok: false, info: String(e?.message ?? e) });
} finally {
  await browser.close();
  server.close();
}

for (const r of results) {
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${r.name}${r.info ? `  \x1b[90m[${r.info}]\x1b[0m` : ""}`);
}
// 解坏图那一项本来就会让浏览器在控制台报一条解码错误；其余的页面错误一律算失败。
const unexpected = pageErrors.filter((m) => !/decode|InvalidStateError|could not be decoded/i.test(m));
for (const m of unexpected) { failed++; console.log(`  \x1b[31m✗\x1b[0m 页面报错：${m.slice(0, 300)}`); }
console.log(`\n  ${results.length - results.filter((r) => !r.ok).length} passed, ${failed} failed — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failed ? 1 : 0);
