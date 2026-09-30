// 数据契约测试：目录制（.<app>/references/manifest.json + 字节）。created 2026-09-29 by Claude Fable 5.1
import { describe, it, assert, eq } from "./runner.mjs";
import { readFileSync } from "node:fs";
import {
  createDeck, decodeDeck, decodeDeckFromJson, encodeDeck, migrateDeckManifest, deckDir, extForMime, mimeForName,
  DeckManifestTooNewError, DECK_MANIFEST_VERSION,
} from "../src/deck/index.ts";

const FIXTURE = readFileSync(new URL("./fixtures/weebpaint-format2-refpanels.json", import.meta.url), "utf-8").trim();
const DIR = ".weebpaint/references";
const text = async (b) => new TextDecoder().decode(await b.arrayBuffer());
const store = (entries) => { const m = new Map(Object.entries(entries)); return (name) => m.get(name) ?? null; };
const manifestOf = async (files) => JSON.parse(await text(files.get(`${DIR}/manifest.json`)));
const json = (o) => new Blob([JSON.stringify(o)], { type: "application/json" });

describe("契约 · 目录", () => {
  it("目录 = .<app>/references；app 名只准小写字母数字和连字符", () => {
    eq(deckDir("weebpaint"), ".weebpaint/references");
    eq(deckDir("webxiaoheiwu"), ".webxiaoheiwu/references");
    let threw = false; try { deckDir("Weeb Paint"); } catch { threw = true; }
    assert(threw, "大写和空格应当报错");
  });
  it("编出来的文件全在目录里：manifest.json 在最前，字节按位置起名", async () => {
    const deck = createDeck();
    deck.add({ kind: "image", bytes: new Blob(["A"], { type: "image/jpeg" }) });
    deck.add({ kind: "live" });
    deck.add({ kind: "image", bytes: new Blob(["C"], { type: "image/png" }) });
    const files = encodeDeck(deck.snapshot(), { app: "weebpaint" });
    eq([...files.keys()].join("|"), `${DIR}/manifest.json|${DIR}/r0.jpg|${DIR}/r2.png`, "画布小窗不落文件，序号跳过");
    const m = await manifestOf(files);
    eq(m.version, DECK_MANIFEST_VERSION); eq(m.index, 2);
    eq(JSON.stringify(Object.keys(m)), '["version","index","items"]', "版本戳写在最前");
  });
  it("目录里没有 manifest.json → 空牌组，不是错", async () => {
    const d = await decodeDeck({ app: "weebpaint", knownKinds: ["image"], getFile: () => null });
    eq(d.cards.length, 0); eq(d.index, 0); eq(d.carried.length, 0);
  });
  it("manifest.json 不是合法 JSON → 响亮报错，不当空牌组", async () => {
    let msg = "";
    try { await decodeDeck({ app: "weebpaint", knownKinds: ["image"], getFile: (n) => n.endsWith("manifest.json") ? new Blob(["{oops"]) : null }); }
    catch (e) { msg = e.message; }
    assert(msg.includes("not valid JSON"), msg);
  });
});

describe("契约 · 冻结样本（WeebPaint format 2 的 refPanels，没有 version）", () => {
  const files = store({
    [`${DIR}/manifest.json`]: new Blob([FIXTURE]),                                   // 宿主的布局迁移把 desk 里那段 JSON 搬到这里
    [`${DIR}/r0.jpg`]: new Blob(["JPEG0"]),                                          // 故意不带 type：容器里拿出来的字节常常没有
    [`${DIR}/r2.png`]: new Blob(["PNG2"], { type: "image/png" }),
  });
  it("读得了：三张卡、当前第三张、字节对上、mime 从扩展名认出来", async () => {
    const d = await decodeDeck({ app: "weebpaint", knownKinds: ["image", "live"], getFile: files });
    eq(d.cards.length, 3); eq(d.index, 2); eq(d.carried.length, 0);
    eq(d.cards.map((c) => c.kind).join(","), "image,live,image");
    eq(await text(d.cards[0].bytes), "JPEG0"); eq(d.cards[0].mime, "image/jpeg");
    eq(d.cards[1].bytes, null, "画布小窗零字节");
    eq(d.cards[2].mime, "image/png"); eq(d.cards[2].vp.scale, 6);
  });
  it("读进去再写出来：只多了最前面的 version 戳，其余逐字节相同", async () => {
    const deck = createDeck();
    deck.restore(await decodeDeck({ app: "weebpaint", knownKinds: ["image", "live"], getFile: files }));
    const out = encodeDeck(deck.snapshot(), { app: "weebpaint" });
    const written = await text(out.get(`${DIR}/manifest.json`));
    eq(written, `{"version":1,` + FIXTURE.slice(1));
    eq([...out.keys()].join("|"), `${DIR}/manifest.json|${DIR}/r0.jpg|${DIR}/r2.png`);
    eq(await text(out.get(`${DIR}/r0.jpg`)), "JPEG0");
  });
});

