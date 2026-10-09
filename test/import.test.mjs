// 导入漏斗（0.4.0，src/deck/import.ts）。created 2026-10-09 by Claude Opus 5.5
// user「库升minor + mp3功能，最好加一个压制转录的injection抽象接口」「mp3其实默认不压，导入的时候有一个对话框告诉你大小，然后问你要不要压。图片也一样」
//   「api的应该是图片音频视频转码都是app提供」「3. 音频也超过1MB才问？」「应用内小面板 如果支持压缩的话应该有压缩选项和估计」。
import { describe, it, eq, assert } from "./runner.mjs";
import { createDeck, importIntoDeck, sniffKind, extForMime } from "../src/deck/index.ts";

const file = (name, type, bytes) => { const f = new Blob([new Uint8Array(bytes)], { type }); f.name = name; return f; };
const KINDS = ["image", "text", "audio"];

describe("导入漏斗", () => {
  it("嗅种类：看 mime，再看扩展名", () => {
    eq(sniffKind(file("a.mp3", "audio/mpeg", 1)), "audio"); eq(sniffKind(file("a.wav", "", 1)), "audio");
    eq(sniffKind(file("a.png", "image/png", 1)), "image"); eq(sniffKind(file("n.md", "", 1)), "text");
    eq(sniffKind(file("v.mov", "video/quicktime", 1)), "video"); eq(sniffKind(file("x.zip", "application/zip", 1)), null);
  });
  it("门槛以下 = 不问、原样进牌组；没注入 ask = 一律原样", async () => {
    const d = createDeck(); let asked = 0;
    const r = await importIntoDeck(d, [file("s.mp3", "audio/mpeg", 100)], { kinds: KINDS, ask: async () => { asked++; return "keep"; }, askAbove: { audio: 1000 } });
    eq(asked, 0); eq(r.added.length, 1); eq(d.cards()[0].kind, "audio"); eq(d.cards()[0].mime, "audio/mpeg");
    const r2 = await importIntoDeck(d, [file("big.mp3", "audio/mpeg", 5000)], { kinds: KINDS, askAbove: { audio: 1000 } });
    eq(r2.added.length, 1, "没 ask = 原样");
  });
  it("超过门槛 = 问宿主：带上大小、能不能压、估计；选「压」= 宿主的转码出的字节进牌组", async () => {
    const d = createDeck(); let q = null;
    const transcoder = { kinds: ["audio"], estimate: async () => 1234, encode: async () => ({ blob: new Blob(["mp3"], { type: "audio/mpeg" }), mime: "audio/mpeg", note: "mp3 128k" }) };
    const r = await importIntoDeck(d, [file("song.wav", "audio/wav", 5000)], { kinds: KINDS, transcoder, ask: async (x) => { q = x; return "compress"; }, askAbove: { audio: 1000 } });
    eq(JSON.stringify(q), JSON.stringify({ name: "song.wav", kind: "audio", bytes: 5000, estimate: 1234, canCompress: true, suggestRam: false }));
    eq(d.cards()[0].mime, "audio/mpeg"); eq(d.cards()[0].bytes.size, 3); eq(r.notes.join(), "song.wav: mp3 128k");
  });
  it("转码不认这种 = canCompress false、没有估计；「算了」= 不进、报 cancelled；不认识的种类 = unsupported；转码出错 = failed（不抛）", async () => {
    const d = createDeck(); let q = null;
    const transcoder = { kinds: ["audio"], encode: async () => { throw new Error("boom"); } };
    const r = await importIntoDeck(d, [file("big.png", "image/png", 5000)], { kinds: KINDS, transcoder, ask: async (x) => { q = x; return "cancel"; }, askAbove: { image: 1000 } });
    eq(q.canCompress, false); eq(q.estimate, null); eq(r.skipped[0].why, "cancelled"); eq(d.size, 0);
    const r2 = await importIntoDeck(d, [file("v.mp4", "video/mp4", 10), file("x.zip", "application/zip", 10)], { kinds: KINDS });
    eq(r2.skipped.map((s) => s.why).join(), "unsupported,unsupported");
    const r3 = await importIntoDeck(d, [file("song.wav", "audio/wav", 5000)], { kinds: KINDS, transcoder, ask: async () => "compress", askAbove: { audio: 1000 } });
    eq(r3.skipped[0].why, "failed"); assert(/boom/.test(r3.skipped[0].message), "说为什么");
  });
  it("文字没 mime = 按扩展名补；MIME 表补了 wav / flac / aac / mov 和常见别名", async () => {
    const d = createDeck(); await importIntoDeck(d, [file("notes.md", "", 3)], { kinds: KINDS });
    eq(d.cards()[0].mime, "text/markdown");
    eq([extForMime("audio/wav"), extForMime("audio/x-wav"), extForMime("audio/mp3"), extForMime("audio/x-m4a"), extForMime("audio/flac"), extForMime("video/quicktime")].join(), "wav,wav,mp3,m4a,flac,mov");
  });
});

