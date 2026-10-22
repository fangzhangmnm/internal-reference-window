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
- ~~**牌组里每张卡的字节都随文档保存**，没有「只在这次有效」这种状态（user 2026-09-29 批去掉）。~~ → **2026-10-09 翻案：有「只放内存」**（user「然后能不能加RAM only，就是不落盘，每次重新上传，这个非常有用！！！」「aha 加一个ram only很多蛋疼全解了」；两个做法里选 B「嗯试试B吧，这里可能是全家族仓我们唯一一个真的需要nudge用户，而不是不nudge用户自律的地方」）：卡标 `ram`，存档时字节不写、清单记 `ram: {bytes}`；读回来 = 空位（名字 · 大小 + 「拖进来 / ＋ 重新导入」），同种类同名的文件导入 = 补回原位（不新加、不问）。~~默认照旧随文档保存~~ → **0.5.0 起音频 / 视频默认只放内存（当次有效），图片 / 文字默认随文档**（user 2026-10-21「音视频应该是当此有效，后来应该拍了」；`DEFAULT_RAM` 表，宿主 `importFiles({ defaultRam })` 按种类可覆盖）；超过宿主给的线（`ramAbove`）或这种默认就只放内存时，问的时候建议它（`suggestRam`）。edited by Claude Opus 5.5 2026-10-09 · edited by Claude Fable 5.1 2026-10-21
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
- **0.4.1 收成小图标 + 左上角好拖（2026-10-18 发版，Claude Opus 5.5；周账 F-59，user 10-18「4 你和fable又华丽丽的无视了…做。记账fable省」）**：
  - **收成小图标**（user 10-09「reference window加一个最小化（变成一个可拖动小图标）的功能，以后让opus弄」）：＋ 菜单「收成小图标」（`labels.minimize`）→ 窗缩成 44 px 圆钮（图标 = 家族 sprite `picture-in-picture`，宿主要内联它）；拖它 = 挪位置（钳在视口内、发 rectchange），点它 = 恢复原大小（钳回屏幕内）。用户收起 / 恢复发 `minimizechange {minimized}`；`el.minimized` 程序性 set 不发事件（同 open）。收着时 `rect` 报**收起前的外框宽高**（位置跟着小图标走）——宿主照常存 rect 不会把 44×44 当成窗的大小。关窗（open=false）顺手还原，再开 = 整窗。新图标零张（菜单项是文字，小图标用库里现成的）。
  - **左上角难拖**（user 10-13「参考窗左上角其实一直比较难拖」）：根因 = `clip-path` 裁在把手元素本身上，能按中的区域也被裁成三角，22 px 方块只剩一半。现在元素是透明 36 px 方块（触屏 44 px）专管按，看得见的三角底板 + 点阵挪到伪元素，样子不变（截图核过）。
  - 探针 +4（真实鼠标：点老三角外 (30, 12) 也拖得动；菜单收起 → 44 px、rect 报原 242×202、事件；拖小图标挪 300,200；点它恢复原大小、钳在屏内、事件 true,false），94 全过。为什么是 patch：只加一个可选状态 + 一个菜单项，接口零破坏（user 要 minor 就改）。
  - **0.4.3（10-18 patch，Claude Opus 5.5）左上角换成「点 = 缩成小图标、拖 = 挪」的圆钮**：user 10-18「小窗我的设计是，左上角那个很akward很难点的。。。总是点不中，优化一下，或者干脆换成一个点了之后变成图标，拖动是拖动的多义按钮换成和右下」。
    0.4.1 只放大了看不见的可点区，看得见的还是 22 px 小三角 → 人瞄着三角按、还是点不中。现在是和 ＋ / × 同款的 28 px 圆钮（半透明主题底 + 小窗图标 = 收起后小图标的那个图标），可点区 36 px（触屏 44 px）；
    按住拖过 4 px = 挪窗，没拖就松手 = 缩成小图标（就在原地，再点恢复），键盘回车同点。`labels.move` 的意思随之变（宿主改成「点一下缩成小图标，按住拖动挪位置」之类）；接口零变化。
    探针：焦点探针的「移动把手」换成「左上角圆钮」（点了不抢宿主焦点、照样收起）+ 0.4.3 三条（圆钮 28 px 在可点区里；手抖 2 px 照样算点 → 原地收起、发事件；再点恢复），99 全过。
  - **0.4.4（同日 patch）**：KudsRocket 截图核出两处——暗底的文字卡上圆钮的底色和卡片一样、圆钮整个看不见只剩图标；第一行字被左上角圆钮盖住（＋ / × 同样盖右上角）。
    三颗圆钮加一圈淡边（`--ink` 28%）；文字卡上边距 10 → 36 px（让出圆钮那一排）。0.4.3 发出几分钟、没有宿主提交收货。
  - **0.4.2（同夜 patch）**：0.4.1 漏把 `labels.restore` 挂到小图标上（没有 title / aria-label）→ 模板里写英文默认、宿主给了就覆盖；探针 +1（95）。0.4.1 发出几分钟、没有宿主提交收货。
