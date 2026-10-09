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

const textEl = (el) => el.shadowRoot.querySelector(".text");
const textShown = (el) => textEl(el).classList.contains("shown");

async function textCards() {
  const el = mount(), log = listen(el), menu = fakeMenu(el);
  el.labels = { kindNames: { text: "文字" }, linkMissing: "内容不可用" };
  const body = "第一行是标题\n" + Array.from({ length: 80 }, (_, i) => `第 ${i + 2} 行：东北西南规则，G_μν = 8πT_μν`).join("\n");
  el.addText(body, { name: "" });
  await frame();
  add("text:加文字卡 → 文字层显示、画布藏起来、内容对", textShown(el) && textEl(el).textContent === body && el.shadowRoot.querySelector("canvas").style.visibility === "hidden", `shown=${textShown(el)}`);
  add("text:文字层可选中（放行焦点）", getComputedStyle(textEl(el)).userSelect === "text" && textEl(el).hasAttribute("data-takes-focus"), getComputedStyle(textEl(el)).userSelect);
  add("text:字号倍率 = vp.scale，初始 1", el.viewport.scale === 1 && getComputedStyle(textEl(el)).getPropertyValue("--ref-text-scale").trim() === "1", JSON.stringify(el.viewport));

  // 滚动位置进牌组
  textEl(el).scrollTop = 120; await frame(); await frame();
  add("text:滚动 → vp.ty 记进牌组，发 viewportchange", el.deck.current.vp?.ty === 120 && names(log).includes("viewportchange"), `ty=${el.deck.current.vp?.ty} events=${names(log)}`);

  // ctrl+滚轮 = 字号
  textEl(el).dispatchEvent(new WheelEvent("wheel", { deltaY: -200, ctrlKey: true, bubbles: true, cancelable: true }));
  await frame();
  const sc = el.viewport.scale;
  add("text:ctrl+滚轮 → 字号变大、写进 CSS 变量和牌组", sc > 1 && getComputedStyle(textEl(el)).getPropertyValue("--ref-text-scale").trim() === String(sc) && el.deck.current.vp.scale === sc, `scale=${sc}`);

  // 跳转列表：没名字的文字卡用首行
  el.addText("次要备忘\n无关", { name: "" }); await frame();
  el.shadowRoot.querySelector("[data-jump]").click();
  const labels = menu.opts.items().map((i) => i.label);
  add("text:跳转列表用首行当名字", labels.join("|") === "1  第一行是标题|2  次要备忘", labels.join("|"));
  menu.opts.onClose?.();

  // 翻回第一张：滚动位置和字号原样回来（调字号后浏览器的滚动锚定会微调 scrollTop，组件如实记下的那个值才是基准）
  const savedTy = el.deck.cards()[0].vp.ty;
  el.shadowRoot.querySelector('[data-page="-1"]').click(); await frame(); await frame();
  add("text:翻回来 → 字号和滚动位置原样", Math.abs(textEl(el).scrollTop - savedTy) < 1 && savedTy >= 120 && el.viewport.scale === sc, `scrollTop=${textEl(el).scrollTop} saved=${savedTy} scale=${el.viewport.scale}`);

  // 翻到图片卡：文字层藏、画布回来
  el.deck.add({ kind: "image", bytes: await png("#ff0000") });
  await until(() => center(el) === RED);
  add("text:翻到图片卡 → 文字层藏起来、画布回来", !textShown(el) && center(el) === RED, `shown=${textShown(el)} ${center(el)}`);

  // 编码：文字卡落 .txt
  const { encodeDeck } = await import("/dist/deck/index.js");
  const files = encodeDeck(el.deck.snapshot(), { app: "probe" });
  add("text:编码成 .txt 字节", [...files.keys()].some((k) => k.endsWith("r0.txt")), [...files.keys()].join("|"));
  el.remove();
}

