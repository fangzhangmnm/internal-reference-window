// 参考窗用到的两段手势三角（纯函数：给数字 → 出数字，无 DOM）。
// created 2026-09-29 by Claude Fable 5.1
//
// 源 = WeebPaint src/common/pointer-gesture.ts（v0.14.20）的两个共享 kernel，逐字抄入、不改语义。
// WeebPaint 那份还要给主画布的输入用，所以留在原处；两份之间的漂移由 WeebPaint 侧的对拍测试守着
// （同一组输入喂两边，输出必须逐位相同）。改这里的数学 = 两边一起改。

export interface Vec2 { x: number; y: number; }
export interface GestureViewport { tx: number; ty: number; scale: number; rot: number; }

// pinchScaleRot 只需起手的 dist/angle + vp 的 scale/rot（结构子集）。
interface ScaleRotStart { dist: number; angle: number; vp: { scale: number; rot: number }; }

// 双指 scale+rot 增量。
//   start = { dist, angle, vp:{scale,rot} }（caller 拍的起手快照；mid/坐标系各自管）
//   dist/angle = 当前两指的连线长度/角度
//   → { scale（已夹 [minScale,maxScale]）, rot（已把角度差归一化到 [-π,π] 再叠加）}
export function pinchScaleRot(start: ScaleRotStart, dist: number, angle: number, minScale: number, maxScale: number): { scale: number; rot: number } {
  const scale = Math.max(minScale, Math.min(maxScale, start.vp.scale * (dist / start.dist)));
  let dRot = angle - start.angle;
  if (dRot > Math.PI) dRot -= 2 * Math.PI;
  if (dRot < -Math.PI) dRot += 2 * Math.PI;
  return { scale, rot: start.vp.rot + dRot };
}

// anchor-preserving 平移解（origin-affine：screen = scale·R(rot)·model + (tx,ty)）：
// 求 (tx,ty) 让固定的 model 点落到屏幕 (screenX, screenY)。
export function solveAnchorTranslation(modelPt: Vec2, scale: number, rot: number, screenX: number, screenY: number): { tx: number; ty: number } {
  const c = Math.cos(rot), s = Math.sin(rot);
  return {
    tx: screenX - (modelPt.x * scale * c - modelPt.y * scale * s),
    ty: screenY - (modelPt.x * scale * s + modelPt.y * scale * c),
  };
}
