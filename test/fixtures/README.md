# 冻结样本

> created 2026-09-29 by Claude Fable 5.1

这里的文件是**已经发出去的格式**的样本。规矩：只增不改。清单编解码必须永远读得了它们。

| 文件 | 是什么 | 出处 |
|---|---|---|
| `weebpaint-format2-refpanels.json` | WeebPaint `.ora`（format 2）里 `.weebpaint/editor-state.json` 的 `refPanels` 那一段（清单 v1，没有 version 键）：图片、画布小窗、图片三张，当前看第三张。0.2.0 起宿主把它搬成 `manifest.json` 后本库直接读 | 形状取自 WeebPaint v0.14.20 `test/ora-references.test.mjs` 第一条测试（该测试用真实的 ora 编解码走了一遍往返） |