async function linkedCards() {
  const el = mount(), log = listen(el);
  el.labels = { linkMissing: "内容不可用" };
  const pages = { "page:1": "设定：主角是一只猫\n第二行", "page:2": null };
  const asked = [];
  el.linkProvider = async (target, kind) => {
    asked.push(`${kind}@${target}`);
    if (target === "page:img") return await png("#0000ff");
    if (target === "page:boom") throw new Error("boom");
    const t = pages[target]; return t == null ? null : new Blob([t], { type: "text/plain" });
  };
  const idT = el.deck.add({ kind: "text", target: "page:1", name: "设定页" });
  await until(() => textShown(el) && textEl(el).textContent.startsWith("设定"));
  add("link:文字链接卡 → 向宿主要内容并显示；卡里没有字节", textEl(el).textContent === pages["page:1"] && el.deck.current.bytes === null && asked.includes("text@page:1"), `asked=${asked.join(",")}`);

  // 页改了 → invalidate → 重取
  pages["page:1"] = "设定：主角是一只狗";
  el.deck.invalidate(idT);
  await until(() => textEl(el).textContent === "设定：主角是一只狗");
  add("link:宿主 invalidate → 重新要、内容更新", textEl(el).textContent === "设定：主角是一只狗" && asked.filter((a) => a === "text@page:1").length === 2, `asked=${asked.join(",")}`);

  // 页删了 → 如实占位
  const idM = el.deck.add({ kind: "text", target: "page:2", name: "被删的页" });
  await until(() => textEl(el).classList.contains("missing"));
  add("link:宿主给不出来 → 卡上如实写「内容不可用」", textEl(el).textContent === "内容不可用" && textEl(el).classList.contains("missing"), textEl(el).textContent);

  // 图片链接卡
  const idI = el.deck.add({ kind: "image", target: "page:img" });
  await until(() => center(el) === BLUE);
  add("link:图片链接卡 → 库解出来画上，文字层藏", center(el) === BLUE && !textShown(el), center(el));

  // 宿主端口抛错 → notice，不吞
  let notice = null; el.addEventListener("notice", (e) => { notice = e.detail; }, { once: true });
  el.deck.add({ kind: "text", target: "page:boom" });
  await until(() => notice);
  add("link:宿主端口抛错 → 发 notice(link-failed)", notice?.code === "link-failed" && notice?.target === "page:boom", JSON.stringify(notice));

  // 编码：链接卡只有 target，没有 src
  const { encodeDeck } = await import("/dist/deck/index.js");
  const files = encodeDeck(el.deck.snapshot(), { app: "probe" });
  const m = JSON.parse(await files.get(".probe/references/manifest.json").text());
  add("link:编码后链接卡只有 target 没有字节文件（立绘只存一次）",
    m.items.every((i) => i.target && !i.src) && files.size === 1,
    `${JSON.stringify(m.items.map((i) => ({ k: i.kind, t: i.target, s: i.src })))} files=${files.size}`);
  void idM; void idI; void log;
  el.remove();
}

// 底边地板（0.3.2）：屏底被占掉一块（宿主的软键盘）时，窗整个钳回可见区；地板撤了不乱动
async function bottomFloor() {
  const el = mount(); const log = listen(el); const vh = window.innerHeight;
  el.rect = { left: 40, top: vh - 220, width: 240, height: 200 };
  await wait(30); log.length = 0;
  const before = el.getBoundingClientRect();
  el.bottomFloor = 300; el.reclamp(); await wait(30);
  const r = el.getBoundingClientRect();
  add("底边地板 300 + reclamp()：窗底不低于「视口高 − 300」，发了 rectchange", r.bottom <= vh - 300 + 0.5 && r.bottom < before.bottom && log.some((e) => e.n === "rectchange"), `bottom ${before.bottom}→${r.bottom} vh=${vh} events=${log.map((e) => e.n).join()}`);
  add("钳回来之后右下角的缩放把手在地板之上", r.bottom - 5 < vh - 300 && r.height >= 60, `h=${r.height}`);
  log.length = 0; el.reclamp(); await wait(30);
  add("位置已经合规时 reclamp() 不动、不发事件", el.getBoundingClientRect().top === r.top && !log.some((e) => e.n === "rectchange"), log.map((e) => e.n).join());
  el.bottomFloor = 0; el.reclamp(); await wait(30);
  add("地板撤掉：窗留在原地（不自己跳回去）", Math.abs(el.getBoundingClientRect().top - r.top) < 0.5, `${el.getBoundingClientRect().top} vs ${r.top}`);
  // 地板比窗还高：窗缩到装得下
  el.rect = { left: 40, top: 100, width: 240, height: 400 }; el.bottomFloor = vh - 260; el.reclamp(); await wait(30);
  const q = el.getBoundingClientRect();
  add("地板很高时：窗的高度也跟着收，仍在顶栏地板之下、底边地板之上", q.top >= el.topFloor - 0.5 && q.bottom <= vh - el.bottomFloor + 0.5, `top=${q.top} bottom=${q.bottom} floor=${el.topFloor}/${el.bottomFloor}`);
  el.remove();
}

