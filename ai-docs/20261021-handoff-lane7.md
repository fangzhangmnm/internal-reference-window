# 参考窗 lane 7 交接：全做（user 2026-10-21）

> created 20261021 by Claude Fable 5.1 · as-of 0.4.4 · 给 lane 7 的开工稿。user 10-21 原话：「参考窗你写 handoff，我开一个新的 lane 7，全做。音视频应该是当此有效，后来应该拍了。多个参考窗同屏不要。」
> 从这份交接起，参考窗仓（`20260929 internal-reference-window/`）归 lane 7 独占写；道 1（库道）不再碰它。账本 = `20261021-ledger.md`（user 诉求 ↔ 现状，先读它）。

## 0. 做什么（按顺序）

| # | 活 | 出处 | 现状（0.4.4 核过） |
|---|---|---|---|
| 1 | **音视频默认「当次有效」（只放内存）** | user 10-21「音视频应该是当此有效，后来应该拍了」；10-09「能不能加 RAM only，就是不落盘，每次重新上传，这个非常有用！！！」「aha 加一个 ram only 很多蛋疼全解了」 | **没按这个做**：`CLAUDE.md` 0.4.0 条写着「默认照旧随文档保存；超过宿主给的线（`ramAbove`）问的时候建议它」。`src/deck/import.ts` 的 `importIntoDeck`：`suggestRam` 只是把「只放内存」排前面，默认仍是原样进文档。**改成：kind 为 `audio` / `video` 时默认 = `ram`（只放内存，清单记 `ram: {bytes}`，读回来是空位、同名文件导入补回原位——0.4.0 已有这套机制，只换默认）；图片 / 文字默认不变。** 宿主要能覆盖（`defaultRam?: Partial<Record<RefImportKind, boolean>>` 之类，别硬编码死）。 |
| 2 | **视频卡** | user 09-30「哈哈我还真没想到 weebpaint 也需要视频。合理」「视频一定需要支持按帧播放，按帧 rewind 怎么办呢」「我贪一下，打开一个 anime，一帧帧照着画」 | 0.4.0 接口留了种类 `video`（`RefImportKind`、MIME 表有 mp4 / webm / mov），卡没写。做法沿音频卡：卡内 `<video>` + 播放 / 暂停 + 进度条；**逐帧**：浏览器原生 `<video>` 没有按帧 API，可靠的只有 `requestVideoFrameCallback` 往前走一帧，往回要 `currentTime -= 1/fps`（fps 得知道：宿主转码时写进 `Card.play.fps`，或者按 `getVideoPlaybackQuality` 估）；精确逐帧 rewind 的正解 = 宿主转码注入那条路把片段解成帧序列（`RefTranscoder` 已有抽象），库里只认「一组帧」——哪条先做看成本，写清楚再动。默认「当次有效」（#1）。 |
| 3 | **genai 来历标记：核一遍** | user 08-30「顺便留一个以后 genai era 可以用的加图的 api」；09-29「参考加 ai flag 同意，没啥意义，只要不让数据结构太难看（比如多一层封装），可以随手做」 | **已有**：`Card.origin: string \| null`（`src/deck/deck.ts`，清单 `origin` 字段，`manifest.ts` 读写）；`el.addImage(bitmap, blob, { origin: "genai" })` / `addText(..., { origin })` 就是程序化加图的口。账本里「待核」可以划掉；lane 7 只需确认 WeebPaint 整改 spec §5 `addReferenceImage(blob)` 那条漏斗接的是它（宿主的事，nudge 即可）。 |
| 4 | 账本里标「做了」的 8 条 | `20261021-ledger.md` §1 | 不用动；改 UI 时别退回去（丝薄、移开隐藏 gizmo、瞥一眼零代价、圆钮）。 |

**不做**：多个参考窗同屏（user 10-21「不要」）。账本 §1 末尾那三条转述（关闭键 / 入口 toggle / 多参考）按 10-21 这句算关掉。

## 1. 规矩（本仓 `CLAUDE.md` 全有，这里只提最容易踩的）

- 库永不碰存储、不联网、不写文件（`test/redline-guard.test.mjs` 机械执法）。转码 / 对话框 / 持久化全是宿主注入。
- 版本：开发期 `0.0.0`；#1 改默认 = 行为变更 → **minor（0.5.0），bump 前问 user**；#2 视频卡也是 minor。合成一次 0.5.0 发版最省。
- 图标从家族 sprite 取（`REF_ICON_IDS`），不手画；缺图标走 `20260708 SVG Icons/TODO.md` 登记 + stopgap。
- 测试：`npm test`（node）+ `npm run probe`（无头 Chromium，借 WeebPaint 的 playwright）；探针现在 99 条，改 gizmo / 卡片要加。
- 只出货不送货：发版到 tgz 为止；WeebPaint / WXHW / MoonSinger / KudsRocket 收货是各自会话的活（四家都在 0.4.4）。

## 2. 开工第一步

1. 读 `CLAUDE.md` 0.4.0 那条 + `src/deck/import.ts`，把 #1 的默认改掉、测试 `test/import.test.mjs` 加「音频 / 视频默认 ram、图片默认原样、宿主可覆盖」。
2. 视频卡先出一页短方案（两条逐帧路线的成本），user 点头再写卡。
