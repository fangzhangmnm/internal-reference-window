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

/** 假菜单：记下组件交来的菜单内容，探针自己挑一项点。 */
function fakeMenu(el) {
  const st = { opts: null, opens: 0 };
  el.menuPort = (opts) => { st.opts = opts; st.opens++; return { close() { opts.onClose?.(); st.opts = null; }, refresh() {}, isOpen: true }; };
  st.items = () => { el.shadowRoot.querySelector(".plus").click(); return st.opts.items().filter((i) => !i.hidden); };
  st.pick = (id) => st.opts.onPick(id);
  return st;
}
function solid(color, w = 16, h = 16) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, w, h);
  return c;
}

async function liveGeneral() {
  // 1) 要帧时带上窗口的像素尺寸和 target
  const el = mount(), log = listen(el), menu = fakeMenu(el);
  add("live:宿主没给出帧函数 → ＋ 菜单里不列这一项", !menu.items().some((i) => i.id.startsWith("live")), menu.items().map((i) => i.id).join(","));
  menu.opts && el.menuPort && menu.opts.onClose?.();

  const asked = [];
  const frames = { "cam:A": solid("#ff0000"), "cam:B": solid("#0000ff") };
  el.liveProvider = (want, target) => { asked.push({ want, target }); return frames[target] ?? solid("#00ff00"); };
  el.liveTargets = () => [{ target: "cam:A", label: "正面" }, { target: "cam:B", label: "侧面" }];
  const ids = menu.items().map((i) => i.id).filter((i) => i.startsWith("live"));
  add("live:多台相机 → ＋ 菜单里一台一项", ids.join(",") === "live:cam:A,live:cam:B", ids.join(","));

  log.length = 0;
  menu.pick("live:cam:A");
  await until(() => center(el) === RED);
  const cv = el.shadowRoot.querySelector("canvas");
  const last = asked.at(-1);
  add("live:从菜单加一台相机 → 画出来，卡上记着 target 和名字，发 itemschange",
    center(el) === RED && el.deck.current.target === "cam:A" && el.deck.current.name === "正面" && names(log).includes("itemschange"),
    `${center(el)} target=${el.deck.current?.target} name=${el.deck.current?.name} events=${names(log)}`);
  add("live:要帧时带上窗口的设备像素尺寸和 target",
    last.target === "cam:A" && last.want.width === cv.width && last.want.height === cv.height && cv.width > 0,
    `want=${last.want.width}x${last.want.height} canvas=${cv.width}x${cv.height} target=${last.target}`);

  // 2) 两台相机之间翻页：第一帧立刻是对的，不许先画一下上一台的画面。把间隔调到很长，毛病藏不住。
  el.liveMinIntervalMs = 5000;
  menu.pick("live:cam:B");
  await frame();
  add("live:翻到另一台相机 → 第一帧立刻是它自己的画面", center(el) === BLUE && el.deck.size === 2, `${center(el)} size=${el.deck.size}`);
  el.shadowRoot.querySelector('[data-page="-1"]').click();
  await frame();
  add("live:翻回来 → 也立刻是对的", center(el) === RED, center(el));
  menu.pick("live:cam:A");
  add("live:同一台相机再点一次 → 翻过去，不重复加卡", el.deck.size === 2 && el.deck.current.target === "cam:A", `size=${el.deck.size}`);

  // 3) 只报某一台变了：当前看的不是它就不理
  el.liveMinIntervalMs = 0;
  await wait(50);
  const n0 = asked.length;
  el.markLiveDirty("cam:B"); await frame(); await frame();
  add("live:报的是别的相机变了 → 不要帧", asked.length === n0, `asked ${n0}→${asked.length}`);
  frames["cam:A"] = solid("#00ff00");
  el.markLiveDirty("cam:A");
  await until(() => center(el) === GREEN, 1000);
  add("live:报的是当前这台变了 → 重新要帧", center(el) === GREEN && asked.length > n0, `${center(el)} asked ${n0}→${asked.length}`);
  el.remove();

  // 4) 间隔归宿主定
  const fast = mount();
  let color = "#ff0000", t = [];
  fast.liveProvider = () => { t.push(performance.now()); return solid(color); };
  fast.liveMinIntervalMs = 40;
  fast.showLive();
  await until(() => center(fast) === RED);
  await wait(200);
  color = "#0000ff"; const t0 = performance.now();
  fast.markLiveDirty();
  await until(() => center(fast) === BLUE, 1000);
  const took = performance.now() - t0;
  add("live:间隔调成 40 毫秒 → 新画面 200 毫秒内到（缺省 300 毫秒做不到）", center(fast) === BLUE && took < 200, `${Math.round(took)}ms`);
  fast.remove();

  // 5) 宿主按提示出了小尺寸的帧，并说明这张卡本来多大
  const small = mount();
  small.liveProvider = () => ({ source: solid("#ff0000", 16, 8), width: 320, height: 160 });
  small.showLive();
  await until(() => center(small) === RED);
  const cw = small.clientWidth, ch = small.clientHeight;
  const expect = Math.min(cw / 320, ch / 160) * 0.95;
  add("live:按卡「本来的大小」来适应窗口，不按这一帧的像素数", Math.abs(small.viewport.scale - expect) < 1e-6 && center(small) === RED,
    `scale=${small.viewport.scale.toFixed(4)} expect=${expect.toFixed(4)} window=${cw}x${ch}`);
  small.remove();
}

