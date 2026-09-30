// 两段手势三角的数值测试。created 2026-09-29 by Claude Fable 5.1
import { describe, it, assert, eq } from "./runner.mjs";
import { pinchScaleRot, solveAnchorTranslation } from "../src/pointer-gesture.ts";

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

describe("pinchScaleRot", () => {
  const start = { dist: 100, angle: 0, vp: { scale: 2, rot: 0.5 } };
  it("两指距离翻倍 → 缩放翻倍，角度不变", () => {
    const r = pinchScaleRot(start, 200, 0, 0.01, 50);
    eq(r.scale, 4); eq(r.rot, 0.5);
  });
  it("缩放被夹在上下限之间", () => {
    eq(pinchScaleRot(start, 100000, 0, 0.01, 50).scale, 50);
    eq(pinchScaleRot(start, 0.0001, 0, 0.01, 50).scale, 0.01);
  });
  it("角度差跨过 ±π 时走近路", () => {
    const s = { dist: 100, angle: 3.0, vp: { scale: 1, rot: 0 } };
    const r = pinchScaleRot(s, 100, -3.0, 0.01, 50);   // 原始差 = -6，归一化后 ≈ +0.283
    assert(near(r.rot, -6 + 2 * Math.PI), `rot=${r.rot}`);
  });
});

describe("solveAnchorTranslation", () => {
  it("解出的平移让图上那一点正好落在指定屏幕点", () => {
    const pt = { x: 37, y: -12 }, scale = 1.7, rot = 0.9, sx = 210, sy = 95;
    const t = solveAnchorTranslation(pt, scale, rot, sx, sy);
    const c = Math.cos(rot), s = Math.sin(rot);
    const gotX = scale * (pt.x * c - pt.y * s) + t.tx;
    const gotY = scale * (pt.x * s + pt.y * c) + t.ty;
    assert(near(gotX, sx) && near(gotY, sy), `落点 (${gotX}, ${gotY})`);
  });
  it("不旋转不缩放时就是简单相减", () => {
    const t = solveAnchorTranslation({ x: 10, y: 20 }, 1, 0, 100, 100);
    eq(t.tx, 90); eq(t.ty, 80);
  });
});
