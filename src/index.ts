// @internal/reference-window 包根：默认视图（自定义元素）。
// created 2026-09-29 by Claude Fable 5.1
// import 本入口即注册 <wp-reference-window>（guarded define，两个 bundle 各带一份也不炸）。

export {
  WpReferenceWindow,
  WP_REFERENCE_WINDOW_TAG,
  REF_ICON_IDS,
} from "./reference-window.ts";
export type {
  RefViewport,
  RefPanelRect,
  RefBitmapSource,
  RefLiveSource,
  RefLiveWant,
  RefLiveFrame,
  RefLiveProvider,
  RefLiveTarget,
  RefLabels,
  RefItem,
  RefMenuItem,
  RefMenuOpts,
  RefMenuHandle,
  RefMenuPort,
} from "./reference-window.ts";

// 牌组的类型在包根也给一份（用 el.deck 的宿主不必再多写一行 import）；值（createDeck / 编解码）走 "./deck" 入口。
export type { Card, CardKind, CardPlay, CardView, CarriedItem, Deck, DeckChange, DeckRestore, DeckSnapshot, NewCard } from "./deck/index.ts";
