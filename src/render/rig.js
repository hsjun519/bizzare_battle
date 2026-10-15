// Skeletal cartoon renderer. Every fighter shares one 2D rig driven by poses
// (hand / foot targets solved with two-bone IK) and adds its own costume and
// head painter on top. Coordinates: facing right, origin at the feet, y down.
import { deg, lerp, clamp } from "../core/util.js";

export const OUT = "#16111d";
export const RIG = {
  torso: 64,
  upper: 36,
  fore: 34,
  thigh: 46,
  shin: 46,
  headR: 42,
  neck: 10,
};

export const STANCE = {
  hip: [0, -86],
  lean: 6,
  head: 0,
  hF: [40, -140],
  hB: [24, -130],
  fF: [26, 0],
  fB: [-26, 0],
  eF: 1,
  eB: 1,
  rot: 0,
  sq: 1,
};

const VEC_KEYS = ["hip", "hF", "hB", "fF", "fB"];
const NUM_KEYS = ["lean", "head", "rot", "sq"];

export function pose(p) {
  return { ...STANCE, ...p };
}

export function lerpPose(a, b, t) {
  const o = { ...b };
  for (const k of VEC_KEYS) {
    const A = a[k] || STANCE[k];
    const B = b[k] || STANCE[k];
    o[k] = [lerp(A[0], B[0], t), lerp(A[1], B[1], t)];
  }
  for (const k of NUM_KEYS) o[k] = lerp(a[k] ?? STANCE[k], b[k] ?? STANCE[k], t);
  o.eF = t < 0.5 ? a.eF ?? 1 : b.eF ?? 1;
  o.eB = t < 0.5 ? a.eB ?? 1 : b.eB ?? 1;
  o.face = t < 0.5 ? a.face : b.face;
  o.prop = t < 0.5 ? a.prop : b.prop;
  o.strike = b.strike ?? a.strike;
  return o;
}

// keys: [[frame, pose, easing?], ...] -> function(t) returning a pose.
export function keyframes(keys) {
  const ks = keys.map(([f, p, e]) => [f, pose(p), e]);
  return (t) => {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) {
        const [f0, p0] = ks[i - 1];
        const [f1, p1, e] = ks[i];
        let u = (t - f0) / Math.max(1e-6, f1 - f0);
        if (e) u = e(u);
        return lerpPose(p0, p1, u);
      }
    }
    return ks[ks.length - 1][1];
  };
}

// Offset a pose (used to layer bobbing etc.)
export function shiftPose(p, dx, dy) {
  const o = { ...p };
  for (const k of VEC_KEYS) o[k] = [p[k][0] + dx, p[k][1] + dy];
  return o;
}

function ik(ax, ay, tx, ty, l1, l2, bend) {
  let dx = tx - ax;
  let dy = ty - ay;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.5;
  if (d > max) {
    tx = ax + (dx / d) * max;
    ty = ay + (dy / d) * max;
    dx = tx - ax;
    dy = ty - ay;
    d = max;
  }
  d = Math.max(d, Math.abs(l1 - l2) + 1);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const base = Math.atan2(dy, dx);
  const ang = base + bend * a;
  return { jx: ax + Math.cos(ang) * l1, jy: ay + Math.sin(ang) * l1, ex: tx, ey: ty };
}

// Solve joint positions for drawing and for hurtbox estimation.
export function solve(p) {
  const L = RIG;
  const a = deg(p.lean);
  const sx = Math.sin(a);
  const cy = Math.cos(a);
  const [px, py] = p.hip;
  const neck = [px + sx * L.torso, py - cy * L.torso];
  const sh = [px + sx * (L.torso - 8), py - cy * (L.torso - 8)];
  const shF = [sh[0] + cy * 5, sh[1] + sx * 5];
  const shB = [sh[0] - cy * 7, sh[1] - sx * 7];
  const hipF = [px + 5, py];
  const hipB = [px - 6, py];
  const ha = a * 0.6 + deg(p.head || 0);
  const head = [neck[0] + Math.sin(ha) * (L.headR - 4), neck[1] - Math.cos(ha) * (L.headR - 4)];
  const armF = ik(shF[0], shF[1], p.hF[0], p.hF[1], L.upper, L.fore, p.eF ?? 1);
  const armB = ik(shB[0], shB[1], p.hB[0], p.hB[1], L.upper, L.fore, p.eB ?? 1);
  const legF = ik(hipF[0], hipF[1], p.fF[0], p.fF[1], L.thigh, L.shin, -1);
  const legB = ik(hipB[0], hipB[1], p.fB[0], p.fB[1], L.thigh, L.shin, -1);
  return { pelvis: [px, py], neck, sh, shF, shB, hipF, hipB, head, headAngle: ha, torsoAngle: a, armF, armB, legF, legB };
}

