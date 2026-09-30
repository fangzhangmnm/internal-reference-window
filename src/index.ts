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
  RefLabels,
  RefItem,
  RefMenuItem,
  RefMenuOpts,
  RefMenuHandle,
  RefMenuPort,
} from "./reference-window.ts";
