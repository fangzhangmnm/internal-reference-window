// 牌组模型：参考窗里那一叠卡。零 DOM——node 直测；CatsUp 的 VR 视图、宿主自己重写的视图也从这里进。
// created 2026-09-29 by Claude Fable 5.1
// 契约出处 = 家族根 ai-docs/20260929-reference-window-tech-plan.md §3。
//
// 三条规矩：
//   1. 本模块不持久化、不联网、不碰 DOM。宿主用 snapshot() 把牌组拿走，写进自己的容器。
//   2. restore() 是载入恢复专用，静默；其余一切变更都通知 onChange（宿主据此同步清单、决定标不标脏）。
//   3. 这个宿主不认识的卡不进 cards（画不出来），但原样留在 carried 里，保存时原样写回。

/** 每张卡自己的视图状态。图片：平移 / 缩放 / 旋转。文字：scale = 字号倍率，ty = 滚动位置。 */
export interface CardView { tx: number; ty: number; scale: number; rot: number }
/** 音视频的播放位置。 */
export interface CardPlay { t: number; loop: boolean }

/** 卡片种类是开放集。库自带的种类名见各 kinds 入口；宿主可以登记自己的。 */
export type CardKind = string;

export interface Card {
  /** 牌组内不透明 id。不持久化：每次 restore / add 重新发。 */
  readonly id: string;
  kind: CardKind;
  /** 文件名或首行。 */
  name: string;
  /** 字节，总是随文档保存。null 只出现在零字节的卡（如 "live"）或文件损坏缺字节时。 */
  bytes: Blob | null;
  mime: string;
  /** 宿主自己解析的不透明引用（"live" 卡：哪块画布 / 哪台相机）。库不解释。 */
  target: string | null;
  vp: CardView | null;
  play: CardPlay | null;
  /** 来历标记，平铺不套层。目前只有 "genai"。 */
  origin: string | null;
}

/** 新卡：只有 kind 必填，其余缺省为空。 */
export type NewCard = { kind: CardKind } & Partial<Omit<Card, "id" | "kind">>;

/** 这个宿主不认识的卡：清单条目和它引用的字节原样带着。 */
export interface CarriedItem {
  /** 它在清单里原来排第几张（写回时尽量放回原位）。 */
  at: number;
  /** 清单条目原文（JSON）。 */
  item: Record<string, unknown>;
  /** 条目引用的字节（按清单里的 src）。 */
  files: { src?: Blob };
}

export interface DeckSnapshot {
  index: number;
  cards: Card[];
  carried: CarriedItem[];
}
/** restore 的入参：卡可以不带 id（载入时本来就没有）。 */
export interface DeckRestore {
  index?: number;
  cards: readonly NewCard[];
  carried?: readonly CarriedItem[];
}

export type DeckChange =
  /** 增 / 删 / 挪：牌组内容变了，宿主应标脏。 */
  | { type: "cards" }
  /** 翻页 / 平移缩放 / 滚动 / 播放位置：只是看法变了。标不标脏归宿主。 */
  | { type: "view" }
  /** "live" 卡：宿主报「内容变了」，何时真去要一帧由视图定。 */
  | { type: "invalidate"; id: string }
  /** restore / clear 之后整副牌换了：视图该整个重画。不是用户改动，宿主不应据此标脏。 */
  | { type: "reset" };

export interface Deck {
  readonly size: number;
  readonly index: number;
  readonly current: Card | null;
  cards(): readonly Card[];
  get(id: string): Card | null;
  indexOf(id: string): number;
  snapshot(): DeckSnapshot;
  /** 载入恢复专用：整副换掉。返回新发的 id（顺序 = cards 顺序）。只发 "reset"。 */
  restore(s: DeckRestore): string[];
  /** 清空（换文档 / 重置）。只发 "reset"。 */
  clear(): void;
  /** 加一张卡。select 缺省 true = 加完翻到它。 */
  add(card: NewCard, opts?: { select?: boolean }): string;
  remove(id: string): void;
  /** 挪到第 toIndex 张（越界自动钳）。当前看的那张卡跟着走，不会因为挪动而换成别的卡。 */
  move(id: string, toIndex: number): void;
  select(index: number): void;
  setView(id: string, vp: CardView): void;
  setPlay(id: string, play: CardPlay): void;
  /** 改链接卡指向谁（宿主的页改了名）。内容变了 → 通知 "cards"；视图该重取内容。 */
  setTarget(id: string, target: string | null): void;
  invalidate(id: string): void;
  onChange(fn: (what: DeckChange) => void): () => void;
}

