// 牌组模型测试。created 2026-09-29 by Claude Fable 5.1
import { describe, it, assert, eq } from "./runner.mjs";
import { createDeck } from "../src/deck/index.ts";

const img = (name) => ({ kind: "image", name, bytes: new Blob([name], { type: "image/png" }) });
function watch(deck) { const log = []; deck.onChange((c) => log.push(c.type)); return log; }
const names = (deck) => deck.cards().map((c) => c.name).join(",");

describe("牌组 · 增删", () => {
  it("加卡默认翻到新卡，并通知 cards", () => {
    const d = createDeck(), log = watch(d);
    d.add(img("a")); d.add(img("b"));
    eq(d.size, 2); eq(d.index, 1); eq(d.current.name, "b");
    eq(log.join(","), "cards,cards");
  });
  it("select:false 时加卡不翻页（一次发多张用）", () => {
    const d = createDeck();
    d.add(img("a"));
    d.add(img("b"), { select: false }); d.add(img("c"), { select: false });
    eq(d.index, 0); eq(d.size, 3);
  });
  it("mime 缺省取字节自己的类型", () => {
    const d = createDeck();
    const id = d.add({ kind: "image", bytes: new Blob(["x"], { type: "image/jpeg" }) });
    eq(d.get(id).mime, "image/jpeg");
  });
  it("没有 kind 的卡直接报错", () => {
    const d = createDeck();
    let threw = false;
    try { d.add({ name: "x" }); } catch { threw = true; }
    assert(threw, "应当报错");
    eq(d.size, 0);
  });
  it("删当前看的那张 → 停在原位看下一张；删的是最后一张 → 退一格", () => {
    const d = createDeck();
    const [a, b, c] = ["a", "b", "c"].map((n) => d.add(img(n)));
    d.select(1); d.remove(b);
    eq(d.current.name, "c", "删中间，看下一张");
    d.remove(c);
    eq(d.current.name, "a", "删末尾，退一格");
    d.remove(a);
    eq(d.size, 0); eq(d.current, null); eq(d.index, 0);
  });
  it("删当前之前的卡 → 还在看原来那张", () => {
    const d = createDeck();
    const [a] = ["a", "b", "c"].map((n) => d.add(img(n)));
    d.select(2); d.remove(a);
    eq(d.current.name, "c"); eq(d.index, 1);
  });
  it("删不存在的 id 什么都不发生、不通知", () => {
    const d = createDeck(); d.add(img("a"));
    const log = watch(d);
    d.remove("nope");
    eq(d.size, 1); eq(log.length, 0);
  });
});

describe("牌组 · 挪动与翻页", () => {
  it("往前挪 / 往后挪：顺序变，当前看的那张卡不变", () => {
    const d = createDeck();
    const ids = ["a", "b", "c", "d"].map((n) => d.add(img(n)));
    d.select(1);                       // 在看 b
    d.move(ids[3], 0);                 // d 挪到最前
    eq(names(d), "d,a,b,c"); eq(d.current.name, "b");
    d.move(ids[1], 3);                 // 把正在看的 b 挪到最后
    eq(names(d), "d,a,c,b"); eq(d.current.name, "b"); eq(d.index, 3);
  });
  it("挪动目标越界自动钳；挪到原位不通知", () => {
    const d = createDeck();
    const ids = ["a", "b", "c"].map((n) => d.add(img(n)));
    const log = watch(d);
    d.move(ids[0], 99); eq(names(d), "b,c,a");
    d.move(ids[0], -5); eq(names(d), "a,b,c");
    d.move(ids[1], 1);
    eq(log.join(","), "cards,cards");
  });
  it("翻页通知 view；翻到当前页不通知；越界自动钳", () => {
    const d = createDeck();
    ["a", "b", "c"].forEach((n) => d.add(img(n)));
    const log = watch(d);
    d.select(0); d.select(0); d.select(99);
    eq(d.index, 2); eq(log.join(","), "view,view");
  });
});

