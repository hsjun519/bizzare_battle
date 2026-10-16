// Shared building blocks for character kits: projectile spawning,
// casting animations and a few costume painters.
import { keyframes, shape, OUT, darken } from "../render/rig.js";
import { P } from "../render/poses.js";
import { ease, lerp } from "../core/util.js";

export { hit } from "../game/moves.js";

// A wind-up -> release -> recover animation for thrown projectiles.
export function castAnim(release, total, { wind = P.castWind, throwPose = P.cast, hold = 8 } = {}) {
  return keyframes([
    [0, P.stance],
    [Math.max(2, release - 6), wind, ease.outQuad],
    [release, throwPose, ease.outCubic],
    [release + hold, throwPose],
    [total, P.stance, ease.inOut],
  ]);
}

export function spot(f, dx, dy) {
  return { x: f.x + f.facing * dx, y: f.y + dy };
}

export function shoot(f, b, spec) {
  const { x, y } = spot(f, spec.dx ?? 80, spec.dy ?? 140);
  const speed = spec.speed ?? 8;
  return b.spawn({ owner: f, x, y, vx: speed * f.facing, dir: f.facing, ...spec });
}

// Soft additive glow.
export function glow(ctx, x, y, r, color, alpha = 0.55) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Text drawn in world space that never mirrors.
export function worldText(ctx, text, x, y, size, fill, stroke = OUT, align = "center") {
  ctx.save();
  ctx.font = `900 ${size}px "Black Han Sans", "Bungee", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size / 5);
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Robe / toga skirt that follows the knees so kicks lift the hem.
export function skirt(ctx, J, color, hem, { len = 1, back = false, ragged = false } = {}) {
  const [px, py] = J.pelvis;
  const kf = [J.legF.jx, J.legF.jy];
  const kb = [J.legB.jx, J.legB.jy];
  const fx = lerp(px, kf[0], len) + 14;
  const fy = lerp(py, kf[1], len) + 8;
  const bx = lerp(px, kb[0], len) - 14;
  const by = lerp(py, kb[1], len) + 8;
  const pts = [[px - 26, py - 14], [px + 24, py - 14], [fx, fy]];
  if (ragged) {
    const n = 5;
    for (let i = 1; i < n; i++) {
      const u = i / n;
      pts.push([lerp(fx, bx, u), lerp(fy, by, u) + (i % 2 ? 9 : -2)]);
    }
  } else {
    pts.push([lerp(fx, bx, 0.5), Math.max(fy, by) + 6, bx, by]);
  }
  pts.push([bx, by]);
  shape(ctx, pts, back ? darken(color, 0.2) : color, OUT, 4);
  if (hem) {
    ctx.strokeStyle = hem;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(fx - 2, fy - 4);
    if (ragged) ctx.lineTo(bx + 2, by - 4);
    else ctx.quadraticCurveTo(lerp(fx, bx, 0.5), Math.max(fy, by) + 1, bx + 2, by - 4);
    ctx.stroke();
  }
}

// Coat tails flapping behind the hips.
export function coatTails(ctx, J, color, t = 0) {
  const [px, py] = J.pelvis;
  const sway = Math.sin(t * 0.15) * 3;
  shape(ctx, [[px - 22, py - 20], [px - 4, py - 4], [px - 10, py + 46], [px - 34 + sway, py + 52], [px - 30, py + 10]], darken(color, 0.12), OUT, 4);
}

// Wobbly speech-bubble outline used by several philosophers.
export function bubble(ctx, x, y, w, h, fill, stroke = OUT, tail = 1) {
  ctx.beginPath();
  const r = Math.min(w, h) * 0.45;
  ctx.moveTo(x - w / 2 + r, y - h / 2);
  ctx.arcTo(x + w / 2, y - h / 2, x + w / 2, y + h / 2, r);
  ctx.arcTo(x + w / 2, y + h / 2, x - w / 2, y + h / 2, r);
  ctx.lineTo(x - w * 0.1 * tail, y + h / 2);
  ctx.lineTo(x - w * 0.35 * tail, y + h / 2 + 14);
  ctx.lineTo(x - w * 0.25 * tail, y + h / 2);
  ctx.arcTo(x - w / 2, y + h / 2, x - w / 2, y - h / 2, r);
  ctx.arcTo(x - w / 2, y - h / 2, x + w / 2, y - h / 2, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

// Common projectile death burst.
export function burst(b, p, color, n = 8) {
  b.fx.ring(p.x, p.y, color, 6, 12, 5);
  b.fx.debris(p.x, p.y, n, { color, g: 0.25, life: 22, size: 6, floor: false, speed: 5 });
}

// Forward velocity profile for dashing specials.
export const dashProfile = (from, to, speed, decayTo = 0) => (t) => {
  if (t < from) return { vx: 0 };
  if (t < to) return { vx: speed };
  return { vx: decayTo };
};
