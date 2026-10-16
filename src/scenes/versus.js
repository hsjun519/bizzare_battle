// The pre-fight VS splash.
import { charById } from "../chars/index.js";
import { getStage } from "../render/stages.js";
import { VIEW_W, VIEW_H } from "../game/constants.js";
import { text, FONT, COLOR, slant, drawFighterAt } from "../render/ui.js";
import { P } from "../render/poses.js";
import { ease, clamp, rgba } from "../core/util.js";

export class VersusScene {
  constructor(app, setup, next) {
    this.app = app;
    this.setup = setup;
    this.next = next;
    this.t = 0;
    this.a = charById(setup.p1);
    this.b = charById(setup.p2);
  }

  enter() {
    this.app.audio.stopSong();
    this.app.audio.play("ui_lock");
    setTimeout(() => this.app.audio.play("announce"), 350);
  }

  update() {
    this.t++;
    const input = this.app.input;
    if ((this.t > 40 && (input.anyPressed || input.pointer.released)) || this.t > 200) this.next();
  }

  draw(view) {
    const ctx = view.ctx;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    const t = this.t;
    const u = ease.outCubic(clamp(t / 18, 0, 1));
    ctx.fillStyle = "#07050c";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // split halves
    ctx.save();
    ctx.translate(-(1 - u) * 700, 0);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(VIEW_W / 2 + 90, 0);
    ctx.lineTo(VIEW_W / 2 - 90, VIEW_H);
    ctx.lineTo(0, VIEW_H);
    ctx.closePath();
    let g = ctx.createLinearGradient(0, 0, VIEW_W / 2, 0);
    g.addColorStop(0, rgba(this.a.colorB || "#000000", 1));
    g.addColorStop(1, rgba(this.a.color, 0.75));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    this.lines(ctx, 1);
    drawFighterAt(ctx, this.a, 330 + t * 0.25, 860, 2.4, 1, { ...P.taunt, face: "angry" }, "angry", t);
    ctx.restore();
    ctx.save();
    ctx.translate((1 - u) * 700, 0);
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2 + 90, 0);
    ctx.lineTo(VIEW_W, 0);
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.lineTo(VIEW_W / 2 - 90, VIEW_H);
    ctx.closePath();
    g = ctx.createLinearGradient(VIEW_W / 2, 0, VIEW_W, 0);
    g.addColorStop(0, rgba(this.b.color, 0.75));
    g.addColorStop(1, rgba(this.b.colorB || "#000000", 1));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    this.lines(ctx, -1);
    drawFighterAt(ctx, this.b, VIEW_W - 330 - t * 0.25, 860, 2.4, -1, { ...P.taunt, face: "angry" }, "angry", t);
    ctx.restore();
    // divider lightning
    ctx.save();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 6;
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2 + 90, 0);
    for (let i = 1; i <= 10; i++) ctx.lineTo(VIEW_W / 2 + 90 - i * 18 + (i % 2 ? 14 : -14) * Math.sin(t * 0.5 + i), i * 72);
    ctx.stroke();
    ctx.restore();
    // names
    const nu = ease.outBack(clamp((t - 10) / 16, 0, 1));
    ctx.save();
    ctx.globalAlpha = clamp((t - 8) / 10, 0, 1);
    text(ctx, this.a.name, 60, 560 + (1 - nu) * 60, { size: 64, font: FONT.title, weight: 400, color: "#fff", stroke: COLOR.ink, sw: 10 });
    text(ctx, this.a.title, 64, 598 + (1 - nu) * 60, { size: 20, weight: 800, color: this.a.color, stroke: COLOR.ink, sw: 5 });
    text(ctx, `“${this.a.quote}”`, 64, 636, { size: 17, weight: 600, color: "#fff", stroke: COLOR.ink, sw: 4, maxW: 520 });
    text(ctx, this.b.name, VIEW_W - 60, 160 - (1 - nu) * 60, { size: 64, font: FONT.title, weight: 400, align: "right", color: "#fff", stroke: COLOR.ink, sw: 10 });
    text(ctx, this.b.title, VIEW_W - 64, 198 - (1 - nu) * 60, { size: 20, weight: 800, align: "right", color: this.b.color, stroke: COLOR.ink, sw: 5 });
    text(ctx, `“${this.b.quote}”`, VIEW_W - 64, 236, { size: 17, weight: 600, align: "right", color: "#fff", stroke: COLOR.ink, sw: 4, maxW: 520 });
    ctx.restore();
    // VS
    const vs = ease.outElastic(clamp((t - 14) / 30, 0, 1));
    ctx.save();
    ctx.translate(VIEW_W / 2, VIEW_H / 2);
    ctx.scale(vs * 1.1, vs * 1.1);
    ctx.rotate(-0.1);
    text(ctx, "VS", 0, 50, { size: 170, font: FONT.arcade, weight: 400, align: "center", color: COLOR.gold, stroke: COLOR.ink, sw: 16, shadow: "rgba(255,77,94,0.9)" });
    ctx.restore();
    // footer
    const st = getStage(this.setup.stage);
    const ar = this.setup.arcade;
    slant(ctx, VIEW_W / 2 - 230, VIEW_H - 64, 460, 40, 10, "rgba(7,5,12,0.85)");
    const label = ar ? `STAGE ${ar.index + 1} / ${ar.ladder.length}${this.setup.rival ? " · 숙명의 라이벌" : ""} · ${st.name}` : `${st.name} · ${st.en}`;
    text(ctx, label, VIEW_W / 2, VIEW_H - 36, { size: 18, weight: 900, align: "center", color: this.setup.rival ? "#ff5a6a" : COLOR.paper });
    if (this.setup.rival && t > 30) {
      text(ctx, "RIVAL MATCH", VIEW_W / 2, 120, { size: 40, font: FONT.arcade, weight: 400, align: "center", color: "#ff5a6a", stroke: COLOR.ink, sw: 8, alpha: Math.floor(t / 8) % 2 ? 1 : 0.6 });
    }
  }

  lines(ctx, dir) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    for (let i = 0; i < 26; i++) {
      const y = (i * 53 + this.t * 7) % VIEW_H;
      const x = ((i * 137 + this.t * 30 * dir) % (VIEW_W + 300)) - 150;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 140 * dir, y);
      ctx.stroke();
    }
    ctx.restore();
  }
}
