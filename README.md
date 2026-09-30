# @internal/reference-window

> created 2026-09-29 by Claude Fable 5.1 · as-of 0.1.0（2026-09-29 首版）· 源 = WeebPaint v0.14.20 `src/frontend/reference-window.ts`

PWA 家族的参考窗：一个浮在工作区上的小窗，放参考图、画布小窗这类「一直在场」的东西。

```ts
import { WpReferenceWindow } from "@internal/reference-window";   // import 即注册 <wp-reference-window>

const ref = document.querySelector("wp-reference-window") as WpReferenceWindow;
ref.menuPort = togglePopupMenu;          // 宿主注入：弹出菜单
ref.liveProvider = () => myCanvas;       // 宿主注入：画布小窗的画面
ref.labels = { load: "导入图片", /* … */ };
ref.open = true;
```

- 宿主要做的：把家族图标 sprite 内联进页面；提供 CSS 变量（`--bg --ink --ink-soft --line --radius --shadow --z-window`，全有缺省值）；把组件发出的事件拿去持久化。
- 本库不做的：不存任何东西、不联网、不决定压缩政策。
- 收货：在消费方仓根 `bash "../20260929 internal-reference-window/scripts/pull-package.sh" <版本>`（只认已发版）。
- 约定全文：WeebPaint `ai-docs/20260810-family-web-component-convention.md`。
