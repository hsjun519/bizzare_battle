// Draws a Battle: stage, shadows, fighters, projectiles, particles and the
// cinematic overlays (super flash, paradigm cards, screen flashes).
import { FighterSprite } from "./sprite.js";
import { GROUND_Y, VIEW_W, VIEW_H } from "../game/constants.js";
import { getStage } from "./stages.js";
import { rgba } from "../core/util.js";

export class BattleRenderer {
  constructor() {
    this.sprites = [new FighterSprite(), new FighterSprite()];
    this.showBoxes = false;
  }

  // view: { ctx, scale (device px per logical px), ox, oy }
  worldTransform(view, cam) {
    const s = view.scale * cam.zoom;
    view.ctx.setTransform(s, 0, 0, s, view.ox + view.scale * (VIEW_W / 2 - cam.x * cam.zoom + cam.sx), view.oy + view.scale * (GROUND_Y + cam.y * cam.zoom + cam.sy));
  }

  screenTransform(view) {
    view.ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  }

  draw(view, b, t) {
    const ctx = view.ctx;
    const cam = b.camera;
    const stage = getStage(b.stage);
    const rule = b.rule;
    const cave = rule?.cave;
    const wallShadows = cave || stage.wallShadows;
    // ------------------------------------------------ background
    this.screenTransform(view);
    stage.drawBack(ctx, cam, t, view, b);
    // ------------------------------------------------ world
    this.worldTransform(view, cam);
    stage.drawFloor?.(ctx, cam, t, b);
    // Fighter buffers are capped so 4K / retina screens stay fast.
    const res = Math.min(1.6, view.scale * cam.zoom);
    const order = b.fighters.slice().sort((a, c) => (a.state === "attack" || a.state === "throwing" ? 1 : 0) - (c.state === "attack" || c.state === "throwing" ? 1 : 0));
    for (const f of b.fighters) this.paintFighter(f, b, res);
    // shadows
    for (const f of b.fighters) {
      if (f.hidden && !f.char.drawHidden) continue;
      const h = Math.max(0, f.y);
      const w = Math.max(30, 90 - h * 0.15) * (f.char.scale || 1);
      ctx.fillStyle = cave ? "rgba(0,0,0,0.6)" : "rgba(10,6,20,0.35)";
      ctx.beginPath();
      ctx.ellipse(f.x, 2, w, w * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (wallShadows) this.drawCaveShadows(view, b, t, cave ? 0.55 : 0.22);
    b.fx.draw(ctx, false);
    for (const p of b.projectiles) if (p.behind) p.draw?.(ctx, p, b);
    for (const f of order) this.drawFighter(ctx, f, b, cave);
    for (const p of b.projectiles) if (!p.behind) p.draw?.(ctx, p, b);
    b.fx.draw(ctx, true);
    if (this.showBoxes) this.drawBoxes(ctx, b);
    // ------------------------------------------------ foreground + overlays
    this.screenTransform(view);
    stage.drawFront?.(ctx, cam, t, view, b);
    if (cave) {
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.6, 120, VIEW_W / 2, VIEW_H * 0.6, 760);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (b.freeze > 0 && b.superInfo) this.drawSuperDim(ctx, b);
    if (b.screenFlash) {
      const fl = b.screenFlash;
      ctx.fillStyle = rgba(fl.color, (fl.life / fl.max) * fl.alpha);
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  paintFighter(f, b, res) {
    const sp = this.sprites[f.side];
    sp.ensure(res);
    sp.ageTrail();
    if (f.hidden || f.altDraw) return;
    const c = f.char;
    const style = c.getStyle ? c.getStyle(f) : c.style;
    const pose = f.getPose();
    const opts = { fighter: f, face: pose.face, t: b.realFrame, headScale: b.rule?.bigHead || 1 };
    sp.paint(style, pose, opts, f.facing, c.scale || 1);
    if (f.flash > 0) sp.flash(f.flash > 2 ? "rgba(255,255,255,0.92)" : "rgba(255,240,200,0.6)");
    const fast = f.trail > 0 || (f.state === "dash" && f.dashDir > 0) || f.stolenAura > 0 || (f.state === "attack" && f.move.trail);
    if (fast && b.realFrame % 2 === 0) sp.snapshot(f.x, f.y, f.stolenAura > 0 && f.stolenFrom ? f.stolenFrom.color : c.color, 12);
  }

  drawFighter(ctx, f, b, cave) {
    const sp = this.sprites[f.side];
    sp.drawTrail(ctx);
    if (f.hidden) {
      f.char.drawHidden?.(ctx, f, b);
      return;
    }
    if (f.altDraw) {
      f.char.drawAlt?.[f.altDraw]?.(ctx, f, b);
      return;
    }
    const shake = f.shake > 0 && b.hitstop > 0 ? (b.realFrame % 2 ? 4 : -4) : 0;
    const x = f.x + shake;
    // auras: buffs, stolen moves, low-health rage
    const auraColor = f.buff ? f.buff.color || f.char.color : f.stolenAura > 0 && f.stolenFrom ? f.stolenFrom.color : f.char.hooks?.aura?.(f) || (f.stolen ? f.stolen.char.color : null);
    if (auraColor) {
      const strong = f.buff || f.stolenAura > 0;
      const tint = sp.makeTint(auraColor);
      const pulse = 0.35 + Math.sin(b.realFrame * 0.25) * 0.15;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      sp.draw(ctx, x, f.y, strong ? pulse + 0.2 : pulse * 0.5, tint, strong ? 1.07 : 1.035);
      ctx.restore();
    }
    if (cave) {
      sp.draw(ctx, x, f.y, f.alpha, sp.makeTint("#0b0710"));
      return;
    }
    sp.draw(ctx, x, f.y, f.alpha);
  }

  drawCaveShadows(view, b, t, alpha) {
    const ctx = view.ctx;
    const fireX = b.camera.x;
    for (const f of b.fighters) {
      if (f.hidden || f.altDraw) continue;
      const sp = this.sprites[f.side];
      const tint = sp.makeTint("#05020a");
      ctx.save();
      const flick = 1 + Math.sin(t * 0.3 + f.side) * 0.03;
      const sx = f.x + (f.x - fireX) * 0.5;
      ctx.translate(sx, -150 - f.y * 1.4);
      ctx.scale(1.7 * flick, 1.7 * flick);
      sp.draw(ctx, 0, 0, alpha, tint);
      ctx.restore();
    }
  }

  drawSuperDim(ctx, b) {
    const s = b.superInfo;
    const u = Math.min(1, s.t / 8);
    ctx.fillStyle = `rgba(6,4,14,${0.55 * u})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawBoxes(ctx, b) {
    ctx.lineWidth = 2;
    for (const f of b.fighters) {
      ctx.strokeStyle = "rgba(80,160,255,0.9)";
      for (const h of f.hurtboxes()) ctx.strokeRect(h.x, -h.y - h.h, h.w, h.h);
      if (f.state === "attack") {
        f.move.hits.forEach((h) => {
          if (!h.box || h.proj) return;
          const active = f.mt >= h.at[0] && f.mt < h.at[1];
          const wb = f.worldBox(h.box);
          ctx.strokeStyle = active ? "rgba(255,60,60,0.95)" : "rgba(255,160,60,0.25)";
          ctx.strokeRect(wb.x, -wb.y - wb.h, wb.w, wb.h);
        });
      }
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.moveTo(f.x, 0);
      ctx.lineTo(f.x, -20);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,80,200,0.9)";
    for (const p of b.projectiles) ctx.strokeRect(p.x - p.w / 2, -p.y - p.h / 2, p.w, p.h);
  }
}
