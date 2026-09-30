# @internal/reference-window

> created 2026-09-29 by Claude Fable 5.1 · as-of 0.2.0（2026-09-29；0.1.0 同日首版）· 源 = WeebPaint v0.14.20 `src/frontend/reference-window.ts`

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

## 数据契约 = 容器里的一个目录（0.2.0）

```ts
import { encodeDeck, decodeDeck } from "@internal/reference-window/deck";

// 保存：库交出一组文件（.weebpaint/references/manifest.json + 每张卡的字节），宿主原样塞进自己的容器
const files = encodeDeck(ref.deck.snapshot(), { app: "weebpaint" });        // Map<路径, Blob>
// 载入：宿主按路径给字节，库自己读清单、自己迁移版本、自己带着不认识的卡
const decoded = await decodeDeck({ app: "weebpaint", knownKinds: ["image", "live"], getFile: (path) => entries.get(path) ?? null });
ref.deck.restore(decoded);
```

- 目录名 `.<app>/references/` 由库定，宿主只报名字；清单的形状、版本戳、迁移都在库里。
- 清单比库新 → `DeckManifestTooNewError`，不降级不猜；不认识的种类原样带着，保存时原样写回。
- 老文件里清单住在别处（WeebPaint format 2 在 editor-state.json 的 `refPanels`）：把那段 JSON 搬成 `manifest.json` 是宿主的布局迁移，搬过来的清单没有 version 也能读（当 v1）。
- 收货：在消费方仓根 `bash "../20260929 internal-reference-window/scripts/pull-package.sh" <版本>`（只认已发版）。
- 约定全文：WeebPaint `ai-docs/20260810-family-web-component-convention.md`。