// ---------------------------------------------------------------- painting
export function line(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

export function circle(ctx, x, y, r, fill, stroke = OUT, lw = 4) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function ellipse(ctx, x, y, rx, ry, rot, fill, stroke = OUT, lw = 4) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function shape(ctx, pts, fill, stroke = OUT, lw = 4, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.length === 4) ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else if (p.length === 6) ctx.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
    else ctx.lineTo(p[0], p[1]);
  }
  if (close) ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

// A two segment limb: outline pass for the whole chain, then colour passes.
function limb(ctx, a, j, e, w, c1, c2, capEnd = true) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w + 8;
  line(ctx, [a, j, e]);
  ctx.strokeStyle = c1;
  ctx.lineWidth = w;
  line(ctx, [a, j]);
  ctx.strokeStyle = c2;
  ctx.lineWidth = w * (capEnd ? 0.92 : 1);
  line(ctx, [j, e]);
  // re-cover the joint so the colours meet cleanly
  ctx.fillStyle = c1;
  ctx.beginPath();
  ctx.arc(j[0], j[1], w / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawArm(ctx, s, arm, sh, back, style, opts) {
  const dark = back ? style.shadeFactor ?? 0.22 : 0;
  const c1 = dk(style.sleeve, dark);
  const c2 = dk(style.forearm || style.sleeve, dark);
  const j = [arm.jx, arm.jy];
  const e = [arm.ex, arm.ey];
  limb(ctx, sh, j, e, style.armW || 17, c1, c2);
  if (style.cuff) {
    // cuff ring near the wrist
    const t = 0.78;
    const cx = lerp(j[0], e[0], t);
    const cy = lerp(j[1], e[1], t);
    ctx.strokeStyle = dk(style.cuff, dark);
    ctx.lineWidth = (style.armW || 17) + 1;
    const ang = Math.atan2(e[1] - j[1], e[0] - j[0]);
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(ang) * 3, cy - Math.sin(ang) * 3);
    ctx.lineTo(cx + Math.cos(ang) * 3, cy + Math.sin(ang) * 3);
    ctx.stroke();
  }
  // fist
  const fr = style.fist || 11;
  circle(ctx, e[0], e[1], fr, dk(style.hand || style.skin, dark), OUT, 4);
  const ang = Math.atan2(e[1] - j[1], e[0] - j[0]);
  ctx.strokeStyle = dk(style.skinShade, dark);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(e[0], e[1], fr * 0.55, ang - 0.9, ang + 0.9);
  ctx.stroke();
}

function drawLeg(ctx, leg, hip, back, style, p) {
  const dark = back ? style.shadeFactor ?? 0.22 : 0;
  const j = [leg.jx, leg.jy];
  const e = [leg.ex, leg.ey];
  limb(ctx, hip, j, e, style.legW || 21, dk(style.thigh || style.pants, dark), dk(style.shin || style.pants, dark));
  // foot / shoe
  const shinAng = Math.atan2(e[1] - j[1], e[0] - j[0]);
  const fa = clamp((shinAng - Math.PI / 2) * 0.75, -1.2, 1.2);
  ctx.save();
  ctx.translate(e[0], e[1]);
  ctx.rotate(fa);
  const col = dk(style.shoe, dark);
  if (style.sandal) {
    shape(ctx, [[-9, -6], [16, -6], [22, 0], [20, 5], [-11, 5], [-12, 0]], dk(style.skin, dark));
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    line(ctx, [[-6, -6], [-2, 4]]);
    line(ctx, [[6, -6], [8, 4]]);
    ctx.fillStyle = col;
    ctx.fillRect(-12, 3, 34, 4);
  } else if (style.barefoot) {
    shape(ctx, [[-8, -7], [14, -6], [22, 1], [18, 6], [-10, 6], [-12, 0]], dk(style.skin, dark));
  } else {
    shape(ctx, [[-10, -9], [10, -9], [24, -2], [25, 5], [-12, 6], [-13, -2]], col);
    ctx.fillStyle = dk(style.sole || "#2a2522", dark);
    ctx.fillRect(-12, 3, 37, 3);
  }
  ctx.restore();
}

function dk(c, t) {
  if (!t || !c) return c;
  return shadeCache(c, t);
}
const _shadeCache = new Map();
function shadeCache(c, t) {
  const k = c + t;
  let v = _shadeCache.get(k);
  if (!v) {
    const n = parseInt(c.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * (1 - t) + 22 * t);
    const g = Math.round(((n >> 8) & 255) * (1 - t) + 14 * t);
    const b = Math.round((n & 255) * (1 - t) + 40 * t);
    v = "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
    _shadeCache.set(k, v);
  }
  return v;
}
export { dk as darken };

