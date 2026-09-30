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

  // 焦点探针：瞥一眼不能有代价。用真实鼠标逐个点 gizmo，宿主编辑区的焦点和选区必须原样留着。
  const spots = await page.evaluate(() => window.__focusSetup());
  for (const [name, at] of Object.entries(spots)) {
    await page.evaluate(() => window.__focusReset());
    const before = await page.evaluate(() => window.__focusState());
    await page.mouse.move(at.x, at.y);
    await page.mouse.down(); await page.mouse.up();
    const st = await page.evaluate(() => window.__focusState());
    results.push({ name: `focus:点「${name}」之后焦点和选区还在宿主的编辑区`, ok: st.active === "editor" && st.sel === "2-4", info: `焦点在 ${st.active}，选区 ${st.sel}` });
    // 不抢焦点不能变成点不动：该有的效果必须照样发生
    const effect = {
      "＋": () => [st.opens === before.opens + 1 && st.anchor.includes("plus"), `菜单开了 ${st.opens - before.opens} 次，挂在 ${st.anchor}`],
      "计数": () => [st.opens === before.opens + 1 && st.anchor.includes("chip-count"), `列表开了 ${st.opens - before.opens} 次，挂在 ${st.anchor}`],
      "上一张": () => [st.index !== before.index, `第 ${before.index + 1} 张 → 第 ${st.index + 1} 张`],
      "下一张": () => [st.index !== before.index, `第 ${before.index + 1} 张 → 第 ${st.index + 1} 张`],
      "×": () => [before.open === true && st.open === false, `窗 ${before.open ? "开" : "关"} → ${st.open ? "开" : "关"}`],
    }[name];
    if (effect) { const [ok, info] = effect(); results.push({ name: `click:真实鼠标点「${name}」照样有效`, ok, info }); }
  }
  // 0.3.1 粘贴归焦点（user 2026-09-30「这个看 focus 吧」）：点窗身（画面）→ 焦点到窗（hasFocus）；点回宿主编辑区 → 焦点回去
  await page.evaluate(() => window.__focusReset());
  const body = await page.evaluate(() => { const r = window.__focusEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(body.x, body.y); await page.mouse.down(); await page.mouse.up();
  const fb = await page.evaluate(() => ({ st: window.__focusState(), has: window.__focusEl.hasFocus, active: document.activeElement === window.__focusEl }));
  results.push({ name: "focus:真实鼠标点窗身 → 焦点落到参考窗（hasFocus=true，activeElement=窗）", ok: fb.has && fb.active && fb.st.active !== "editor", info: `hasFocus=${fb.has} active=${fb.st.active}` });
  await page.evaluate(() => { document.getElementById("editor").focus(); });
  const fb2 = await page.evaluate(() => ({ has: window.__focusEl.hasFocus, st: window.__focusState() }));
  results.push({ name: "focus:焦点回宿主编辑区 → hasFocus=false", ok: !fb2.has && fb2.st.active === "editor", info: `hasFocus=${fb2.has} active=${fb2.st.active}` });
  // 拖动把手：真实鼠标按住拖 60 像素，窗跟着走
  await page.evaluate(() => window.__focusReset());
  const r0 = await page.evaluate(() => { const r = window.__focusEl.getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await page.mouse.move(r0.x + 5, r0.y + 5); await page.mouse.down();
  await page.mouse.move(r0.x + 65, r0.y + 45, { steps: 5 }); await page.mouse.up();
  const r1 = await page.evaluate(() => { const r = window.__focusEl.getBoundingClientRect(); return { x: r.left, y: r.top, st: window.__focusState() }; });
  results.push({ name: "click:真实鼠标拖移动把手 → 窗跟着走，焦点不动", ok: Math.round(r1.x - r0.x) === 60 && Math.round(r1.y - r0.y) === 40 && r1.st.active === "editor", info: `Δ=${Math.round(r1.x - r0.x)},${Math.round(r1.y - r0.y)} 焦点在 ${r1.st.active}` });
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