describe("契约 · 清单自己的版本", () => {
  it("缺 version 当 v1；比库新 → 拒读、报出两个版本号", () => {
    eq(migrateDeckManifest({ index: 0, items: [] }).version, DECK_MANIFEST_VERSION);
    let err = null;
    try { migrateDeckManifest({ version: DECK_MANIFEST_VERSION + 5, index: 0, items: [] }); } catch (e) { err = e; }
    assert(err instanceof DeckManifestTooNewError, String(err));
    eq(err.fileVersion, DECK_MANIFEST_VERSION + 5); eq(err.libVersion, DECK_MANIFEST_VERSION);
  });
  it("乱七八糟的清单一律读成空，不抛错", () => {
    for (const junk of [null, undefined, 42, "x", [], {}, { items: "no" }, { index: "a", items: [null, 3, {}, { kind: "" }] }]) {
      const m = migrateDeckManifest(junk);
      eq(m.items.length, 0); eq(m.index, 0);
    }
  });
});

describe("契约 · 新字段", () => {
  it("名字 / 来历 / 引用 / 播放位置都能往返；空值不写；键序固定", async () => {
    const deck = createDeck();
    deck.add({ kind: "audio", name: "雨声", bytes: new Blob(["OPUS"], { type: "audio/ogg" }), play: { t: 61.5, loop: true } });
    deck.add({ kind: "image", bytes: new Blob(["P"], { type: "image/png" }), origin: "genai" });
    deck.add({ kind: "live", target: "camera:正面" });
    const files = encodeDeck(deck.snapshot(), { app: "catsup" });
    const [a, b, c] = (await manifestOf(files.set(".weebpaint/references/manifest.json", files.get(".catsup/references/manifest.json")))).items;
    eq(JSON.stringify(Object.keys(a)), JSON.stringify(["kind", "src", "vp", "name", "play"]));
    eq(JSON.stringify(Object.keys(b)), JSON.stringify(["kind", "src", "vp", "origin"]));
    eq(JSON.stringify(Object.keys(c)), JSON.stringify(["kind", "vp", "target"]));
    eq(a.src, ".catsup/references/r0.ogg");
    const back = await decodeDeck({ app: "catsup", knownKinds: ["audio", "image", "live"], getFile: (n) => files.get(n) ?? null });
    eq(back.index, 2);
    eq(back.cards[0].name, "雨声"); eq(back.cards[0].play.t, 61.5); eq(back.cards[0].play.loop, true);
    eq(back.cards[1].origin, "genai"); eq(back.cards[1].name, "");
    eq(back.cards[2].target, "camera:正面");
  });
  it("扩展名说不清 mime 时才写 mime；不认识的图片用 .img（WeebPaint 既有）", async () => {
    const deck = createDeck();
    deck.add({ kind: "image", bytes: new Blob(["x"], { type: "image/avif" }) });
    deck.add({ kind: "blob", bytes: new Blob(["y"], { type: "application/x-thing" }) });
    const m = await manifestOf(encodeDeck(deck.snapshot(), { app: "weebpaint" }));
    eq(m.items[0].src, `${DIR}/r0.img`); eq(m.items[0].mime, "image/avif");
    eq(m.items[1].src, `${DIR}/r1.bin`); eq(m.items[1].mime, "application/x-thing");
  });
});