// Torso: a soft bean. Custom painters receive a local frame where
// origin = pelvis, +y up the spine (negative), +x forward.
function drawTorso(ctx, J, style, p, opts) {
  const L = RIG;
  const w = style.torsoW || 52;
  ctx.save();
  ctx.translate(J.pelvis[0], J.pelvis[1]);
  ctx.rotate(J.torsoAngle);
  const top = -L.torso - 6;
  const pts = [
    [-w * 0.42, 6],
    [-w * 0.5, -20, -w * 0.52, top + 18],
    [-w * 0.5, top, -w * 0.1, top],
    [w * 0.12, top - 2, w * 0.42, top + 6],
    [w * 0.56, top + 20, w * 0.5, -18],
    [w * 0.48, 4, w * 0.36, 8],
  ];
  if (style.torsoBack) style.torsoBack(ctx, w, top, p, opts);
  shape(ctx, pts, style.top, OUT, 5);
  if (style.torso) style.torso(ctx, w, top, p, opts);
  ctx.restore();
}

function drawNeck(ctx, J, style) {
  ctx.lineCap = "round";
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 24;
  line(ctx, [J.neck, [lerp(J.neck[0], J.head[0], 0.5), lerp(J.neck[1], J.head[1], 0.5)]]);
  ctx.strokeStyle = style.skinShade;
  ctx.lineWidth = 16;
  line(ctx, [J.neck, [lerp(J.neck[0], J.head[0], 0.5), lerp(J.neck[1], J.head[1], 0.5)]]);
}

function drawHead(ctx, J, style, p, opts) {
  ctx.save();
  ctx.translate(J.head[0], J.head[1]);
  ctx.rotate(J.headAngle);
  if (opts.headScale && opts.headScale !== 1) {
    ctx.translate(0, RIG.headR * 0.6);
    ctx.scale(opts.headScale, opts.headScale);
    ctx.translate(0, -RIG.headR * 0.6);
  }
  style.head(ctx, RIG.headR, opts.face || p.face || "normal", opts);
  ctx.restore();
}

// Main entry: draws a fighter in local space (caller handles position/facing).
export function drawRig(ctx, style, p, opts = {}) {
  const J = solve(p);
  ctx.save();
  if (p.rot) {
    ctx.translate(0, -100);
    ctx.rotate(deg(p.rot));
    ctx.translate(0, 100);
  }
  if (p.sq && p.sq !== 1) ctx.scale(2 - p.sq, p.sq);
  if (style.behind) style.behind(ctx, J, p, opts);
  drawArm(ctx, J, J.armB, J.shB, true, style, opts);
  if (style.propBack) style.propBack(ctx, J, p, opts);
  drawLeg(ctx, J.legB, J.hipB, true, style, p);
  if (style.skirtBack) style.skirtBack(ctx, J, p, opts);
  drawLeg(ctx, J.legF, J.hipF, false, style, p);
  drawNeck(ctx, J, style);
  drawTorso(ctx, J, style, p, opts);
  if (style.overLegs) style.overLegs(ctx, J, p, opts);
  drawHead(ctx, J, style, p, opts);
  drawArm(ctx, J, J.armF, J.shF, false, style, opts);
  if (style.propFront) style.propFront(ctx, J, p, opts);
  ctx.restore();
  return J;
}

