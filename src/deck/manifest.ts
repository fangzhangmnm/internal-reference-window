// 清单编解码：牌组 ⇄（一段 JSON 清单 + 一组具名字节）。三个宿主共用一种清单，各自决定塞进容器的哪里。
// created 2026-09-29 by Claude Fable 5.1
// 契约出处 = 家族根 ai-docs/20260929-reference-window-tech-plan.md §3 / §4.1。
//
// 兼容性：键名沿用 WeebPaint format 2 的 refPanels（index / items / kind / src / vp），新字段全是可选的，
//   空值不写。所以 WeebPaint 已有的清单本身就是合法清单（零迁移）；只含图片和 live 的牌组，
//   编出来的条目也只有 {kind, src, vp} / {kind, vp}，键的顺序都一样。
// 不认识的卡：原样带着（清单条目原文 + 它引用的字节），编码时原样写回。
// 本模块只做内存里的变换：不读写文件、不联网。文件叫什么名字由宿主的 nameFile 决定。

import type { Card, CardPlay, CardView, CarriedItem, DeckSnapshot, NewCard } from "./deck.ts";

export const DECK_MANIFEST_VERSION = 1;

export interface ManifestItem {
  kind: string;
  /** 字节在容器里的文件名。 */
  src?: string;
  vp?: CardView | null;
  /** 小封面在容器里的文件名。 */
  face?: string;
  name?: string;
  mime?: string;
  target?: string;
  origin?: string;
  play?: CardPlay;
  [extra: string]: unknown;
}
export interface DeckManifest {
  /** 缺省 = WeebPaint format 2 的 refPanels（没有版本戳）。 */
  version?: number;
  index: number;
  items: ManifestItem[];
}

export interface EncodeOptions {
  /** 给第 position 张卡的字节（或小封面）起文件名。ext 不带点，由本库按 mime 定（不认识的 mime 给 "bin"）。 */
  nameFile: (position: number, ext: string, role: "bytes" | "face") => string;
  /** 给就写版本戳，不给就不写（WeebPaint format 2 没有版本戳）。 */
  version?: number;
}
export interface DecodeOptions {
  /** 这个宿主画得出来的种类。其余的原样带着。 */
  knownKinds: readonly string[];
  /** 按文件名取字节；没有就返回 null。 */
  getFile: (name: string) => Blob | null;
}
/** 解码结果可以直接喂 Deck.restore()。 */
export interface DecodedDeck { index: number; cards: NewCard[]; carried: CarriedItem[] }

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "text/plain": "txt", "text/markdown": "md",
  "video/mp4": "mp4", "video/webm": "webm",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/opus": "opus", "audio/webm": "weba",
};
const MIME_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]));

/** mime → 扩展名（不带点）。参数里的 charset 之类先剥掉。不认识 → "bin"。 */
export function extForMime(mime: string): string {
  const base = (mime || "").split(";")[0]!.trim().toLowerCase();
  return EXT_BY_MIME[base] ?? "bin";
}
/** 文件名 → mime（按扩展名猜）。猜不出 → ""。 */
export function mimeForName(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name || "");
  return m ? (MIME_BY_EXT[m[1]!.toLowerCase()] ?? "") : "";
}
function extOfName(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name || "");
  return m ? m[1]!.toLowerCase() : "bin";
}

function isObj(x: unknown): x is Record<string, unknown> { return !!x && typeof x === "object" && !Array.isArray(x); }
function readView(x: unknown): CardView | null {
  if (!isObj(x)) return null;
  const { tx, ty, scale, rot } = x as Record<string, unknown>;
  const ok = [tx, ty, scale, rot].every((n) => typeof n === "number" && Number.isFinite(n));
  return ok ? { tx: tx as number, ty: ty as number, scale: scale as number, rot: rot as number } : null;
}
function readPlay(x: unknown): CardPlay | null {
  if (!isObj(x) || typeof x.t !== "number" || !Number.isFinite(x.t)) return null;
  return { t: x.t, loop: !!x.loop };
}
const str = (x: unknown): string => (typeof x === "string" ? x : "");

