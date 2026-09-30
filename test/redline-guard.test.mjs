// 红线守卫：本库永不碰本地存储、永不联网；组件里不手画图标。
// created 2026-09-29 by Claude Fable 5.1
// 依据：家族 CLAUDE.md「云同步 store 库」节（持久化全走宿主的 store）+「黄线区」（外接服务白名单）；
//       图标 = WeebPaint 2026-08-30 user「svg 风格从 svg icons 取作 SSoT，不要在其他地方乱塞」。
// 只扫代码行：整行注释和行尾注释先剥掉，免得说明文字误伤。
import { describe, it, eq } from "./runner.mjs";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")            // 块注释
    .split("\n").map((l) => l.replace(/(^|[^:"'`])\/\/.*$/, "$1")).join("\n");   // 行注释（放过 "http://" 里的 //）
}

const FORBIDDEN = [
  [/\blocalStorage\b/, "localStorage"],
  [/\bsessionStorage\b/, "sessionStorage"],
  [/\bindexedDB\b/, "indexedDB"],
  [/\bfetch\s*\(/, "fetch("],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\bWebSocket\b/, "WebSocket"],
  [/\bEventSource\b/, "EventSource"],
  [/\bsendBeacon\b/, "sendBeacon"],
  [/\bSpeechRecognition\b/, "SpeechRecognition"],
];

describe("红线守卫", () => {
  const files = walk(SRC);
  it("src 里至少有文件可扫", () => { eq(files.length > 0, true); });
  for (const [re, word] of FORBIDDEN) {
    it(`代码行里不出现 ${word}`, () => {
      const hits = [];
      for (const f of files) {
        codeOnly(readFileSync(f, "utf-8")).split("\n").forEach((l, i) => { if (re.test(l)) hits.push(`${f.slice(SRC.length)}:${i + 1}`); });
      }
      eq(hits.join(", "), "", `${word} 出现在`);
    });
  }
  it("组件源码零自绘几何（只允许缺图标占位那一个 <rect>）", () => {
    let paths = 0, rects = 0;
    for (const f of files) {
      const src = readFileSync(f, "utf-8");
      paths += (src.match(/<path /g) || []).length;
      rects += (src.match(/<rect /g) || []).length;
    }
    eq(paths, 0, "不该有手写 <path>");
    eq(rects, 1, "只允许缺图标占位那一个 <rect>");
  });
});