function cloneView(v: CardView | null | undefined): CardView | null {
  if (!v) return null;
  const ok = Number.isFinite(v.tx) && Number.isFinite(v.ty) && Number.isFinite(v.scale) && Number.isFinite(v.rot);
  return ok ? { tx: v.tx, ty: v.ty, scale: v.scale, rot: v.rot } : null;
}
function clonePlay(p: CardPlay | null | undefined): CardPlay | null {
  if (!p || !Number.isFinite(p.t)) return null;
  return { t: p.t, loop: !!p.loop };
}
function cloneCarried(c: CarriedItem): CarriedItem {
  return { at: c.at, item: JSON.parse(JSON.stringify(c.item)) as Record<string, unknown>, files: { ...c.files } };
}
function clampIndex(i: number, n: number): number {
  if (n <= 0) return 0;
  if (!Number.isFinite(i)) return 0;
  return Math.max(0, Math.min(n - 1, Math.trunc(i)));
}

export function createDeck(): Deck {
  let cards: Card[] = [];
  let carried: CarriedItem[] = [];
  let index = 0;
  let seq = 0;
  const listeners = new Set<(what: DeckChange) => void>();

  const emit = (what: DeckChange): void => {
    // 逐个调；一个监听者抛错不许拖垮别的监听者，也不许吞掉——收集后统一重抛第一个。
    let first: unknown = null, threw = false;
    for (const fn of [...listeners]) {
      try { fn(what); } catch (e) { if (!threw) { threw = true; first = e; } }
    }
    if (threw) throw first;
  };
  const make = (c: NewCard): Card => ({
    id: `c${++seq}`,
    kind: c.kind,
    name: c.name ?? "",
    bytes: c.bytes ?? null,
    mime: c.mime ?? (c.bytes?.type || ""),
    target: c.target ?? null,
    vp: cloneView(c.vp),
    play: clonePlay(c.play),
    origin: c.origin ?? null,
  });
  const copy = (c: Card): Card => ({ ...c, vp: cloneView(c.vp), play: clonePlay(c.play) });

  const deck: Deck = {
    get size() { return cards.length; },
    get index() { return index; },
    get current() { return cards[index] ?? null; },
    cards: () => cards,
    get: (id) => cards.find((c) => c.id === id) ?? null,
    indexOf: (id) => cards.findIndex((c) => c.id === id),

    snapshot: () => ({ index, cards: cards.map(copy), carried: carried.map(cloneCarried) }),

    restore(s) {
      if (!s || !Array.isArray(s.cards)) throw new TypeError("Deck.restore expects { cards: [...] }");
      cards = s.cards.map((c) => {
        if (!c || typeof c.kind !== "string" || !c.kind) throw new TypeError("Deck.restore: every card needs a non-empty string kind");
        return make(c);
      });
      carried = (s.carried ?? []).map(cloneCarried);
      index = clampIndex(s.index ?? 0, cards.length);
      emit({ type: "reset" });
      return cards.map((c) => c.id);
    },

    clear() {
      cards = []; carried = []; index = 0;
      emit({ type: "reset" });
    },

    add(card, opts) {
      if (!card || typeof card.kind !== "string" || !card.kind) throw new TypeError("Deck.add: card needs a non-empty string kind");
      const c = make(card);
      cards.push(c);
      if (opts?.select ?? true) index = cards.length - 1;
      emit({ type: "cards" });
      return c.id;
    },

    remove(id) {
      const i = deck.indexOf(id);
      if (i < 0) return;
      cards.splice(i, 1);
      // 删的在当前之前 → 当前那张卡往前挪了一位，index 跟着减；删的就是当前 → 停在原位（看下一张），到尾则退一格。
      if (i < index) index -= 1;
      index = clampIndex(index, cards.length);
      emit({ type: "cards" });
    },

    move(id, toIndex) {
      const from = deck.indexOf(id);
      if (from < 0) return;
      const to = clampIndex(toIndex, cards.length);
      if (to === from) return;
      const viewing = cards[index]?.id ?? null;
      const [c] = cards.splice(from, 1);
      cards.splice(to, 0, c!);
      if (viewing) index = deck.indexOf(viewing);
      emit({ type: "cards" });
    },

    select(i) {
      const next = clampIndex(i, cards.length);
      if (next === index) return;
      index = next;
      emit({ type: "view" });
    },

    setView(id, vp) {
      const c = deck.get(id);
      const v = cloneView(vp);
      if (!c || !v) return;
      const o = c.vp;
      if (o && o.tx === v.tx && o.ty === v.ty && o.scale === v.scale && o.rot === v.rot) return;
      c.vp = v;
      emit({ type: "view" });
    },

    setPlay(id, play) {
      const c = deck.get(id);
      const p = clonePlay(play);
      if (!c || !p) return;
      if (c.play && c.play.t === p.t && c.play.loop === p.loop) return;
      c.play = p;
      emit({ type: "view" });
    },

    setTarget(id, target) {
      const c = deck.get(id);
      if (!c || c.target === target) return;
      c.target = target;
      emit({ type: "cards" });
      emit({ type: "invalidate", id });
    },

    invalidate(id) {
      if (deck.indexOf(id) < 0) return;
      emit({ type: "invalidate", id });
    },

    onChange(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
  return deck;
}