async function reorderAndJump() {
  const el = mount(), log = listen(el), menu = fakeMenu(el);
  el.labels = { kindNames: { image: "图片" } };
  for (const [n, c] of [["红", "#ff0000"], ["", "#00ff00"], ["蓝", "#0000ff"]]) el.deck.add({ kind: "image", name: n, bytes: await png(c) });
  await until(() => center(el) === BLUE);
  const order = () => el.deck.cards().map((c) => c.name || "·").join("");
  const ids = () => menu.items().map((i) => i.id);

  // 在看最后一张：只能往前挪
  add("reorder:在最后一张 → 菜单里只有「往前挪」", ids().includes("earlier") && !ids().includes("later"), ids().join(","));
  log.length = 0;
  const keep = menu.pick("earlier"); await frame();
  add("reorder:往前挪一位 → 顺序变、还在看这张、计数 2/3、菜单不关、发 itemschange",
    order() === "红蓝·" && center(el) === BLUE && count(el) === "2/3" && keep === "keep" && names(log) === "itemschange",
    `order=${order()} ${center(el)} ${count(el)} keep=${keep} events=${names(log)}`);
  add("reorder:挪到中间 → 两个方向都有", ids().includes("earlier") && ids().includes("later"), ids().join(","));
  menu.pick("earlier"); await frame();
  add("reorder:连点第二下 → 挪到最前，「往前挪」消失", order() === "蓝红·" && !ids().includes("earlier") && ids().includes("later"), `${order()} ${ids().join(",")}`);
  menu.pick("earlier"); await frame();
  add("reorder:已经在最前还点 → 什么都不变", order() === "蓝红·", order());

  // 跳转列表
  el.shadowRoot.querySelector("[data-jump]").click();
  const list = menu.opts.items();
  add("jump:点计数 → 一张卡一行，没名字的用种类名，当前那张打勾",
    list.map((i) => i.label).join("|") === "1  蓝|2  红|3  图片" && list[0].icon === "check" && !list[1].icon && !list[2].icon,
    list.map((i) => `${i.label}${i.icon ? "✓" : ""}`).join("|"));
  log.length = 0;
  menu.pick("jump:2"); await frame();
  add("jump:点第三行 → 跳过去，发 itemschange", center(el) === GREEN && count(el) === "3/3" && names(log) === "itemschange", `${center(el)} ${count(el)} events=${names(log)}`);

  // 一张卡时两样都不出现
  const one = mount(), m1 = fakeMenu(one);
  one.deck.add({ kind: "image", bytes: await png("#ff0000") });
  await until(() => center(one) === RED);
  add("reorder:只有一张卡 → 菜单里没有挪动项", !m1.items().some((i) => i.id === "earlier" || i.id === "later"), m1.items().map((i) => i.id).join(","));

  // 来历标记
  const blob = await png("#0000ff");
  one.addImage(await createImageBitmap(blob), blob, { name: "稻草人 3", origin: "genai" });
  add("origin:addImage 可以带名字和来历，落在卡上", one.deck.current.origin === "genai" && one.deck.current.name === "稻草人 3", JSON.stringify({ o: one.deck.current.origin, n: one.deck.current.name }));
  el.remove(); one.remove();
}

try {
  await customElements.whenDefined("wp-reference-window");
  await deckDriven();
  await sharedDeck();
  await liveViaDeck();
  await liveGeneral();
  await reorderAndJump();
} catch (e) {
  add("探针自己炸了", false, String(e?.stack ?? e));
}

// ---- 焦点探针用的两个钩子（由 run.mjs 用真实鼠标驱动；合成的 .click() 不会挪焦点，测不出来）----
window.__focusSetup = async () => {
  const el = mount(); window.__focusMenu = fakeMenu(el);
  el.deck.add({ kind: "image", name: "红", bytes: await png("#ff0000") });
  el.deck.add({ kind: "image", name: "绿", bytes: await png("#00ff00") });
  await until(() => center(el) === GREEN);
  el.classList.remove("away", "idle");
  const ed = document.getElementById("editor");
  ed.focus(); ed.setSelectionRange(2, 4);
  window.__focusEl = el;
  const rectOf = (sel) => { const r = el.shadowRoot.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  // 三角形把手：点靠角的那一侧（另一半被裁掉了，点中心会落空）
  const host = el.getBoundingClientRect();
  return {
    "移动把手": { x: host.left + 5, y: host.top + 5 },
    "缩放把手": { x: host.right - 5, y: host.bottom - 5 },
    "＋": rectOf(".plus"),
    "上一张": rectOf('[data-page="-1"]'),
    "下一张": rectOf('[data-page="1"]'),
    "计数": rectOf(".chip-count"),
    "卡片内容": { x: host.left + host.width / 2, y: host.top + host.height / 2 },
    "×": rectOf(".close"),
  };
};
window.__focusState = () => {
  const ed = document.getElementById("editor"), a = document.activeElement;
  const el = window.__focusEl, r = el.getBoundingClientRect();
  return {
    active: a === ed ? "editor" : (a?.tagName ?? "null").toLowerCase(), sel: `${ed.selectionStart}-${ed.selectionEnd}`,
    open: el.open, index: el.deck.index, opens: window.__focusMenu.opens, anchor: window.__focusMenu.opts?.anchor?.className ?? "",
  };
};
window.__focusReset = () => {
  const ed = document.getElementById("editor");
  window.__focusEl.open = true; window.__focusEl.classList.remove("away", "idle");
  window.__focusMenu.opts?.onClose?.(); window.__focusMenu.opts = null;
  ed.focus(); ed.setSelectionRange(2, 4);
};
window.__PROBE__ = results;
