// 浏览器探针的检查项（真浏览器才有自定义元素和 shadow DOM，node 测不到）。
// created 2026-09-29 by Claude Fable 5.1
// 吃的是 dist/（先 npm run build）。每项结果进 window.__PROBE__，由 run.mjs 读走。
import "/dist/index.js";
import { createDeck } from "/dist/deck/index.js";

const results = [];
const add = (name, ok, info = "") => results.push({ name, ok: !!ok, info: String(info) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
async function until(fn, ms = 3000) {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) { if (fn()) return true; await wait(20); }
  return !!fn();
}
async function png(color, w = 32, h = 32) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, w, h);
  return await new Promise((r) => c.toBlob(r, "image/png"));
}
function center(el) {
  const cv = el.shadowRoot.querySelector("canvas");
  const d = cv.getContext("2d").getImageData(cv.width >> 1, cv.height >> 1, 1, 1).data;
  return [d[0], d[1], d[2], d[3]].join(",");
}
const RED = "255,0,0,255", GREEN = "0,255,0,255", BLUE = "0,0,255,255";
const count = (el) => el.shadowRoot.querySelector(".chip-count").textContent;
const chipsHidden = (el) => el.shadowRoot.querySelector(".chips").classList.contains("hidden");
let spawn = 0;
function mount() {
  const el = document.createElement("wp-reference-window");
  document.body.appendChild(el);
  el.rect = { left: 300 + (spawn++ % 3) * 260, top: 120, width: 240, height: 200 };
  el.open = true;
  return el;
}
function listen(el) {
  const log = [];
  for (const n of ["itemschange", "viewportchange", "rectchange", "openchange", "notice"]) el.addEventListener(n, (e) => log.push({ n, d: e.detail }));
  return log;
}
const names = (log) => log.map((e) => e.n).filter((n) => n !== "rectchange").join(",");

async function deckDriven() {
  const el = mount(), log = listen(el);
  const red = await png("#ff0000"), green = await png("#00ff00"), blue = await png("#0000ff");

  const idR = el.deck.add({ kind: "image", name: "红", bytes: red });
  await until(() => center(el) === RED);
  add("deck:宿主只给字节 → 库自己解出来画上", center(el) === RED, center(el));
  add("deck:一张卡不出翻页条", chipsHidden(el));

  const idG = el.deck.add({ kind: "image", name: "绿", bytes: green });
  await until(() => center(el) === GREEN);
  add("deck:加第二张 → 翻到新卡，翻页条 2/2", center(el) === GREEN && !chipsHidden(el) && count(el) === "2/2", `${center(el)} ${count(el)}`);

  el.deck.select(0); await frame();
  add("deck:宿主从外面翻页 → 视图跟着换", center(el) === RED && count(el) === "1/2", `${center(el)} ${count(el)}`);

  el.deck.move(idG, 0); await frame();
  add("deck:挪动顺序 → 还在看原来那张，计数变 2/2", center(el) === RED && count(el) === "2/2", `${center(el)} ${count(el)}`);
  add("deck:程序性改动不发任何 DOM 事件", names(log) === "", names(log));

  el.deck.remove(idR); await frame();
  add("deck:从外面删掉正在看的卡 → 换到剩下那张", center(el) === GREEN && chipsHidden(el), center(el));

  // 用户交互这条路：照旧发事件，而且牌组跟着动、别的监听者也收到
  el.deck.add({ kind: "image", name: "蓝", bytes: blue });
  await until(() => center(el) === BLUE);
  const seen = []; el.deck.onChange((c) => seen.push(c.type));
  log.length = 0;
  el.shadowRoot.querySelector('[data-page="1"]').click(); await frame();
  add("user:点翻页 → 发 itemschange；牌组跟着翻；别的监听者收到 view",
    names(log).includes("itemschange") && el.deck.index === 0 && seen.includes("view") && center(el) === GREEN,
    `events=${names(log)} index=${el.deck.index} seen=${seen.join("/")} ${center(el)}`);

  // 老方法落进同一副牌
  const bm = await createImageBitmap(blue), n0 = el.deck.size;
  log.length = 0;
  el.addImage(bm, blue); await frame();
  const st = el.getRefState();
  add("wrapper:addImage 落进牌组，getRefState 对得上，不发事件",
    el.deck.size === n0 + 1 && el.deck.current.bytes === blue && st.items.length === n0 + 1 && st.items[st.index].blob === blue && names(log) === "",
    `size=${el.deck.size} events=${names(log)}`);

  // 解不出来要说
  let notice = null;
  el.addEventListener("notice", (e) => { notice = e.detail; }, { once: true });
  el.deck.add({ kind: "image", name: "坏图", bytes: new Blob(["not an image"], { type: "image/png" }) });
  await until(() => notice);
  add("deck:解不出来的字节 → 发 notice，不装没事", notice?.code === "decode-failed" && notice?.name === "坏图" && notice?.level === "error", JSON.stringify(notice));
  el.remove();
}

async function sharedDeck() {
  const shared = createDeck(), a = mount(), b = mount();
  a.deck = shared; b.deck = shared;
  shared.add({ kind: "image", bytes: await png("#ff0000") });
  await until(() => center(a) === RED && center(b) === RED);
  add("deck:两个视图共用一副牌，都画得出来", center(a) === RED && center(b) === RED, `${center(a)} | ${center(b)}`);
  // 在一个视图里翻页，另一个跟着翻
  shared.add({ kind: "image", bytes: await png("#00ff00") });
  await until(() => center(a) === GREEN && center(b) === GREEN);
  a.shadowRoot.querySelector('[data-page="1"]').click(); await frame();
  add("deck:在一个视图里翻页 → 另一个视图跟着翻", center(a) === RED && center(b) === RED && count(b) === "1/2", `${center(a)} | ${center(b)} ${count(b)}`);
  a.remove(); b.remove();
}

async function liveViaDeck() {
  const el = mount();
  let calls = 0;
  const src = document.createElement("canvas"); src.width = src.height = 16;
  const sx = src.getContext("2d"); sx.fillStyle = "#00ff00"; sx.fillRect(0, 0, 16, 16);
  el.liveProvider = () => { calls++; return src; };
  const id = el.deck.add({ kind: "live" });
  await until(() => center(el) === GREEN);
  add("live:宿主往牌组里加画布小窗 → 画出来", center(el) === GREEN && el.live === true, center(el));
  // 刚加进来时组件会在节流间隔（300 毫秒）之后补一帧收尾——这是 WeebPaint 原有行为。等它落定再开始数。
  await wait(700);
  const c0 = calls;
  sx.fillStyle = "#0000ff"; sx.fillRect(0, 0, 16, 16);
  await wait(350);
  add("live:宿主没报变化 → 不去要帧", calls === c0 && center(el) === GREEN, `calls ${c0}→${calls}`);
  el.deck.invalidate(id);
  await until(() => center(el) === BLUE, 2000);
  add("live:deck.invalidate → 重新要一帧", center(el) === BLUE && calls > c0, `${center(el)} calls ${c0}→${calls}`);
  el.remove();
}

try {
  await customElements.whenDefined("wp-reference-window");
  await deckDriven();
  await sharedDeck();
  await liveViaDeck();
} catch (e) {
  add("探针自己炸了", false, String(e?.stack ?? e));
}
window.__PROBE__ = results;