try {
  await customElements.whenDefined("wp-reference-window");
  await deckDriven();
  await sharedDeck();
  await liveViaDeck();
  await liveGeneral();
  await reorderAndJump();
  await textCards();
  await linkedCards();
  await bottomFloor();
  await audioCards();
} catch (e) {
  add("探针自己炸了", false, String(e?.stack ?? e));
}

// ---- 0.4.0 音频卡 + 只放内存（2026-10-09，Claude Opus 5.5）----
function wav(sec = 2, rate = 8000) {   // 正弦 440 Hz 单声道 PCM16（浏览器都解得开）
  const n = Math.round(sec * rate), b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin((i / rate) * 2 * Math.PI * 440) * 8000), true);
  return new Blob([b], { type: "audio/wav" });
}
function audioLayer(el) { return el.shadowRoot.querySelector(".audio"); }
async function audioCards() {
  const el = mount(), menu = fakeMenu(el);
  el.labels = { kindNames: { audio: "音频" }, ram: "只放内存", ramMissing: "只在内存里——拖进来 / 点＋重新导入" };
  const id = el.deck.add({ kind: "audio", name: "bgm.wav", bytes: wav(), mime: "audio/wav" });
  await frame();
  add("audio:音频卡 → 播放层显示、画布藏起来、写着名字", audioLayer(el).classList.contains("shown") && el.shadowRoot.querySelector("canvas").style.visibility === "hidden" && el.shadowRoot.querySelector(".aname").textContent === "bgm.wav", el.shadowRoot.querySelector(".aname").textContent);
  add("audio:不自动放", !el.playing);
  let items = menu.items().map((i) => i.id);
  add("audio:＋ 菜单有循环、没有 1:1；没给 audioRates = 没有速度项", items.includes("loop") && !items.includes("onetoone") && !items.some((x) => x.startsWith("rate:")), items.join(","));
  menu.opts.onClose?.();
  el.audioRates = [1, 0.75, 0.5];
  items = menu.items().map((i) => i.id);
  add("audio:给了 audioRates = 列出速度项", ["rate:1", "rate:0.75", "rate:0.5"].every((x) => items.includes(x)), items.join(","));
  add("audio:循环 / 速度点了菜单不关（keep）", menu.pick("loop") === "keep" && menu.pick("rate:0.5") === "keep");
  menu.opts.onClose?.();
  add("audio:循环记进卡（play.loop）", el.deck.get(id).play?.loop === true, JSON.stringify(el.deck.get(id).play));
  el.togglePlay();
  await until(() => el.playing, 2000);
  add("audio:播放 → playing、钮换成暂停、速度 0.5 保音高", el.playing && el.shadowRoot.querySelector(".aplay").dataset.icon === "pause" && el.shadowRoot.querySelector(".atime").textContent.includes("0.5×"), el.shadowRoot.querySelector(".atime").textContent);
  await wait(400);
  el.togglePlay(); await frame();
  add("audio:暂停 → 放到哪记进卡（视图态）", !el.playing && el.deck.get(id).play.t > 0, JSON.stringify(el.deck.get(id).play));
  // 空格（窗有焦点时）
  el.focus(); el.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, composed: true, cancelable: true }));
  await until(() => el.playing, 2000);
  add("audio:窗有焦点按空格 = 播放 / 暂停", el.playing);
  // 关窗不停（user「关窗的时候音乐不停」），翻到别的卡也不停（user 2026-10-09「不停」）
  el.open = false; await frame();
  add("audio:关窗不停", el.playing); el.open = true;
  el.deck.add({ kind: "image", name: "红", bytes: await png("#ff0000") });
  await until(() => center(el) === RED);
  add("audio:翻到别的卡不停、播放层藏起来", el.playing && !audioLayer(el).classList.contains("shown"), `playing=${el.playing}`);
  el.deck.remove(id); await frame();
  add("audio:正在放的那张被删了 = 停", !el.playing);

  // ---- 只放内存 ----
  const log = []; el.deck.onChange((c) => log.push(c.type));
  const a2 = el.deck.add({ kind: "audio", name: "big.wav", bytes: wav(1), mime: "audio/wav" });
  const img = el.deck.add({ kind: "image", name: "截图.png", bytes: await png("#00ff00") });
  el.deck.select(el.deck.indexOf(a2)); await frame(); log.length = 0;
  items = menu.items();
  add("ram:有字节的卡菜单里有「只放内存」（没勾）", items.some((i) => i.id === "ram" && i.label === "只放内存" && !i.icon), items.map((i) => i.id).join(","));
  menu.pick("ram"); menu.opts.onClose?.();
  add("ram:点了 = 卡标 ram、发 cards（宿主标脏）", el.deck.get(a2).ram?.bytes === el.deck.get(a2).bytes.size && log.includes("cards"), `${JSON.stringify(el.deck.get(a2).ram)} ${log}`);
  el.deck.setRam(img, true);
  const { encodeDeck, decodeDeck } = await import("/dist/deck/index.js");
  const files = encodeDeck(el.deck.snapshot(), { app: "probe" });
  const back = await decodeDeck({ app: "probe", knownKinds: ["image", "audio", "text"], getFile: (p) => files.get(p) ?? null });
  const el2 = mount(), menu2 = fakeMenu(el2); el2.labels = { ramMissing: "只在内存里——拖进来 / 点＋重新导入" };
  el2.deck.restore(back);
  el2.deck.select(el2.deck.cards().findIndex((c) => c.name === "big.wav")); await frame();
  const nm = el2.shadowRoot.querySelector(".aname").textContent;
  add("ram:读回来 = 空位：写着名字 · 大小 + 怎么补，播放钮按不动", nm.startsWith("big.wav · ") && nm.includes("重新导入") && el2.shadowRoot.querySelector(".aplay").disabled, nm);
  add("ram:空位的菜单里没有「只放内存」", !menu2.items().some((i) => i.id === "ram")); menu2.opts.onClose?.();
  el2.deck.select(el2.deck.cards().findIndex((c) => c.name === "截图.png")); await frame();
  add("ram:图片的空位 = 文字层写一句话", textShown(el2) && textEl(el2).textContent.includes("截图.png") && textEl(el2).textContent.includes("重新导入"), textEl(el2).textContent);
  const f = new File([await png("#00ff00")], "截图.png", { type: "image/png" });
  const n0 = el2.deck.size, r = await el2.importFiles([f]);
  await until(() => center(el2) === GREEN);
  add("ram:同名拖回来 = 补回原位（不新加）、画出来", r.filled.length === 1 && r.added.length === 0 && el2.deck.size === n0 && center(el2) === GREEN && !textShown(el2), `filled=${r.filled.length} added=${r.added.length} size=${n0}→${el2.deck.size} ${center(el2)}`);

  // ---- 导入漏斗：问宿主（宿主自己的面板）----
  let q = null;
  const r2 = await el2.importFiles([new File([wav(1)], "a.wav", { type: "audio/wav" })], { ask: async (x) => { q = x; return "keep"; }, askAbove: { audio: 100 }, ramAbove: 10 });
  add("import:超过门槛 = 问；问的东西里有名字、种类、大小、建议只放内存", q?.name === "a.wav" && q.kind === "audio" && q.bytes > 100 && q.suggestRam === true && q.canCompress === false && r2.added.length === 1, JSON.stringify(q));
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
    // 「卡片内容」0.3.1 起不在此列：点窗身 = 窗拿焦点（粘贴归焦点，user「看 focus」）；见 run.mjs 的 hasFocus 探针
    "×": rectOf(".close"),
  };
};
window.__focusAudio = () => {
  const el = window.__focusEl;
  el.deck.add({ kind: "audio", name: "bgm.wav", bytes: wav(), mime: "audio/wav" });
  return new Promise((r) => requestAnimationFrame(() => { const b = el.shadowRoot.querySelector(".aplay").getBoundingClientRect(); r({ x: b.left + b.width / 2, y: b.top + b.height / 2 }); }));
};
window.__focusState = () => {
  const ed = document.getElementById("editor"), a = document.activeElement;
  const el = window.__focusEl, r = el.getBoundingClientRect();
  return {
    active: a === ed ? "editor" : (a?.tagName ?? "null").toLowerCase(), sel: `${ed.selectionStart}-${ed.selectionEnd}`,
    open: el.open, index: el.deck.index, playing: el.playing, opens: window.__focusMenu.opens, anchor: window.__focusMenu.opts?.anchor?.className ?? "",
  };
};
window.__focusReset = () => {
  const ed = document.getElementById("editor");
  window.__focusEl.open = true; window.__focusEl.classList.remove("away", "idle");
  window.__focusMenu.opts?.onClose?.(); window.__focusMenu.opts = null;
  ed.focus(); ed.setSelectionRange(2, 4);
};
window.__PROBE__ = results;
