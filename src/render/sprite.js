// Fighters are painted into their own offscreen buffer every frame. That lets
// us flash them white on hit, cast silhouettes and leave tinted afterimages
// without touching the vector painters.
import { drawRig } from "./rig.js";

const BW = 680;
const BH = 620;
const OX = BW / 2;
const OY = 520;

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export class FighterSprite {
  constructor() {
    this.res = 0;
    this.buf = null;
    this.tint = null;
    this.trail = [];
    this.pool = [];
  }

  ensure(res) {
    if (this.buf && Math.abs(res - this.res) / this.res < 0.08) return;
    this.res = res;
    const w = Math.ceil(BW * res);
    const h = Math.ceil(BH * res);
    this.buf = makeCanvas(w, h);
    this.tint = makeCanvas(w, h);
    this.bctx = this.buf.getContext("2d");
    this.tctx = this.tint.getContext("2d");
    this.pool = [];
    this.trail = [];
  }

  // Paint the rig into the buffer.
  paint(style, pose, opts, facing, scale) {
    const c = this.bctx;
    const r = this.res;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.buf.width, this.buf.height);
    c.setTransform(r, 0, 0, r, 0, 0);
    c.translate(OX, OY);
    c.scale(facing * scale, scale);
    drawRig(c, style, pose, opts);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  flash(color = "rgba(255,255,255,0.9)") {
    const c = this.bctx;
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = color;
    c.fillRect(0, 0, this.buf.width, this.buf.height);
    c.globalCompositeOperation = "source-over";
  }

  // Build a flat-coloured copy (silhouette) in the tint buffer.
  makeTint(color) {
    const c = this.tctx;
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, this.tint.width, this.tint.height);
    c.drawImage(this.buf, 0, 0);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = color;
    c.fillRect(0, 0, this.tint.width, this.tint.height);
    c.globalCompositeOperation = "source-over";
    return this.tint;
  }

  snapshot(x, y, color, life = 14) {
    let cv = this.pool.pop();
    if (!cv) cv = makeCanvas(this.buf.width, this.buf.height);
    const c = cv.getContext("2d");
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(this.buf, 0, 0);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = color;
    c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = "source-over";
    this.trail.push({ cv, x, y, life, max: life });
    if (this.trail.length > 6) this.pool.push(this.trail.shift().cv);
  }

  ageTrail() {
    for (const t of this.trail) t.life--;
    while (this.trail.length && this.trail[0].life <= 0) this.pool.push(this.trail.shift().cv);
  }

  drawTrail(ctx) {
    for (const t of this.trail) {
      ctx.globalAlpha = (t.life / t.max) * 0.45;
      ctx.drawImage(t.cv, t.x - OX, -t.y - OY, BW, BH);
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx, x, y, alpha = 1, img = this.buf, grow = 1) {
    ctx.globalAlpha = alpha;
    if (grow !== 1) {
      const w = BW * grow;
      const h = BH * grow;
      ctx.drawImage(img, x - OX * grow, -y - OY * grow - (grow - 1) * -OY * 0, w, h);
    } else ctx.drawImage(img, x - OX, -y - OY, BW, BH);
    ctx.globalAlpha = 1;
  }
}

export const SPRITE_BOX = { BW, BH, OX, OY };
