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
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });   // 音频卡探针里 togglePlay 不是从真点击来的
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
      "左上角圆钮": () => [before.min === false && st.min === true, `收着 ${before.min} → ${st.min}`],
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
  // 0.4.0 音频卡的播放钮：真实鼠标点 → 照样放，焦点和选区留在宿主
  await page.evaluate(() => window.__focusReset());
  const pb = await page.evaluate(() => window.__focusAudio());
  await page.mouse.move(pb.x, pb.y); await page.mouse.down(); await page.mouse.up();
  await page.waitForFunction(() => window.__focusEl.playing, null, { timeout: 3000 }).catch(() => {});
  const ap = await page.evaluate(() => window.__focusState());
  results.push({ name: "focus:真实鼠标点音频卡的播放钮 → 放起来，焦点和选区还在宿主", ok: ap.playing && ap.active === "editor" && ap.sel === "2-4", info: `playing=${ap.playing} 焦点在 ${ap.active}，选区 ${ap.sel}` });
  await page.evaluate(() => window.__focusEl.togglePlay());
  // 拖动把手：真实鼠标按住拖 60 像素，窗跟着走
  await page.evaluate(() => window.__focusReset());
  const r0 = await page.evaluate(() => { const r = window.__focusEl.getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await page.mouse.move(r0.x + 5, r0.y + 5); await page.mouse.down();
  await page.mouse.move(r0.x + 65, r0.y + 45, { steps: 5 }); await page.mouse.up();
  const r1 = await page.evaluate(() => { const r = window.__focusEl.getBoundingClientRect(); return { x: r.left, y: r.top, st: window.__focusState() }; });
  results.push({ name: "click:真实鼠标拖移动把手 → 窗跟着走，焦点不动", ok: Math.round(r1.x - r0.x) === 60 && Math.round(r1.y - r0.y) === 40 && r1.st.active === "editor", info: `Δ=${Math.round(r1.x - r0.x)},${Math.round(r1.y - r0.y)} 焦点在 ${r1.st.active}` });
  // 0.4.1 左上角难拖（user 2026-10-13）：以前能按中的只有 22 px 三角的一半；现在点 (30, 12)——在老三角外、新的 36 px 方块里——也拖得动
  await page.evaluate(() => window.__focusReset());
  const q0 = await page.evaluate(() => { const r = window.__focusEl.getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await page.mouse.move(q0.x + 30, q0.y + 12); await page.mouse.down();
  await page.mouse.move(q0.x + 30 + 50, q0.y + 12 + 20, { steps: 5 }); await page.mouse.up();
  const q1 = await page.evaluate(() => { const r = window.__focusEl.getBoundingClientRect(); return { x: r.left, y: r.top }; });
  results.push({ name: "click:0.4.1 把手可点区放大：点老三角之外 (30, 12) 也拖得动", ok: Math.round(q1.x - q0.x) === 50 && Math.round(q1.y - q0.y) === 20, info: `Δ=${Math.round(q1.x - q0.x)},${Math.round(q1.y - q0.y)}` });
  // 0.4.1 收成小图标（user 2026-10-09）：＋ 菜单「收成小图标」→ 44 px 圆钮、rect 还报原来的宽高；拖它 = 挪；点它 = 恢复原大小
  const m0 = await page.evaluate(() => { const el = window.__focusEl; window.__mins = []; el.addEventListener("minimizechange", (e) => window.__mins.push(e.detail.minimized)); const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  await page.evaluate(() => window.__focusReset());
  const plus = await page.evaluate(() => { const r = window.__focusEl.shadowRoot.querySelector(".plus").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(plus.x, plus.y); await page.mouse.down(); await page.mouse.up();
  const listed = await page.evaluate(() => (window.__focusMenu.opts?.items?.() ?? window.__focusMenu.opts?.items ?? []).some?.((it) => it.id === "minimize"));
  await page.evaluate(() => window.__focusMenu.opts.onPick("minimize"));
  const m1 = await page.evaluate(() => { const el = window.__focusEl; const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.left, y: r.top, rw: el.rect.width, rh: el.rect.height, mins: [...window.__mins], min: el.minimized }; });
  const bubbleTitle = await page.evaluate(() => window.__focusEl.shadowRoot.querySelector(".bubble").getAttribute("aria-label"));
  results.push({ name: "0.4.2 小图标有提示 / aria-label（labels.restore，没给就是英文默认）", ok: !!bubbleTitle, info: `aria-label=${bubbleTitle}` });
  results.push({ name: "click:0.4.1 ＋ 菜单「收成小图标」→ 44 px 圆钮，rect 照报原宽高，发 minimizechange", ok: listed !== false && m1.min && Math.round(m1.w) === 44 && Math.round(m1.h) === 44 && Math.round(m1.rw) === Math.round(m0.w) && Math.round(m1.rh) === Math.round(m0.h) && m1.mins.join() === "true", info: `菜单里有：${listed} · 外框 ${Math.round(m1.w)}×${Math.round(m1.h)} · rect ${Math.round(m1.rw)}×${Math.round(m1.rh)}（原 ${Math.round(m0.w)}×${Math.round(m0.h)}） · 事件 ${m1.mins}` });
  await page.mouse.move(m1.x + 22, m1.y + 22); await page.mouse.down();
  await page.mouse.move(m1.x + 22 + 300, m1.y + 22 + 200, { steps: 6 }); await page.mouse.up();
  const m2 = await page.evaluate(() => { const el = window.__focusEl; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, min: el.minimized }; });
  results.push({ name: "click:0.4.1 拖小图标 = 挪位置（还收着）", ok: m2.min && Math.round(m2.x - m1.x) === 300 && Math.round(m2.y - m1.y) === 200, info: `Δ=${Math.round(m2.x - m1.x)},${Math.round(m2.y - m1.y)} 收着=${m2.min}` });
  await page.mouse.move(m2.x + 22, m2.y + 22); await page.mouse.down(); await page.mouse.up();
  const m3 = await page.evaluate(() => { const el = window.__focusEl; const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight, min: el.minimized, mins: [...window.__mins] }; });
  results.push({ name: "click:0.4.1 点小图标 = 恢复原大小、钳在屏幕内、发 minimizechange(false)", ok: !m3.min && Math.round(m3.w) === Math.round(m0.w) && Math.round(m3.h) === Math.round(m0.h) && m3.right <= m3.vw + 0.5 && m3.bottom <= m3.vh + 0.5 && m3.mins.join() === "true,false", info: `${Math.round(m3.w)}×${Math.round(m3.h)} 右下 ${Math.round(m3.right)},${Math.round(m3.bottom)}（视口 ${m3.vw}×${m3.vh}） 事件 ${m3.mins}` });
  // 0.4.3 左上角圆钮（user 2026-10-18「左上角那个很akward很难点的…换成一个点了之后变成图标，拖动是拖动的多义按钮」）：
  //   看得见的圆钮在可点区里；真实鼠标点一下 = 缩成小图标、就在原地；再点小图标 = 恢复；拖 3 px 的手抖不算拖（照样是点）
  await page.evaluate(() => { window.__focusReset(); window.__mins = []; });
  const k = await page.evaluate(() => { const el = window.__focusEl; const r = el.getBoundingClientRect(); const kb = el.shadowRoot.querySelector(".move .knob").getBoundingClientRect(); const mv = el.shadowRoot.querySelector(".move").getBoundingClientRect(); return { x: r.left, y: r.top, kx: kb.left - r.left, ky: kb.top - r.top, kw: kb.width, mw: mv.width }; });
  results.push({ name: "0.4.3 左上角是 28 px 圆钮、在 ≥ 36 px 可点区里", ok: Math.round(k.kw) === 28 && k.mw >= 36 && k.kx >= 0 && k.ky >= 0 && k.kx + k.kw <= k.mw, info: `圆钮 ${Math.round(k.kw)} px @ ${Math.round(k.kx)},${Math.round(k.ky)} · 可点区 ${Math.round(k.mw)} px` });
  await page.mouse.move(k.x + k.kx + 14, k.y + k.ky + 14); await page.mouse.down();
  await page.mouse.move(k.x + k.kx + 16, k.y + k.ky + 15, { steps: 2 }); await page.mouse.up();
  const t1 = await page.evaluate(() => { const el = window.__focusEl; const r = el.getBoundingClientRect(); return { min: el.minimized, x: r.left, y: r.top, w: r.width, mins: [...window.__mins] }; });
  results.push({ name: "click:0.4.3 点左上角圆钮（手抖 2 px）= 缩成小图标、就在原地、发 minimizechange", ok: t1.min && Math.round(t1.w) === 44 && Math.round(t1.x) === Math.round(k.x) && Math.round(t1.y) === Math.round(k.y) && t1.mins.join() === "true", info: `收着=${t1.min} ${Math.round(t1.w)} px @ ${Math.round(t1.x)},${Math.round(t1.y)}（原 ${Math.round(k.x)},${Math.round(k.y)}） 事件 ${t1.mins}` });
  await page.mouse.move(t1.x + 22, t1.y + 22); await page.mouse.down(); await page.mouse.up();
  const t2 = await page.evaluate(() => ({ min: window.__focusEl.minimized, mins: [...window.__mins] }));
  results.push({ name: "click:0.4.3 再点小图标 = 恢复", ok: !t2.min && t2.mins.join() === "true,false", info: `收着=${t2.min} 事件 ${t2.mins}` });
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