describe("契约 · 不认识的卡原样带着", () => {
  const manifest = { version: 1, index: 2, items: [
    { kind: "image", src: `${DIR}/r0.jpg`, vp: null },
    { kind: "hologram", src: `${DIR}/r1.holo`, depth: 3, nested: { a: [1, 2] } },
    { kind: "image", src: `${DIR}/r2.jpg`, vp: null },
  ] };
  const files = store({
    [`${DIR}/manifest.json`]: json(manifest),
    [`${DIR}/r0.jpg`]: new Blob(["A"]), [`${DIR}/r1.holo`]: new Blob(["HOLO"]), [`${DIR}/r2.jpg`]: new Blob(["C"]),
  });
  const opt = { app: "weebpaint", knownKinds: ["image"], getFile: files };

  it("不认识的不进 cards，进 carried；index 换算成 cards 里的位置", async () => {
    const d = await decodeDeck(opt);
    eq(d.cards.length, 2); eq(d.carried.length, 1);
    eq(d.index, 1, "清单第 3 条 = cards 里第 2 张");
    eq(d.carried[0].at, 1); eq(d.carried[0].item.kind, "hologram");
  });
  it("原样写回：条目的每个字段都在，字节没变，位置没变", async () => {
    const deck = createDeck(); deck.restore(await decodeDeck(opt));
    const out = encodeDeck(deck.snapshot(), { app: "weebpaint" });
    const m = await manifestOf(out);
    eq(m.items.length, 3); eq(m.index, 2);
    const h = m.items[1];
    eq(h.kind, "hologram"); eq(h.depth, 3); eq(JSON.stringify(h.nested), '{"a":[1,2]}'); eq(h.src, `${DIR}/r1.holo`);
    eq(await text(out.get(`${DIR}/r1.holo`)), "HOLO");
  });
  it("删掉前面的卡之后：不认识的卡还在，字节按新位置重新起名，不和别人撞名", async () => {
    const deck = createDeck(); const ids = deck.restore(await decodeDeck(opt));
    deck.remove(ids[0]);
    const out = encodeDeck(deck.snapshot(), { app: "weebpaint" });
    const m = await manifestOf(out);
    eq(m.items.map((i) => i.kind).join(","), "image,hologram");
    eq(m.items[0].src, `${DIR}/r0.jpg`); eq(await text(out.get(`${DIR}/r0.jpg`)), "C");
    eq(m.items[1].src, `${DIR}/r1.holo`); eq(await text(out.get(`${DIR}/r1.holo`)), "HOLO");
    eq(out.size, 3);
  });
  it("带着的卡字节没了 → 条目还在，但不再指向不存在的文件", async () => {
    const d = await decodeDeck({ app: "weebpaint", knownKinds: ["image"], getFile: (n) => n.endsWith("manifest.json") ? json({ index: 0, items: [{ kind: "hologram", src: "gone.holo", depth: 1 }] }) : null });
    eq(d.carried.length, 1); eq(d.carried[0].files.src, undefined);
    const deck = createDeck(); deck.restore(d);
    const m = await manifestOf(encodeDeck(deck.snapshot(), { app: "weebpaint" }));
    eq(m.items[0].kind, "hologram"); eq(m.items[0].depth, 1); eq(m.items[0].src, undefined);
  });
});

describe("契约 · 容错", () => {
  it("认识的卡缺字节 → 卡还在，bytes 为空（不静默丢卡）", async () => {
    const d = await decodeDeck({ app: "weebpaint", knownKinds: ["image"], getFile: (n) => n.endsWith("manifest.json") ? json({ index: 0, items: [{ kind: "image", src: "missing.jpg", name: "丢了的图" }] }) : null });
    eq(d.cards.length, 1); eq(d.cards[0].bytes, null); eq(d.cards[0].name, "丢了的图"); eq(d.cards[0].mime, "image/jpeg");
  });
  it("视图状态里有非数字 → 当作没有；index 越界自动钳", () => {
    const d = decodeDeckFromJson({ index: 7, items: [{ kind: "live", vp: { tx: 1, ty: "2", scale: 1, rot: 0 } }, { kind: "live" }] }, { knownKinds: ["live"], getFile: () => null });
    eq(d.cards[0].vp, null); eq(d.index, 1);
  });
  it("mime ⇄ 扩展名", () => {
    eq(extForMime("image/jpeg"), "jpg"); eq(extForMime("text/plain; charset=utf-8"), "txt");
    eq(extForMime("image/x-unknown"), "img"); eq(extForMime("application/x-unknown"), "bin"); eq(extForMime(""), "bin");
    eq(mimeForName("a/b/r3.PNG"), "image/png"); eq(mimeForName("noext"), ""); eq(mimeForName("x.holo"), "");
  });
});
