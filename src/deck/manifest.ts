// 参考窗的数据契约 = 容器里的**一个目录**：`.<app>/references/`，里面一份 `manifest.json` + 每张卡的字节。
// created 2026-09-29 by Claude Fable 5.1；0.2.0 改成目录制（user 2026-09-29「reference要不要自己独立的json这样是不是就是深模块窄接口了？」）
//
// 宿主的接口只有两件事：说自己叫什么（app），按名字取字节 / 存字节。命名、清单的形状、版本戳、迁移、
// 不认识的卡怎么带着——全在这个模块里。宿主不需要解析清单，也不需要知道有清单。
//
// 目录布局（0.2.0 起）：
//   .<app>/references/manifest.json        ← 清单：{ version, index, items[] }
//   .<app>/references/r<位置>.<扩展名>       ← 每张有字节的卡；位置 = 清单序号（零字节的卡不落文件，序号会跳）
//
// 兼容性：清单条目的键名沿用 WeebPaint format 2 的 refPanels（kind / src / vp），新字段可选、空值不写；
//   没有 version 的清单当 v1 读（WeebPaint 老文件里 refPanels 的那段 JSON 搬进 manifest.json 就能直接读）。
//   把老文件里的清单**搬**到这个目录是宿主的布局迁移；清单**自己**的版本演化在本模块（migrateDeckManifest）。
// 本模块只做内存里的变换：不读写文件、不联网。

import type { Card, CardPlay, CardView, CarriedItem, DeckSnapshot, NewCard } from "./deck.ts";

export const DECK_MANIFEST_VERSION = 1;
export const DECK_MANIFEST_NAME = "manifest.json";

/** 参考窗在容器里住的目录（不带尾斜杠）。 */
export function deckDir(app: string): string {
  if (!/^[a-z][a-z0-9-]*$/.test(app)) throw new Error(`deckDir: app name must be lowercase [a-z0-9-], got "${app}"`);
  return `.${app}/references`;
}

export interface ManifestItem {
  kind: string;
  /** 字节在容器里的文件名（含目录）。 */
  src?: string;
  vp?: CardView | null;
  name?: string;
  mime?: string;
  target?: string;
  origin?: string;
  play?: CardPlay;
  [extra: string]: unknown;
}
export interface DeckManifest {
  version: number;
  index: number;
  items: ManifestItem[];
}

export interface EncodeOptions {
  /** 宿主的名字，决定目录：`.<app>/references/`。 */
  app: string;
}
export interface DecodeOptions {
  app: string;
  /** 这个宿主画得出来的种类。其余的原样带着。 */
  knownKinds: readonly string[];
  /** 按文件名（含目录）取字节；没有就返回 null。 */
  getFile: (path: string) => Blob | null;
}
/** 解码结果可以直接喂 Deck.restore()。 */
export interface DecodedDeck { index: number; cards: NewCard[]; carried: CarriedItem[] }

/** 清单版本比这个库新：不降级、不猜，报出去。 */
export class DeckManifestTooNewError extends Error {
  readonly fileVersion: number;
  readonly libVersion: number;
  constructor(fileVersion: number, libVersion: number) {
    super(`reference manifest version ${fileVersion} is newer than this library supports (${libVersion}); refusing to read`);
    this.name = "DeckManifestTooNewError";
    this.fileVersion = fileVersion; this.libVersion = libVersion;
  }
}

// ---- 扩展名 ↔ mime（「扩展名说真话」是 WeebPaint 的既有约定）----
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "text/plain": "txt", "text/markdown": "md",
  "video/mp4": "mp4", "video/webm": "webm",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/opus": "opus", "audio/webm": "weba",
};
const MIME_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]));

