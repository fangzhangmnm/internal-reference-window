// import.ts —— 导入漏斗（0.4.0；零 DOM）：文件 → 嗅出是哪种卡 → 够大就问宿主 → 原样 / 压 / 不要 → 进牌组。
// created 2026-10-09 by Claude Opus 5.5（MoonSinger session；方案 = ../ai-docs/20261008-reference-window-0.4-audio-plan.md）。
// user 原话：「库升minor + mp3功能，最好加一个压制转录的injection抽象接口」「不过我们mp3其实默认不压，导入的时候有一个对话框告诉你大小，然后问你要不要压。
//   图片也一样」「然后api的应该是图片音频视频转码都是app提供」「3. 音频也超过1MB才问？」。
// 规矩：**库不带任何编码器**（转码是宿主注入的 RefTranscoder）；**库不画对话框**（问用户是宿主注入的 ask——宿主自己的面板，不用系统对话框）；
//   默认原样存；问不问的门槛宿主定（askAbove，按种类）；没注入 ask = 一律原样。压缩策略归宿主（技术方案 PLAN:98）。
import type { Card, Deck } from "./deck.ts";

export type RefImportKind = "image" | "text" | "audio" | "video";
/** 宿主注入的转码：会压哪几种、压完大概多大（给面板上报数；可不给）、怎么压。 */
export interface RefTranscoder {
  kinds: readonly RefImportKind[];
  estimate?(kind: RefImportKind, file: Blob): Promise<number | null>;
  encode(kind: RefImportKind, file: Blob): Promise<{ blob: Blob; mime: string; note?: string }>;
}
/** 问用户的时候给宿主的信息。canCompress = 宿主的转码认这种；suggestRam = 超过宿主给的线（ramAbove），面板该把「只放内存」放在前面。 */
export interface RefImportQuestion { name: string; kind: RefImportKind; bytes: number; estimate: number | null; canCompress: boolean; suggestRam: boolean }
/** keep = 原样存进文档；compress = 宿主转码后存；ram = 只放内存（不存，下次是空位、提示重新导入）；cancel = 不要。 */
export type RefImportChoice = "keep" | "compress" | "ram" | "cancel";
export interface RefImportOptions {
  /** 这个宿主画得出来的种类（不在里面的 = 不收、报 unsupported）。 */
  kinds: readonly string[];
  transcoder?: RefTranscoder | null;
  ask?: ((q: RefImportQuestion) => Promise<RefImportChoice>) | null;
  /** 超过这么多字节才问（按种类；不给 = 不问）。 */
  askAbove?: Partial<Record<RefImportKind, number>>;
  /** 超过这么多字节 = 建议「只放内存」（question.suggestRam；user 2026-10-09「这里可能是全家族仓我们唯一一个真的需要nudge用户」）。不给 = 不建议。 */
  ramAbove?: number;
}
export interface RefImportSkip { name: string; why: "unsupported" | "cancelled" | "failed"; message?: string }
/** filled = 补回了「只放内存」的空位（同种类、同名的那张；没新加卡）。 */
export interface RefImportResult { added: Card[]; filled: Card[]; skipped: RefImportSkip[]; notes: string[] }

/** 看 mime（再看扩展名）是哪种卡；认不出 = null。 */
export function sniffKind(f: Blob & { name?: string }): RefImportKind | null {
  const t = (f.type || "").toLowerCase(), n = (f.name || "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("text/") || /\.(txt|md)$/.test(n)) return "text";
  if (/\.(mp3|m4a|wav|flac|ogg|opus|aac|weba)$/.test(n)) return "audio";
  if (/\.(png|jpe?g|webp|gif)$/.test(n)) return "image";
  if (/\.(mp4|webm|mov)$/.test(n)) return "video";
  return null;
}
/** 一个一个进牌组（顺序 = 给的顺序）；每张问不问、压不压按上面的规矩。不抛：每个文件的结果写在 added / skipped 里，调用方如实说。 */
export async function importIntoDeck(deck: Deck, files: readonly (Blob & { name?: string })[], o: RefImportOptions): Promise<RefImportResult> {
  const out: RefImportResult = { added: [], filled: [], skipped: [], notes: [] };
  for (const f of files) {
    const name = f.name ?? "", kind = sniffKind(f);
    if (!kind || !o.kinds.includes(kind)) { out.skipped.push({ name, why: "unsupported" }); continue; }
    // 「只放内存」的空位：同种类、同名 = 补回原位（不问、不新加；位置 / 播放位置 / 循环都还在）
    const hole = deck.cards().find((c) => c.ram && !c.bytes && c.kind === kind && c.name === name);
    if (hole) { deck.fill(hole.id, f, f.type || undefined); deck.select(deck.indexOf(hole.id)); out.filled.push(hole); continue; }
    try {
      let blob: Blob = f, mime = f.type || "", ram = false;
      const canCompress = !!o.transcoder?.kinds.includes(kind), limit = o.askAbove?.[kind];
      if (o.ask && limit !== undefined && f.size > limit) {
        const estimate = canCompress && o.transcoder?.estimate ? await o.transcoder.estimate(kind, f).catch(() => null) : null;
        const choice = await o.ask({ name, kind, bytes: f.size, estimate, canCompress, suggestRam: o.ramAbove !== undefined && f.size > o.ramAbove });
        if (choice === "cancel") { out.skipped.push({ name, why: "cancelled" }); continue; }
        if (choice === "ram") ram = true;
        if (choice === "compress" && canCompress) { const r = await o.transcoder!.encode(kind, f); blob = r.blob; mime = r.mime; if (r.note) out.notes.push(`${name}: ${r.note}`); }
      }
      if (kind === "text" && !mime) mime = /\.md$/i.test(name) ? "text/markdown" : "text/plain";
      const id = deck.add({ kind, bytes: blob, mime, name, ...(ram ? { ram: { bytes: blob.size } } : {}) });
      const c = deck.cards().find((x) => x.id === id); if (c) out.added.push(c);
    } catch (e) {
      out.skipped.push({ name, why: "failed", message: String((e as { message?: unknown })?.message ?? e) });
    }
  }
  return out;
}