export function decodeDeck(manifest: unknown, o: DecodeOptions): DecodedDeck {
  const known = new Set(o.knownKinds);
  const rawItems = isObj(manifest) && Array.isArray(manifest.items) ? manifest.items : [];
  const cards: NewCard[] = [];
  const carried: CarriedItem[] = [];
  const rawIndex = isObj(manifest) && typeof manifest.index === "number" ? manifest.index : 0;
  // 清单里的 index 数的是「清单第几条」；认识的卡前面若夹着不认识的，要换算成「cards 里第几张」。
  let index = 0, indexSet = false;

  rawItems.forEach((raw, at) => {
    if (!isObj(raw) || typeof raw.kind !== "string" || !raw.kind) return;   // 连种类都没有的条目：不是卡，丢
    if (!known.has(raw.kind)) {
      const files: CarriedItem["files"] = {};
      const s = str(raw.src) ? o.getFile(str(raw.src)) : null;
      const f = str(raw.face) ? o.getFile(str(raw.face)) : null;
      if (s) files.src = s;
      if (f) files.face = f;
      carried.push({ at, item: JSON.parse(JSON.stringify(raw)) as Record<string, unknown>, files });
      return;
    }
    const src = str(raw.src);
    const bytes = src ? o.getFile(src) : null;
    const face = str(raw.face) ? o.getFile(str(raw.face)) : null;
    if (at === rawIndex) { index = cards.length; indexSet = true; }
    cards.push({
      kind: raw.kind,
      name: str(raw.name),
      bytes,
      mime: str(raw.mime) || bytes?.type || mimeForName(src),
      target: str(raw.target) || null,
      face,
      vp: readView(raw.vp),
      play: readPlay(raw.play),
      origin: str(raw.origin) || null,
    });
  });
  if (!indexSet) index = Math.max(0, Math.min(cards.length - 1, Math.trunc(rawIndex) || 0));
  return { index, cards, carried };
}

export function encodeDeck(s: DeckSnapshot, o: EncodeOptions): { manifest: DeckManifest; files: Map<string, Blob> } {
  // 先把认识的卡和带着的卡排回一条队：带着的卡尽量放回原来的位置。
  type Slot = { card: Card } | { carried: CarriedItem };
  const slots: Slot[] = s.cards.map((card) => ({ card }));
  for (const c of [...s.carried].sort((a, b) => a.at - b.at)) {
    const at = Math.max(0, Math.min(slots.length, Math.trunc(c.at) || 0));
    slots.splice(at, 0, { carried: c });
  }

  const files = new Map<string, Blob>();
  const put = (name: string, blob: Blob): void => {
    if (files.has(name)) throw new Error(`encodeDeck: nameFile returned the same name twice: ${name}`);
    files.set(name, blob);
  };
  const items: ManifestItem[] = [];
  let index = 0;
  const viewing = s.cards[s.index] ?? null;

  slots.forEach((slot, position) => {
    if ("carried" in slot) {
      // 不认识的卡：条目原文照写；它引用的字节按新位置重新起名（否则会和认识的卡撞名）。
      const item = JSON.parse(JSON.stringify(slot.carried.item)) as ManifestItem;
      const { src, face } = slot.carried.files;
      if (src) { const n = o.nameFile(position, extOfName(str(item.src)), "bytes"); put(n, src); item.src = n; }
      if (face) { const n = o.nameFile(position, extOfName(str(item.face)), "face"); put(n, face); item.face = n; }
      items.push(item);
      return;
    }
    const c = slot.card;
    if (c === viewing) index = position;
    // 键的顺序固定：kind, src, vp 在前（= WeebPaint format 2），新字段在后；空值不写。
    const item: ManifestItem = { kind: c.kind };
    if (c.bytes) { const n = o.nameFile(position, extForMime(c.mime || c.bytes.type), "bytes"); put(n, c.bytes); item.src = n; }
    item.vp = c.vp ? { tx: c.vp.tx, ty: c.vp.ty, scale: c.vp.scale, rot: c.vp.rot } : null;
    if (c.face) { const n = o.nameFile(position, extForMime(c.face.type), "face"); put(n, c.face); item.face = n; }
    if (c.name) item.name = c.name;
    // mime 只在扩展名说不清时才写（扩展名说真话是 WeebPaint 的既有约定）
    if (c.mime && (!item.src || mimeForName(item.src) !== c.mime.split(";")[0]!.trim().toLowerCase())) item.mime = c.mime;
    if (c.target) item.target = c.target;
    if (c.origin) item.origin = c.origin;
    if (c.play) item.play = { t: c.play.t, loop: c.play.loop };
    items.push(item);
  });

  const manifest: DeckManifest = o.version != null ? { version: o.version, index, items } : { index, items };
  return { manifest, files };
}