/** mime → 扩展名（不带点）。不认识的图片给 "img"（WeebPaint 既有），其余不认识的给 "bin"。 */
export function extForMime(mime: string): string {
  const base = (mime || "").split(";")[0]!.trim().toLowerCase();
  return EXT_BY_MIME[base] ?? (base.startsWith("image/") ? "img" : "bin");
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
const fileName = (dir: string, position: number, ext: string): string => `${dir}/r${position}.${ext}`;

// ---- 清单自己的版本演化（CatsUp 立宪 §7 同款：纯函数、链式升级、比库新就拒）----
type Step = (json: Record<string, unknown>) => Record<string, unknown>;
/** STEPS[v] = 从 v 升到 v+1。加迁移 = 在这里登记一条 + 在 test/fixtures/ 冻结一份旧版清单。 */
const STEPS: Record<number, Step> = {};

function isObj(x: unknown): x is Record<string, unknown> { return !!x && typeof x === "object" && !Array.isArray(x); }

/** 把任何版本的清单升到当前版。缺 version 视为 1；不是对象 → 空清单。 */
export function migrateDeckManifest(json: unknown): DeckManifest {
  const src = isObj(json) ? json : {};
  let v = typeof src.version === "number" && Number.isFinite(src.version) ? Math.trunc(src.version) : 1;
  if (v > DECK_MANIFEST_VERSION) throw new DeckManifestTooNewError(v, DECK_MANIFEST_VERSION);
  let cur: Record<string, unknown> = src;
  while (v < DECK_MANIFEST_VERSION) {
    const step = STEPS[v];
    if (!step) throw new Error(`migrateDeckManifest: no step registered for v${v} → v${v + 1}`);
    cur = step(cur); v++;
    if (cur.version !== v) throw new Error(`migrateDeckManifest: step v${v - 1}→v${v} did not set version`);
  }
  const items = Array.isArray(cur.items) ? (cur.items as unknown[]).filter((it): it is ManifestItem => isObj(it) && typeof it.kind === "string" && !!it.kind) : [];
  const index = typeof cur.index === "number" && Number.isFinite(cur.index) ? Math.trunc(cur.index) : 0;
  return { version: DECK_MANIFEST_VERSION, index, items };
}

function readView(x: unknown): CardView | null {
  if (!isObj(x)) return null;
  const { tx, ty, scale, rot } = x;
  const ok = [tx, ty, scale, rot].every((n) => typeof n === "number" && Number.isFinite(n));
  return ok ? { tx: tx as number, ty: ty as number, scale: scale as number, rot: rot as number } : null;
}
function readPlay(x: unknown): CardPlay | null {
  if (!isObj(x) || typeof x.t !== "number" || !Number.isFinite(x.t)) return null;
  return { t: x.t, loop: !!x.loop };
}
const str = (x: unknown): string => (typeof x === "string" ? x : "");

/** 从容器里读回牌组。目录里没有 manifest.json → 空牌组（不是错）。清单不是合法 JSON → 抛错（不静默当空）。 */
export async function decodeDeck(o: DecodeOptions): Promise<DecodedDeck> {
  const dir = deckDir(o.app);
  const blob = o.getFile(`${dir}/${DECK_MANIFEST_NAME}`);
  if (!blob) return { index: 0, cards: [], carried: [] };
  let json: unknown;
  try { json = JSON.parse(await blob.text()); }
  catch (e) { throw new Error(`decodeDeck: ${dir}/${DECK_MANIFEST_NAME} is not valid JSON: ${String((e as Error).message)}`); }
  return decodeDeckFromJson(json, o);
}

/** 清单已经在手上（宿主从别处搬来的、或测试）时用这个。 */
export function decodeDeckFromJson(manifestJson: unknown, o: Pick<DecodeOptions, "knownKinds" | "getFile">): DecodedDeck {
  const m = migrateDeckManifest(manifestJson);
  const known = new Set(o.knownKinds);
  const cards: NewCard[] = [];
  const carried: CarriedItem[] = [];
  let index = 0, indexSet = false;
  m.items.forEach((raw, at) => {
    if (!known.has(raw.kind)) {
      const files: CarriedItem["files"] = {};
      const s = str(raw.src) ? o.getFile(str(raw.src)) : null;
      if (s) files.src = s;
      carried.push({ at, item: JSON.parse(JSON.stringify(raw)) as Record<string, unknown>, files });
      return;
    }
    const src = str(raw.src);
    const bytes = src ? o.getFile(src) : null;
    if (at === m.index) { index = cards.length; indexSet = true; }
    cards.push({
      kind: raw.kind,
      name: str(raw.name),
      bytes,
      mime: str(raw.mime) || bytes?.type || mimeForName(src),
      target: str(raw.target) || null,
      vp: readView(raw.vp),
      play: readPlay(raw.play),
      origin: str(raw.origin) || null,
    });
  });
  if (!indexSet) index = Math.max(0, Math.min(cards.length - 1, m.index));
  return { index, cards, carried };
}

/** 把牌组编成容器里的一组文件：`.<app>/references/manifest.json` + 每张卡的字节。宿主原样存。 */
export function encodeDeck(s: DeckSnapshot, o: EncodeOptions): Map<string, Blob> {
  const dir = deckDir(o.app);
  type Slot = { card: Card } | { carried: CarriedItem };
  const slots: Slot[] = s.cards.map((card) => ({ card }));
  for (const c of [...s.carried].sort((a, b) => a.at - b.at)) {
    const at = Math.max(0, Math.min(slots.length, Math.trunc(c.at) || 0));
    slots.splice(at, 0, { carried: c });
  }
  const files = new Map<string, Blob>();
  const items: ManifestItem[] = [];
  let index = 0;
  const viewing = s.cards[s.index] ?? null;
  slots.forEach((slot, position) => {
    if ("carried" in slot) {
      // 不认识的卡：条目原文照写；字节按新位置重新起名（否则会和认识的卡撞名）
      const item = JSON.parse(JSON.stringify(slot.carried.item)) as ManifestItem;
      const src = slot.carried.files.src;
      if (src) { const n = fileName(dir, position, extOfName(str(item.src))); files.set(n, src); item.src = n; }
      else delete item.src;   // 字节早就没了：别留一个指向不存在文件的名字
      items.push(item);
      return;
    }
    const c = slot.card;
    if (c === viewing) index = position;
    // 键的顺序固定：kind, src, vp 在前（= WeebPaint format 2），新字段在后；空值不写。
    const item: ManifestItem = { kind: c.kind };
    if (c.bytes) { const n = fileName(dir, position, extForMime(c.mime || c.bytes.type)); files.set(n, c.bytes); item.src = n; }
    item.vp = c.vp ? { tx: c.vp.tx, ty: c.vp.ty, scale: c.vp.scale, rot: c.vp.rot } : null;
    if (c.name) item.name = c.name;
    if (c.mime && (!item.src || mimeForName(item.src) !== c.mime.split(";")[0]!.trim().toLowerCase())) item.mime = c.mime;
    if (c.target) item.target = c.target;
    if (c.origin) item.origin = c.origin;
    if (c.play) item.play = { t: c.play.t, loop: c.play.loop };
    items.push(item);
  });
  const manifest: DeckManifest = { version: DECK_MANIFEST_VERSION, index, items };
  const out = new Map<string, Blob>();
  out.set(`${dir}/${DECK_MANIFEST_NAME}`, new Blob([JSON.stringify(manifest)], { type: "application/json" }));
  for (const [n, b] of files) out.set(n, b);
  return out;
}