- **0.5.0 视频卡 + 音视频默认当次有效 + 清单拍子 1.1.0（2026-10-21 发版：Claude Fable 5.1 lane 7 做完整轮 → 统筹转 user「叫停一波」停在发版前 → 同夜 user「你现在是opus，剩下的可以尾巴收干净吗？」+ 统筹「参考窗 0.5.0 现在发版」→ Claude Opus 5.5 补两处视频小漏洞后发；交接稿 `ai-docs/20261021-handoff-lane7.md`，user 10-21「参考窗你写 handoff，我开一个新的 lane 7，全做。音视频应该是当此有效，后来应该拍了。多个参考窗同屏不要」「参考窗 0.5.0 同意bump minor」）**：
  - **视频卡**（kind `video`；user 09-30「视频一定需要支持按帧播放，按帧rewind怎么办呢」「我贪一下，打开一个anime，一帧帧照着画」）：**画面画在同一块 canvas 上**（`<video>` 是合法的 drawImage 源）——平移 / 捏合 / 旋转 / 1:1 / 长按吸色和图片卡一套，零新代码；`<video>` 本尊藏在 shadow 里（`.vsrc` 1 px、clip-path 裁空，不 display:none——WebKit 对不在画面里的 video 会停更帧）。卡上只多一条底部控制条：上一帧 / 播放 / 下一帧 / 进度 / 时间（翻页条在时让出一排 `.paged`）。不自动放；**翻到别的卡 = 暂停**（画面不在眼前；音频那套「不停」是给 BGM 的，不适用）；卡被删 / 整副牌换了 = `<video>` 拿掉。窗有焦点：空格 = 播放 / 暂停，← → 、, . = 上一帧 / 下一帧。＋ 菜单：循环、速度（`audioRates` 视频也吃）、1:1、只放内存。
  - **逐帧**（浏览器没有按帧 API，两条路都做了，自动选）：下一帧 = 知道帧长就 seek 到「这一帧起点 + 1.5 帧」（落在下一帧正中，稳）；还不知道帧长就**静音播到下一帧就停**（`requestVideoFrameCallback` 报下一帧的 mediaTime → 暂停 → 精确 seek 回那一帧），顺手量出帧长；上一帧 = seek 到「起点 − 0.5 帧」。帧长 = 连续播放时相邻两帧 mediaTime 之差的最小值（掉帧只会让差变大），记进 `Card.play.fps`（视图态，不标脏，随清单走——下次开盘直接按它）；时间栏显示帧号 `#N`（没量到就不显示，不猜）。没有 rVFC 的浏览器按 `play.fps` 或 24 估。宿主转码注入那条「解成帧序列」的路线**没做**（现在这条在 Chromium 探针里逐帧精确；真机 WebKit 等 user 一次验证）。
  - **音视频默认只放内存**：`DEFAULT_RAM = { image: false, text: false, audio: true, video: true }`；`importFiles` 缺省 kinds 加了 `video`；`RefImportOptions.defaultRam` 按种类覆盖；问了 = 用户选的算（keep / compress 都是存进文档）。清单 / 空位 / 补位机制 = 0.4.0 那套原样。
  - **清单拍子 1.1.0（家族格式版本纪律，周账 F-69；家族根 `ai-docs/20261021-format-version-discipline.md`）**：`version` 仍是 major（老库只认它），加 `minor` / `patch` 两个可选整数键（缺 = 0）；`DECK_MANIFEST_STAMP` / `readDeckStamp` / `compareDeckStamp`；**判决给宿主** = `DecodedDeck.verdict`（`same / older / newer-patch / newer-minor`；major 更新仍抛 `DeckManifestTooNewError`）——宿主在 `newer-minor` 时告诉用户一次「这份是更新版本写的，这版没有的功能保存时不丢、只是看不到」，不弹窗不拦。**未知键直通**：清单顶层 → `DeckSnapshot.extra`，条目 → `Card.extra`，保存时原样写回、已知键永远赢、拍子永远写本库的。为什么是 1.1.0：加了 `play.fps`、顶层两键，都是可选 = minor；0.4.0 加的 `ram` 没标过（0.4.x 的文件 minor 缺 = 0，读到判 `older`，正常）。冻结样本 `test/fixtures/manifest-1.1.0.json`（本库 encodeDeck 自己生成，往返逐字节相同）。
  - 探针：`videoCards()` 24 条（样本 = ffmpeg 生成的 20 帧灰阶 10 fps VP9，`test/probes/fixtures/gray-steps-10fps.webm`，帧 i = 灰 10 + 12 i，逐帧对像素）；node 测试 +12（拍子 / 直通 / 默认存法 / 升级不丢东西）。发版前 Opus 补两处：旧 `<video>` 晚到的媒体事件按「还是不是当前这个」守住；链接视频卡 invalidate 换新 `<video>` 重取（探针 +2）。**125 探针 + 77 node 全过**。edited by Claude Opus 5.5 2026-10-21新图标零张（上一帧 / 下一帧 = 库里现成的 `skip-prev` / `skip-next`；宿主要内联这两个 id）。
  - 升级不丢东西（统筹 10-21 点名核）：新默认只管**新导入**的；0.4.x 存过的音视频（带 `src`）开出来字节都在、再存 `src` 还在，不会被改成空位——`test/manifest.test.mjs`「升级不丢东西」守着。
  - **宿主要做的**（各自会话收）：① 内联 `skip-prev` / `skip-next`；② `labels` 加 `prevFrame` / `nextFrame`；③ 读清单后看 `decoded.verdict === "newer-minor"` 提示一次；④ 导入漏斗的 `kinds` 若是自己传的，加 `"video"`；不想音频默认只放内存的传 `defaultRam: { audio: false }`；⑤ 真机（iPad Edge）验视频逐帧一次。
  - **不做**：多个参考窗同屏（user 10-21「不要」）。