describe("只放内存（RAM only；user「然后能不能加RAM only，就是不落盘，每次重新上传」→ 选 B：存一个空位）", () => {
  it("选「只放内存」= 卡上有字节、标着 ram；超过 ramAbove = 问的时候建议它", async () => {
    const { createDeck } = await import("../src/deck/index.ts");
    const d = createDeck(); let q = null;
    await importIntoDeck(d, [file("bgm.mp3", "audio/mpeg", 9000)], { kinds: KINDS, ask: async (x) => { q = x; return "ram"; }, askAbove: { audio: 1000 }, ramAbove: 4000 });
    eq(q.suggestRam, true); eq(d.cards()[0].ram.bytes, 9000); eq(d.cards()[0].bytes.size, 9000);
  });
  it("存档：字节不进文件、清单记着 ram；读回来 = 空位（没字节）；同名同种类拖回来 = 补回原位（不新加、不问）", async () => {
    const { createDeck, encodeDeck, decodeDeck } = await import("../src/deck/index.ts");
    const d = createDeck();
    d.add({ kind: "audio", name: "bgm.mp3", bytes: new Blob([new Uint8Array(9000)], { type: "audio/mpeg" }), mime: "audio/mpeg", ram: { bytes: 9000 }, play: { t: 12, loop: true } });
    d.add({ kind: "image", name: "a.png", bytes: new Blob([new Uint8Array(5)], { type: "image/png" }), mime: "image/png" });
    const files = encodeDeck(d.snapshot(), { app: "t" });
    eq([...files.keys()].filter((k) => !k.endsWith("manifest.json")).length, 1, "只有图片进了文件");
    const man = JSON.parse(await files.get(".t/references/manifest.json").text());
    eq(JSON.stringify(man.items[0].ram), JSON.stringify({ bytes: 9000 })); eq(man.items[0].src, undefined);
    const back = await decodeDeck({ app: "t", knownKinds: ["audio", "image"], getFile: (p) => files.get(p) ?? null });
    const d2 = createDeck(); d2.restore(back);
    const hole = d2.cards()[0]; eq(hole.bytes, null); eq(hole.ram.bytes, 9000); eq(hole.play.t, 12);
    let asked = 0;
    const r = await importIntoDeck(d2, [file("bgm.mp3", "audio/mpeg", 9000)], { kinds: KINDS, ask: async () => { asked++; return "keep"; }, askAbove: { audio: 1 } });
    eq(asked, 0); eq(r.filled.length, 1); eq(r.added.length, 0); eq(d2.size, 2); eq(d2.cards()[0].bytes.size, 9000); eq(d2.cards()[0].ram.bytes, 9000, "补回来照旧只放内存");
  });
  it("setRam：开 = 通知 cards（标脏）；空位关不了（手上没字节）；fill 只给空位、通知 view", async () => {
    const { createDeck } = await import("../src/deck/index.ts");
    const d = createDeck(), log = []; d.onChange((c) => log.push(c.type));
    const id = d.add({ kind: "audio", name: "x", bytes: new Blob(["ab"]) }); log.length = 0;
    d.setRam(id, true); eq(d.get(id).ram.bytes, 2); d.setRam(id, false); eq(d.get(id).ram, null);
    eq(log.join(), "cards,cards");
    const h = d.add({ kind: "audio", name: "y", ram: { bytes: 3 } }); log.length = 0;
    d.setRam(h, false); eq(d.get(h).ram.bytes, 3, "空位关不了");
    d.fill(h, new Blob(["abc"])); eq(d.get(h).bytes.size, 3); eq(log.join(), "view");
  });
});