// ------------------------------------------------------------ face helpers
// Shared expressive eyes and mouths so every caricature emotes the same way.
export function eyes(ctx, face, ex1, ex2, ey, opts = {}) {
  const size = opts.size || 1;
  const col = opts.color || OUT;
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineCap = "round";
  if (face === "ko") {
    ctx.lineWidth = 3.5;
    for (const x of [ex1, ex2]) {
      line(ctx, [[x - 5, ey - 5], [x + 5, ey + 5]]);
      line(ctx, [[x + 5, ey - 5], [x - 5, ey + 5]]);
    }
    return;
  }
  if (face === "hurt") {
    ctx.lineWidth = 3.5;
    line(ctx, [[ex1 - 6, ey - 5], [ex1 + 3, ey], [ex1 - 6, ey + 4]]);
    line(ctx, [[ex2 + 5, ey - 5], [ex2 - 3, ey], [ex2 + 5, ey + 4]]);
    return;
  }
  if (face === "happy") {
    ctx.lineWidth = 3.5;
    for (const x of [ex1, ex2]) {
      ctx.beginPath();
      ctx.arc(x, ey + 2, 5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    return;
  }
  const h = face === "angry" || face === "block" ? 4.5 : 6;
  for (const [x, s] of [[ex1, 1], [ex2, 0.85]]) {
    ctx.beginPath();
    ctx.ellipse(x, ey, 3.4 * size * s, h * size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x + 1, ey - 2, 1.3 * size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
  }
}

export function brows(ctx, face, ex1, ex2, ey, color, thick = 4, lift = 0) {
  ctx.strokeStyle = color;
  ctx.lineWidth = thick;
  ctx.lineCap = "round";
  const y = ey - 10 - lift;
  if (face === "angry" || face === "block") {
    line(ctx, [[ex1 - 7, y - 4], [ex1 + 6, y + 2]]);
    line(ctx, [[ex2 - 5, y + 2], [ex2 + 7, y - 3]]);
  } else if (face === "hurt" || face === "ko") {
    line(ctx, [[ex1 - 7, y + 2], [ex1 + 6, y - 4]]);
    line(ctx, [[ex2 - 5, y - 4], [ex2 + 7, y + 1]]);
  } else {
    line(ctx, [[ex1 - 6, y - 1], [ex1 + 6, y - 2]]);
    line(ctx, [[ex2 - 5, y - 2], [ex2 + 6, y - 1]]);
  }
}

export function mouth(ctx, face, x, y, opts = {}) {
  const w = opts.w || 12;
  ctx.lineCap = "round";
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.5;
  if (face === "angry" || face === "hurt" || face === "ko") {
    const h = face === "hurt" ? 9 : face === "ko" ? 7 : 8;
    shape(ctx, [[x - w * 0.6, y - 2], [x + w * 0.6, y - 3], [x + w * 0.4, y + h], [x - w * 0.4, y + h]], "#5a1e24", OUT, 3);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - w * 0.45, y - 2, w * 0.9, 3);
    if (face !== "ko") {
      ctx.fillStyle = "#e0607a";
      ctx.fillRect(x - w * 0.2, y + h - 3, w * 0.4, 2);
    }
  } else if (face === "block") {
    ctx.fillStyle = "#ffffff";
    shape(ctx, [[x - w * 0.5, y - 2], [x + w * 0.5, y - 2], [x + w * 0.5, y + 3], [x - w * 0.5, y + 3]], "#ffffff", OUT, 2.5);
    line(ctx, [[x - w * 0.5, y + 0.5], [x + w * 0.5, y + 0.5]]);
  } else if (face === "happy") {
    shape(ctx, [[x - w * 0.6, y - 2], [x + w * 0.6, y - 2], [x, y + 9, x - w * 0.6, y - 2]], "#5a1e24", OUT, 3);
  } else if (opts.smile) {
    ctx.beginPath();
    ctx.arc(x, y - 6, w * 0.6, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  } else {
    line(ctx, [[x - w * 0.4, y], [x + w * 0.4, y - 1]]);
  }
}

export function rr(ctx, x, y, w, h, r, fill, stroke = OUT, lw = 4) {
  ctx.beginPath();
  const rad = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

// Point along the forearm beyond the fist, for held props.
export function handFrame(arm) {
  const ang = Math.atan2(arm.ey - arm.jy, arm.ex - arm.jx);
  return { x: arm.ex, y: arm.ey, ang };
}

// A soft cheek blush for warmth.
export function blush(ctx, x, y, color = "rgba(255,110,110,0.28)") {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function ear(ctx, x, y, skin, shadeC) {
  ellipse(ctx, x, y, 7, 10, 0, skin, OUT, 3.5);
  ctx.strokeStyle = shadeC;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 4, -1.2, 1.4);
  ctx.stroke();
}

// Basic head blob; returns nothing, painters add features.
export function headBase(ctx, R, skin, shadeC, opts = {}) {
  const rx = R * (opts.wide || 0.96);
  const ry = R * (opts.tall || 1);
  ellipse(ctx, 0, 0, rx, ry, 0, skin, OUT, 5);
  // jaw shade
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx - 2.5, ry - 2.5, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = shadeC;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(-R * 0.55, R * 0.25, R * 0.7, R * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function nose(ctx, x, y, size = 1, skin, shadeC) {
  shape(ctx, [[x - 2, y - 10 * size], [x + 8 * size, y + 2 * size, x + 2, y + 5 * size], [x - 3, y + 5 * size]], skin, OUT, 3, false);
  ctx.fillStyle = shadeC;
  ctx.beginPath();
  ctx.arc(x + 1, y + 3 * size, 2, 0, Math.PI * 2);
  ctx.fill();
}
