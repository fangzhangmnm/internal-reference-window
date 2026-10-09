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
- ~~**牌组里每张卡的字节都随文档保存**，没有「只在这次有效」这种状态（user 2026-09-29 批去掉）。~~ → **2026-10-09 翻案：有「只放内存」**（user「然后能不能加RAM only，就是不落盘，每次重新上传，这个非常有用！！！」「aha 加一个ram only很多蛋疼全解了」；两个做法里选 B「嗯试试B吧，这里可能是全家族仓我们唯一一个真的需要nudge用户，而不是不nudge用户自律的地方」）：卡标 `ram`，存档时字节不写、清单记 `ram: {bytes}`；读回来 = 空位（名字 · 大小 + 「拖进来 / ＋ 重新导入」），同种类同名的文件导入 = 补回原位（不新加、不问）。默认照旧随文档保存；超过宿主给的线（`ramAbove`）问的时候建议它。edited by Claude Opus 5.5 2026-10-09
- **版本纪律同其他内部库**：开发期 `0.0.0`；版本号只在 user 过目真实导出面之后才写；收货脚本只认打过 tag 的已发版；bump minor 之前必须 user 批。
- **只出货不送货**：本库的活到 commit 交付物为止；宿主收货、跑宿主测试、宿主发版是宿主 session 的活。
- 测试分两档：`npm test`（node，零 DOM 的部分）+ `npm run probe`（构建后在无头 Chromium 里跑组件；playwright 借 WeebPaint 的 node_modules）。构建 + 户口 `npm run build`（`api/` 是生成物，勿手改）。
- **开发期往宿主里装包只许用 `scripts/dev-install.sh`**：版本号一直是 0.0.0，手动覆盖 tgz 再 `npm install` 会命中旧缓存、装进去的还是旧包，测试全绿但测的是旧代码（2026-09-29 当天真踩过）。脚本会逐字节验货，并拒绝往宿主的 main 上装。
- `test/fixtures/` 是已发出去的格式的冻结样本：只增不改，清单编解码必须永远读得了。
- `journal/`、`journals/` 是人类区，AI 永不写。

- **底边地板（0.3.2，user 2026-09-30「参考窗或者任何浮窗需要保证 move 和 resize 能点到」→ 10-01「参考窗库发 0.3.2」）**：`bottomFloor`（宿主注入 = 屏底被占掉的高度：app 内软键盘、iOS 键盘那一块；缺省 0）+ `reclamp()`（地板变了之后宿主调：整窗钳回可见区，动了才发 rectchange）。拖 / resize / 视口钳制三条路都吃它，右下角的缩放把手不会缩进键盘底下。地板撤掉时窗留在原地，不自己跳回去。顺手修：缩尺寸时把边框那一圈扣掉（以前缩完还高出两像素）。探针 `bottomFloor()` 五条。edited by Claude Fable 5.1 2026-10-01
- **粘贴归焦点（0.3.1，user 2026-09-30「这个看 focus 吧」；否决了「开窗即收粘贴」）**：窗身（画面 / 空态）按下 = 窗拿焦点（host `tabindex=0`，`hasFocus` getter，`:host(:focus)` 一圈描边）；四个小钮与两把手仍不夺焦点（瞥一眼翻页零代价）。**粘贴本身归宿主**：宿主的 `paste` 监听看 `el.hasFocus` 分流（有焦点 → 文字 / 图片 / txt·md 文件进参考窗；没有 → 宿主原行为）；宿主从入口打开窗时顺手 `el.focus()`，「开窗 → Ctrl+V」一步到位。窗底纯色 `--void`（点阵归宿主 CSS 自加），空态默认文案「＋ 导入参考」。
- **0.4.0 音频卡 + 宿主注入的转码 + 只放内存（2026-10-09 发版，user「发」；Claude Opus 5.5；方案 = `../ai-docs/20261008-reference-window-0.4-audio-plan.md`；user「库升minor + mp3功能，最好加一个压制转录的injection抽象接口」「然后api的应该是图片音频视频转码都是app提供」「mp3做」）**：
  - **音频卡**（kind `audio`）：卡里播放 / 暂停 + 能拖的进度条 + 时间，底层一个 `<audio>`（每个窗一个）；不自动放；关窗不停、翻到别的卡不停（user「不停」），卡被删 / 元素离开文档才停；窗有焦点时空格 = 播放 / 暂停；播放钮不抢焦点（探针用真实鼠标核）。＋ 菜单：循环（记进 `Card.play.loop`）、速度（只在宿主给了 `audioRates` 时列，保音高；user「默认不开，moonsinger开」）；播放位置 / 循环 = 视图态（牌组发 view，不标脏）。
  - **导入漏斗** `importIntoDeck` / `el.importFiles(files, {transcoder, ask, askAbove, ramAbove})`（`src/deck/import.ts`，零 DOM）：嗅种类 → 超过 `askAbove`（按种类）才问 → 原样 / 压 / 只放内存 / 不要。**库不带编码器**（`RefTranscoder` 宿主注入：会压哪几种、估多大、怎么压），**库不画对话框**（`ask` 宿主注入）；默认原样（user「我们mp3其实默认不压，导入的时候有一个对话框告诉你大小，然后问你要不要压。图片也一样」）。
  - MIME 表补 wav / flac / aac / mov + 别名（x-wav、x-m4a、audio/mp3…，只用来定扩展名）。清单不升版本：`ram` 是可选字段，老库读到 = 照旧当有 src 的卡（没 src = 空字节的卡）。视频卡这一版不做（接口里留着种类）。
  - 测试：`test/import.test.mjs`（导入漏斗、只放内存往返 / 补位 / setRam）+ 探针 `audioCards()`（20 条）+ 播放钮真实鼠标焦点。
