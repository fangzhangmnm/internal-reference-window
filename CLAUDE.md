# 20260929 internal-reference-window — 本库规则（@internal/reference-window）

家族总规则见 `../CLAUDE.md`。created 2026-09-29 by Claude Fable 5.1。

出生依据：user 2026-09-29「@internal/reference-window 同意」；开工门 = user 同日「你和WXHW 更新这个agent协调一下。他说没事就可以开始干了」，该 session 同日回复没有冲突。
设计讨论与 user 原话 = `../ai-docs/20260929-reference-window-shared-lib-round.md`；技术方案与提案 .h = `../ai-docs/20260929-reference-window-tech-plan.md`。

- **本库 = 参考窗**：屏幕上一直在场的那个位子。源 = WeebPaint v0.14.20 `src/frontend/reference-window.ts`。
- **看图、读文字、放音视频的界面全部由本库写**，宿主不写播放器。唯一由宿主提供画面的是「宿主出画面的卡」（WeebPaint 的画布小窗、CatsUp 的场景相机预览）。
- **本库永不碰本地存储、永不联网、永不写文件**：持久化、压缩政策、菜单、图标、文案、地板全由宿主注入。`test/redline-guard.test.mjs` 机械执法，别绕。
- **图标不手画**：运行时从宿主内联的 sprite 里 clone `<symbol>`；缺了出虚线占位。库里不许出现手写 `<path>`。
- **手势三角有两份**：`src/pointer-gesture.ts` 是 WeebPaint `src/common/pointer-gesture.ts` 里两个函数的逐字拷贝（WeebPaint 主画布也要用，所以那边留着）。改这里的数学 = 两边一起改；WeebPaint 侧有对拍测试守着。
- **数据契约 = 容器里的一个目录 `.<app>/references/`**（0.2.0，user 2026-09-29「reference要不要自己独立的json这样是不是就是深模块窄接口了？」）：`manifest.json` + 每张卡的字节。命名、清单形状、版本戳、迁移全在库里；宿主只报 app 名、按路径存取字节。清单自己的迁移步骤登记在 `src/deck/manifest.ts` 的 STEPS，每条配一份冻结样本。
- **不认识的卡原样带着**，保存时原样写回（user 2026-09-29 批）。
- **牌组里每张卡的字节都随文档保存**，没有「只在这次有效」这种状态（user 2026-09-29 批去掉）。
- **版本纪律同其他内部库**：开发期 `0.0.0`；版本号只在 user 过目真实导出面之后才写；收货脚本只认打过 tag 的已发版；bump minor 之前必须 user 批。
- **只出货不送货**：本库的活到 commit 交付物为止；宿主收货、跑宿主测试、宿主发版是宿主 session 的活。
- 测试分两档：`npm test`（node，零 DOM 的部分）+ `npm run probe`（构建后在无头 Chromium 里跑组件；playwright 借 WeebPaint 的 node_modules）。构建 + 户口 `npm run build`（`api/` 是生成物，勿手改）。
- **开发期往宿主里装包只许用 `scripts/dev-install.sh`**：版本号一直是 0.0.0，手动覆盖 tgz 再 `npm install` 会命中旧缓存、装进去的还是旧包，测试全绿但测的是旧代码（2026-09-29 当天真踩过）。脚本会逐字节验货，并拒绝往宿主的 main 上装。
- `test/fixtures/` 是已发出去的格式的冻结样本：只增不改，清单编解码必须永远读得了。
- `journal/`、`journals/` 是人类区，AI 永不写。
