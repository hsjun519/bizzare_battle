// Canvas UI kit: typography, panels, buttons and character portraits.
import { drawRig } from "./rig.js";
import { P, ANIM } from "./poses.js";
import { rgba } from "../core/util.js";

export const FONT = {
  title: '"Black Han Sans", "Noto Sans KR", sans-serif',
  arcade: '"Bungee", "Black Han Sans", sans-serif',
  body: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
};

export const COLOR = {
  ink: "#16111d",
  paper: "#fff8ec",
  dim: "rgba(255,248,236,0.62)",
  gold: "#ffd45a",
  red: "#ff4d5e",
  cyan: "#5fe3ff",
  philosophy: "#8fd3ff",
  capital: "#ffd45a",
  panel: "rgba(16,11,26,0.82)",
};

export function text(ctx, str, x, y, { size = 24, font = FONT.body, weight = 700, color = COLOR.paper, align = "left", base = "alphabetic", stroke = null, sw = 6, alpha = 1, shadow = null, maxW = null, spacing = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  if (spacing && "letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.fillText(str, x + size * 0.06, y + size * 0.08, maxW || undefined);
  }
  if (stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = sw;
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y, maxW || undefined);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y, maxW || undefined);
  ctx.restore();
}

export function measure(ctx, str, size, font = FONT.body, weight = 700) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

// Word-wrapped text (Korean wraps per character when needed).
export function wrap(ctx, str, x, y, maxW, lh, opts = {}) {
  const size = opts.size || 18;
  ctx.save();
  ctx.font = `${opts.weight || 500} ${size}px ${opts.font || FONT.body}`;
  const words = str.split(" ");
  let lineStr = "";
  let yy = y;
  const lines = [];
  for (const w of words) {
    const test = lineStr ? lineStr + " " + w : w;
    if (ctx.measureText(test).width > maxW && lineStr) {
      lines.push(lineStr);
      lineStr = w;
    } else lineStr = test;
  }
  if (lineStr) lines.push(lineStr);
  ctx.restore();
  for (const l of lines) {
    text(ctx, l, x, yy, { ...opts, size, weight: opts.weight || 500 });
    yy += lh;
  }
  return yy;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  const rad = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function panel(ctx, x, y, w, h, { fill = COLOR.panel, stroke = "rgba(255,255,255,0.12)", r = 14, lw = 2, glow = null } = {}) {
  ctx.save();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 24;
  }
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  ctx.restore();
}

// Slanted fighting-game banner shape.
export function slant(ctx, x, y, w, h, skew, fill) {
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w + skew, y);
  ctx.lineTo(x + w - skew, y + h);
  ctx.lineTo(x - skew, y + h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function keycap(ctx, label, x, y, { size = 18, color = COLOR.paper, bg = "rgba(255,255,255,0.1)" } = {}) {
  ctx.save();
  ctx.font = `800 ${size}px ${FONT.body}`;
  const w = Math.max(size * 1.5, ctx.measureText(label).width + size * 0.9);
  const h = size * 1.55;
  roundRect(ctx, x, y - h * 0.72, w, h, 6);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y - h * 0.72 + h / 2 + 1);
  ctx.restore();
  return w;
}

// Button with hover / focus states. Returns true when the pointer clicked it.
export function button(ctx, app, { x, y, w, h, label, sub = null, focus = false, accent = COLOR.gold, size = 26, disabled = false }) {
  const p = app.input.pointer;
  const hover = !disabled && p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  const on = focus || hover;
  ctx.save();
  if (on) {
    slant(ctx, x - 6, y - 4, w + 12, h + 8, 10, accent);
    slant(ctx, x, y, w, h, 10, COLOR.ink);
  } else slant(ctx, x, y, w, h, 10, "rgba(255,255,255,0.08)");
  text(ctx, label, x + 28, y + h / 2 + (sub ? -2 : size * 0.36), { size, font: FONT.title, weight: 400, color: disabled ? "rgba(255,255,255,0.3)" : on ? accent : COLOR.paper });
  if (sub) text(ctx, sub, x + 30, y + h / 2 + 22, { size: 15, weight: 500, color: on ? COLOR.paper : COLOR.dim });
  ctx.restore();
  return hover && p.released && !disabled;
}

export function hit(app, x, y, w, h) {
  const p = app.input.pointer;
  return p.released && p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
}

export function hovering(app, x, y, w, h) {
  const p = app.input.pointer;
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
}

// Draw a fighter (full body) at a screen position, feet at (x, y).
export function drawFighterAt(ctx, char, x, y, scale, facing = 1, pose = null, face = null, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale * (char.scale || 1), scale * (char.scale || 1));
  const p = pose || ANIM.idle(t);
  drawRig(ctx, char.style, p, { face: face || p.face, t });
  ctx.restore();
}

// Head-and-shoulders portrait clipped into a box.
export function portrait(ctx, char, x, y, w, h, { facing = 1, face = "normal", bg = null, t = 0, zoom = 1 } = {}) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 10);
  ctx.clip();
  if (bg) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, bg);
    g.addColorStop(1, rgba("#000000", 0.6));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  const s = (h / 150) * zoom;
  const cs = char.scale || 1;
  drawFighterAt(ctx, char, x + w / 2 - facing * 14 * s, y + h * 0.47 + 190 * s * cs, s, facing, { ...P.stance, head: -4 }, face, t);
  ctx.restore();
}

export function bar(ctx, x, y, w, h, frac, color, back = "rgba(0,0,0,0.5)", r = 4) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = back;
  ctx.fill();
  if (frac > 0) {
    roundRect(ctx, x, y, Math.max(r * 2, w * frac), h, r);
    ctx.fillStyle = color;
    ctx.fill();
  }
}
