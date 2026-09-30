// 清单编解码测试。created 2026-09-29 by Claude Fable 5.1
import { describe, it, assert, eq } from "./runner.mjs";
import { readFileSync } from "node:fs";
import { createDeck, decodeDeck, encodeDeck, extForMime, mimeForName } from "../src/deck/index.ts";

const FIXTURE = readFileSync(new URL("./fixtures/weebpaint-format2-refpanels.json", import.meta.url), "utf-8").trim();
// WeebPaint 的起名规则（= 它 src/backend/ora.ts 的 refEntryName）
const wpName = (i, ext, role) => `.weebpaint/references/r${i}${role === "face" ? ".face" : ""}.${ext}`;
const text = async (b) => new TextDecoder().decode(await b.arrayBuffer());
function store(entries) { const m = new Map(Object.entries(entries)); return (name) => m.get(name) ?? null; }

describe("清单 · 冻结样本（WeebPaint format 2）", () => {
  const files = store({
    ".weebpaint/references/r0.jpg": new Blob(["JPEG0"]),                       // 故意不带 type：容器里拿出来的字节常常没有
    ".weebpaint/references/r2.png": new Blob(["PNG2"], { type: "image/png" }),
  });
  it("读得了：三张卡、当前第三张、字节对上、mime 从扩展名认出来", async () => {
    const d = decodeDeck(JSON.parse(FIXTURE), { knownKinds: ["image", "live"], getFile: files });
    eq(d.cards.length, 3); eq(d.index, 2); eq(d.carried.length, 0);
    eq(d.cards.map((c) => c.kind).join(","), "image,live,image");
    eq(await text(d.cards[0].bytes), "JPEG0"); eq(d.cards[0].mime, "image/jpeg");
    eq(d.cards[1].bytes, null, "画布小窗零字节");
    eq(d.cards[2].mime, "image/png");
    eq(d.cards[2].vp.scale, 6);
  });
  it("读进去再写出来，清单逐字节相同（键的顺序也一样，不多写任何字段）", () => {
    const deck = createDeck();
    deck.restore(decodeDeck(JSON.parse(FIXTURE), { knownKinds: ["image", "live"], getFile: files }));
    const out = encodeDeck(deck.snapshot(), { nameFile: wpName });
    eq(JSON.stringify(out.manifest), FIXTURE);
    eq([...out.files.keys()].join("|"), ".weebpaint/references/r0.jpg|.weebpaint/references/r2.png", "画布小窗不落文件");
  });
});

describe("清单 · 新字段", () => {
  it("名字 / 来历 / 引用 / 播放位置 / 小封面 都能往返；空值不写", async () => {
    const deck = createDeck();
    deck.add({ kind: "audio", name: "雨声", bytes: new Blob(["OPUS"], { type: "audio/ogg" }), play: { t: 61.5, loop: true }, face: new Blob(["F"], { type: "image/jpeg" }) });
    deck.add({ kind: "image", bytes: new Blob(["P"], { type: "image/png" }), origin: "genai" });
    deck.add({ kind: "live", target: "camera:正面" });
    const out = encodeDeck(deck.snapshot(), { nameFile: wpName, version: 1 });
    eq(out.manifest.version, 1);
    eq(Object.keys(out.manifest)[0], "version", "版本戳写在最前");
    const [a, b, c] = out.manifest.items;
    eq(JSON.stringify(Object.keys(a)), JSON.stringify(["kind", "src", "vp", "face", "name", "play"]));
    eq(JSON.stringify(Object.keys(b)), JSON.stringify(["kind", "src", "vp", "origin"]));
    eq(JSON.stringify(Object.keys(c)), JSON.stringify(["kind", "vp", "target"]));
    eq(a.face, ".weebpaint/references/r0.face.jpg");

    const back = decodeDeck(JSON.parse(JSON.stringify(out.manifest)), { knownKinds: ["audio", "image", "live"], getFile: (n) => out.files.get(n) ?? null });
    eq(back.index, 2);
    eq(back.cards[0].name, "雨声"); eq(back.cards[0].play.t, 61.5); eq(back.cards[0].play.loop, true);
    eq(await text(back.cards[0].face), "F");
    eq(back.cards[1].origin, "genai"); eq(back.cards[1].name, "");
    eq(back.cards[2].target, "camera:正面");
  });
  it("扩展名说不清 mime 时才写 mime", () => {
    const deck = createDeck();
    deck.add({ kind: "image", bytes: new Blob(["x"], { type: "image/avif" }) });
    const out = encodeDeck(deck.snapshot(), { nameFile: wpName });
    eq(out.manifest.items[0].src, ".weebpaint/references/r0.bin");
    eq(out.manifest.items[0].mime, "image/avif");
  });
});