describe("牌组 · 视图状态", () => {
  it("setView 存的是拷贝；值没变不通知；非有限数不收", () => {
    const d = createDeck();
    const id = d.add(img("a"));
    const log = watch(d);
    const vp = { tx: 1, ty: 2, scale: 3, rot: 0.5 };
    d.setView(id, vp);
    vp.tx = 999;
    eq(d.get(id).vp.tx, 1, "外面改原对象不影响牌组");
    d.setView(id, { tx: 1, ty: 2, scale: 3, rot: 0.5 });
    d.setView(id, { tx: NaN, ty: 0, scale: 1, rot: 0 });
    eq(d.get(id).vp.tx, 1);
    eq(log.join(","), "view");
  });
  it("setPlay 记播放位置", () => {
    const d = createDeck();
    const id = d.add({ kind: "audio" });
    d.setPlay(id, { t: 12.5, loop: true });
    eq(d.get(id).play.t, 12.5); eq(d.get(id).play.loop, true);
  });
  it("setTarget 改指向 → 通知 cards + invalidate；同值不通知", () => {
    const d = createDeck();
    const id = d.add({ kind: "text", target: "page:a" });
    const log = watch(d);
    d.setTarget(id, "page:b"); d.setTarget(id, "page:b");
    eq(d.get(id).target, "page:b"); eq(log.join(","), "cards,invalidate");
  });
  it("invalidate 只对存在的卡通知", () => {
    const d = createDeck();
    const id = d.add({ kind: "live" });
    const seen = [];
    d.onChange((c) => { if (c.type === "invalidate") seen.push(c.id); });
    d.invalidate(id); d.invalidate("nope");
    eq(seen.join(","), id);
  });
});

describe("牌组 · 载入恢复与快照", () => {
  it("restore 只发 reset（不是用户改动）；返回的 id 顺序 = 卡的顺序", () => {
    const d = createDeck(), log = watch(d);
    const ids = d.restore({ index: 1, cards: [img("a"), img("b"), img("c")] });
    eq(log.join(","), "reset");
    eq(ids.length, 3); eq(d.get(ids[1]).name, "b"); eq(d.current.name, "b");
  });
  it("restore 的 index 越界自动钳", () => {
    const d = createDeck();
    d.restore({ index: 9, cards: [img("a"), img("b")] });
    eq(d.index, 1);
    d.restore({ index: -3, cards: [img("a")] });
    eq(d.index, 0);
  });
  it("每次 restore / add 发的 id 都不重复", () => {
    const d = createDeck();
    const a = d.restore({ cards: [img("a"), img("b")] });
    const b = d.restore({ cards: [img("a"), img("b")] });
    const c = d.add(img("c"));
    eq(new Set([...a, ...b, c]).size, 5);
  });
  it("快照是拷贝：改快照不影响牌组", () => {
    const d = createDeck();
    const id = d.add(img("a")); d.setView(id, { tx: 1, ty: 1, scale: 1, rot: 0 });
    const s = d.snapshot();
    s.cards[0].name = "改了"; s.cards[0].vp.tx = 999; s.cards.pop();
    eq(d.size, 1); eq(d.get(id).name, "a"); eq(d.get(id).vp.tx, 1);
  });
  it("带着的卡跟着 restore 进、跟着 snapshot 出、clear 清掉", () => {
    const d = createDeck();
    const carried = [{ at: 1, item: { kind: "hologram", depth: 3 }, files: { src: new Blob(["h"]) } }];   // 只有 src 一种引用
    d.restore({ cards: [img("a")], carried });
    carried[0].item.depth = 999;
    eq(d.snapshot().carried[0].item.depth, 3, "存的是拷贝");
    eq(d.size, 1, "带着的卡不算在可显示的卡里");
    d.clear();
    eq(d.snapshot().carried.length, 0);
  });
});

describe("牌组 · 监听者", () => {
  it("取消监听后不再收到", () => {
    const d = createDeck(); const log = [];
    const off = d.onChange((c) => log.push(c.type));
    d.add(img("a")); off(); d.add(img("b"));
    eq(log.length, 1);
  });
  it("一个监听者抛错不拖垮别的监听者，错误也不被吞", () => {
    const d = createDeck(); const log = [];
    d.onChange(() => { throw new Error("boom"); });
    d.onChange((c) => log.push(c.type));
    let caught = null;
    try { d.add(img("a")); } catch (e) { caught = e; }
    eq(log.join(","), "cards", "第二个监听者照样收到");
    eq(caught?.message, "boom", "错误重新抛出");
    eq(d.size, 1, "卡已经加进去了");
  });
});
