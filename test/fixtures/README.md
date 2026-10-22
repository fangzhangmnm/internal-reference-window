# 冻结样本

> created 2026-09-29 by Claude Fable 5.1

这里的文件是**已经发出去的格式**的样本。规矩：只增不改。清单编解码必须永远读得了它们。

| 文件 | 是什么 | 出处 |
|---|---|---|
| `weebpaint-format2-refpanels.json` | WeebPaint `.ora`（format 2）里 `.weebpaint/editor-state.json` 的 `refPanels` 那一段（清单 v1，没有 version 键）：图片、画布小窗、图片三张，当前看第三张。0.2.0 起宿主把它搬成 `manifest.json` 后本库直接读 | 形状取自 WeebPaint v0.14.20 `test/ora-references.test.mjs` 第一条测试（该测试用真实的 ora 编解码走了一遍往返） |
| `manifest-1.1.0.json` | 0.5.0 写出来的清单（拍子 1.1.0 = `version` 1 + `minor` 1 + `patch` 0）：图片、只放内存的音频（`ram`、`play`）、只放内存的视频（`play.fps`）、文字、画布小窗（`target`）、genai 来历的图片，当前看第三张。往返必须逐字节相同 | `test/manifest.test.mjs`「冻结样本 1.1.0」；由 `encodeDeck` 自己生成（2026-10-21，Claude Fable 5.1 lane 7） |