describe("清单 · 不认识的卡原样带着", () => {
  const manifest = { index: 2, items: [
    { kind: "image", src: "r0.jpg", vp: null },
    { kind: "hologram", src: "r1.holo", face: "r1.face.jpg", depth: 3, nested: { a: [1, 2] } },
    { kind: "image", src: "r2.jpg", vp: null },
  ] };
  const files = store({
    "r0.jpg": new Blob(["A"]), "r1.holo": new Blob(["HOLO"]), "r1.face.jpg": new Blob(["HF"]), "r2.jpg": new Blob(["C"]),
  });
  const name = (i, ext, role) => `r${i}${role === "face" ? ".face" : ""}.${ext}`;

  it("不认识的不进 cards，进 carried；index 换算成 cards 里的位置", () => {
    const d = decodeDeck(manifest, { knownKinds: ["image"], getFile: files });
    eq(d.cards.length, 2); eq(d.carried.length, 1);
    eq(d.index, 1, "清单第 3 条 = cards 里第 2 张");
    eq(d.carried[0].at, 1); eq(d.carried[0].item.kind, "hologram");
  });
  it("原样写回：条目的每个字段都在，字节没变，位置没变", async () => {
    const deck = createDeck();
    deck.restore(decodeDeck(manifest, { knownKinds: ["image"], getFile: files }));
    const out = encodeDeck(deck.snapshot(), { nameFile: name });
    eq(out.manifest.items.length, 3); eq(out.manifest.index, 2);
    const h = out.manifest.items[1];
    eq(h.kind, "hologram"); eq(h.depth, 3); eq(JSON.stringify(h.nested), '{"a":[1,2]}');
    eq(h.src, "r1.holo"); eq(h.face, "r1.face.jpg");
    eq(await text(out.files.get("r1.holo")), "HOLO"); eq(await text(out.files.get("r1.face.jpg")), "HF");
  });
  it("删掉前面的卡之后：不认识的卡还在，字节按新位置重新起名，不和别人撞名", async () => {
    const deck = createDeck();
    const ids = deck.restore(decodeDeck(manifest, { knownKinds: ["image"], getFile: files }));
    deck.remove(ids[0]);
    const out = encodeDeck(deck.snapshot(), { nameFile: name });
    eq(out.manifest.items.map((i) => i.kind).join(","), "image,hologram");
    eq(out.manifest.items[0].src, "r0.jpg"); eq(await text(out.files.get("r0.jpg")), "C");
    eq(out.manifest.items[1].src, "r1.holo"); eq(await text(out.files.get("r1.holo")), "HOLO");
    eq(out.files.size, 3);
  });
  it("带着的卡缺字节也照样带着条目", () => {
    const d = decodeDeck({ index: 0, items: [{ kind: "hologram", src: "gone.holo" }] }, { knownKinds: ["image"], getFile: () => null });
    eq(d.carried.length, 1); eq(d.carried[0].files.src, undefined);
    const deck = createDeck(); deck.restore(d);
    const out = encodeDeck(deck.snapshot(), { nameFile: name });
    eq(out.manifest.items[0].src, "gone.holo", "字节没了，条目原文不动");
    eq(out.files.size, 0);
  });
});

describe("清单 · 容错", () => {
  const opt = { knownKinds: ["image", "live"], getFile: () => null };
  it("乱七八糟的输入一律读成空牌组，不抛错", () => {
    for (const junk of [null, undefined, 42, "x", [], {}, { items: "no" }, { index: "a", items: [null, 3, {}, { kind: "" }] }]) {
      const d = decodeDeck(junk, opt);
      eq(d.cards.length, 0); eq(d.index, 0); eq(d.carried.length, 0);
    }
  });
  it("认识的卡缺字节 → 卡还在，bytes 为空（不静默丢卡）", () => {
    const d = decodeDeck({ index: 0, items: [{ kind: "image", src: "missing.jpg", name: "丢了的图" }] }, opt);
    eq(d.cards.length, 1); eq(d.cards[0].bytes, null); eq(d.cards[0].name, "丢了的图"); eq(d.cards[0].mime, "image/jpeg");
  });
  it("视图状态里有非数字 → 当作没有", () => {
    const d = decodeDeck({ index: 0, items: [{ kind: "live", vp: { tx: 1, ty: "2", scale: 1, rot: 0 } }] }, opt);
    eq(d.cards[0].vp, null);
  });
  it("index 越界自动钳", () => {
    const d = decodeDeck({ index: 7, items: [{ kind: "live" }, { kind: "live" }] }, opt);
    eq(d.index, 1);
  });
  it("宿主的起名函数给出重名 → 响亮报错，不静默覆盖", () => {
    const deck = createDeck();
    deck.add({ kind: "image", bytes: new Blob(["a"], { type: "image/png" }) });
    deck.add({ kind: "image", bytes: new Blob(["b"], { type: "image/png" }) });
    let msg = "";
    try { encodeDeck(deck.snapshot(), { nameFile: () => "same.png" }); } catch (e) { msg = String(e.message); }
    assert(msg.includes("same.png"), `应当报重名，实得：${msg}`);
  });
});

describe("清单 · 扩展名表", () => {
  it("mime ⇄ 扩展名", () => {
    eq(extForMime("image/jpeg"), "jpg"); eq(extForMime("text/plain; charset=utf-8"), "txt");
    eq(extForMime("application/x-unknown"), "bin"); eq(extForMime(""), "bin");
    eq(mimeForName("a/b/r3.PNG"), "image/png"); eq(mimeForName("noext"), ""); eq(mimeForName("x.holo"), "");
  });
});
