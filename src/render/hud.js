// Fight HUD: health, timer, meters, combos, steal cards, paradigm cards,
// announcer text and the super cut-in.
import { VIEW_W, VIEW_H, SUPER_COST } from "../game/constants.js";
import { text, FONT, COLOR, roundRect, slant, portrait, drawFighterAt } from "./ui.js";
import { rgba, ease, clamp } from "../core/util.js";
import { P } from "./poses.js";

export class HUD {
  constructor() {
    this.trail = [1, 1];
    this.combo = [null, null];
    this.announce = [];
    this.t = 0;
    this.meterFlash = [0, 0];
    this.lockPing = [0, 0];
    this.notice = [];
  }

  onEvent(e, b) {
    switch (e.type) {
      case "hit":
        this.combo[e.side] = { n: e.combo, dmg: e.comboDmg, t: 0, counter: e.counter };
        break;
      case "announce":
        this.announce.push({ text: e.text, kind: e.kind, t: -(e.delay || 0) });
        break;
      case "meterFull":
        this.meterFlash[e.side] = 40;
        break;
      case "locked":
        this.lockPing[e.side] = 30;
        break;
      case "steal":
        this.notice.push({ side: e.side, text: `${e.name} 획득! ↑+기술로 사용`, t: 0 });
        break;
      case "stolenExpire":
        this.notice.push({ side: e.side, text: `${e.name} 반환됨`, t: 0 });
        break;
      case "roundStart":
        this.combo = [null, null];
        break;
    }
  }

  update(b) {
    this.t++;
    b.fighters.forEach((f, i) => {
      const frac = f.health / f.maxHealth;
      if (this.trail[i] < frac) this.trail[i] = frac;
      else if (f.state !== "hitstun" && f.state !== "airhit" && f.state !== "thrown") this.trail[i] = Math.max(frac, this.trail[i] - 0.006);
      const c = this.combo[i];
      if (c) {
        c.t++;
        if (c.t > 90) this.combo[i] = null;
      }
      if (this.meterFlash[i] > 0) this.meterFlash[i]--;
      if (this.lockPing[i] > 0) this.lockPing[i]--;
    });
    for (const a of this.announce) a.t++;
    this.announce = this.announce.filter((a) => a.t < 90);
    for (const n of this.notice) n.t++;
    this.notice = this.notice.filter((n) => n.t < 150);
  }

  draw(ctx, b, opts = {}) {
    const [a, c] = b.fighters;
    this.drawBars(ctx, b, a, 0);
    this.drawBars(ctx, b, c, 1);
    this.drawTimer(ctx, b);
    this.drawMeter(ctx, b, a, 0);
    this.drawMeter(ctx, b, c, 1);
    this.drawCombos(ctx, b);
    this.drawNotices(ctx, b);
    if (b.rule) this.drawRuleBadge(ctx, b);
    if (b.superInfo && b.superInfo.t < 60) this.drawCutIn(ctx, b);
    if (b.ruleCard && b.ruleCard.t < 112) this.drawRuleCard(ctx, b);
    this.drawAnnounce(ctx);
    if (opts.training) this.drawTraining(ctx, b, opts);
  }

  // ------------------------------------------------------------ health
  drawBars(ctx, b, f, side) {
    const W = 470;
    const H = 30;
    const y = 34;
    const x0 = side === 0 ? 120 : VIEW_W - 120 - W;
    const frac = f.health / f.maxHealth;
    const low = frac < 0.25;
    ctx.save();
    // frame
    ctx.save();
    if (side === 1) {
      ctx.translate(VIEW_W, 0);
      ctx.scale(-1, 1);
    }
    const bx = 120;
    slant(ctx, bx - 8, y - 6, W + 16, H + 12, 10, "rgba(10,6,18,0.85)");
    slant(ctx, bx, y, W, H, 8, "#2a1a24");
    // damage trail
    const tw = W * this.trail[side];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bx + 8, y);
    ctx.lineTo(bx + W + 8, y);
    ctx.lineTo(bx + W - 8, y + H);
    ctx.lineTo(bx - 8, y + H);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = "#ff3048";
    ctx.fillRect(bx + W - tw - 8, y, tw + 16, H);
    const hw = W * frac;
    const g = ctx.createLinearGradient(0, y, 0, y + H);
    if (low && Math.floor(this.t / 8) % 2) {
      g.addColorStop(0, "#ffb0b0");
      g.addColorStop(1, "#ff4040");
    } else {
      g.addColorStop(0, "#fff38a");
      g.addColorStop(0.5, "#ffd23a");
      g.addColorStop(1, "#ff9a1a");
    }
    ctx.fillStyle = g;
    ctx.fillRect(bx + W - hw - 8, y, hw + 16, H);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(bx + W - hw - 8, y + 3, hw + 16, 5);
    ctx.restore();
    ctx.restore();

    // portrait
    const px = side === 0 ? 22 : VIEW_W - 22 - 96;
    ctx.save();
    roundRect(ctx, px - 4, 10, 104, 104, 18);
    ctx.fillStyle = "rgba(10,6,18,0.9)";
    ctx.fill();
    ctx.restore();
    const face = f.state === "hitstun" || f.state === "airhit" ? "hurt" : f.state === "ko" ? "ko" : f.state === "win" ? "happy" : "normal";
    portrait(ctx, f.char, px, 14, 96, 96, { facing: side === 0 ? 1 : -1, face, bg: f.char.color, t: b.realFrame, zoom: 1.6 });
    ctx.strokeStyle = f.char.color;
    ctx.lineWidth = 3;
    roundRect(ctx, px, 14, 96, 96, 14);
    ctx.stroke();

    // names
    const nx = side === 0 ? x0 : x0 + W;
    const al = side === 0 ? "left" : "right";
    text(ctx, f.char.short, nx, y + H + 30, { size: 24, font: FONT.arcade, weight: 400, align: al, stroke: COLOR.ink, sw: 6 });
    const enW = f.char.short.length * 19 + 14;
    text(ctx, f.char.name, nx + (side === 0 ? enW : -enW), y + H + 28, { size: 16, weight: 700, align: al, color: f.char.color, stroke: COLOR.ink, sw: 4 });
    // round wins
    for (let i = 0; i < (b.mode === "training" ? 0 : b.roundsToWin); i++) {
      const wx = side === 0 ? x0 + W - 18 - i * 30 : x0 + 18 + i * 30;
      const won = i < f.wins;
      ctx.save();
      ctx.translate(wx, y + H + 22);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = won ? COLOR.gold : "rgba(0,0,0,0.5)";
      ctx.strokeStyle = won ? "#fff" : "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2.5;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.restore();
    }
    ctx.restore();
  }

  drawTimer(ctx, b) {
    const cx = VIEW_W / 2;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      ctx.lineTo(cx + Math.cos(a) * 46, 52 + Math.sin(a) * 46);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(10,6,18,0.92)";
    ctx.fill();
    ctx.strokeStyle = b.rule ? b.rule.color : "rgba(255,255,255,0.3)";
    ctx.lineWidth = 3;
    ctx.stroke();
    const sec = b.timer === Infinity ? "∞" : String(Math.ceil(b.timer / 60));
    const urgent = b.timer !== Infinity && b.timer < 600 && b.phase === "fight";
    text(ctx, sec, cx, 66, { size: 40, font: FONT.arcade, weight: 400, align: "center", color: urgent ? (Math.floor(this.t / 10) % 2 ? "#ff5a5a" : "#fff") : COLOR.paper });
    ctx.restore();
  }

  // ------------------------------------------------------------ meter & steal
  drawMeter(ctx, b, f, side) {
    const W = 300;
    const H = 18;
    const y = VIEW_H - 48;
    const x = side === 0 ? 40 : VIEW_W - 40 - W;
    const frac = f.meter / SUPER_COST;
    const full = f.meter >= SUPER_COST;
    ctx.save();
    slant(ctx, x - 6, y - 6, W + 12, H + 12, 8, "rgba(10,6,18,0.85)");
    ctx.save();
    roundRect(ctx, x, y, W, H, 4);
    ctx.clip();
    ctx.fillStyle = "#1a1230";
    ctx.fillRect(x, y, W, H);
    const fw = W * clamp(frac, 0, 1);
    const fx = side === 0 ? x : x + W - fw;
    const g = ctx.createLinearGradient(x, 0, x + W, 0);
    g.addColorStop(0, full ? "#ffffff" : "#3a7bff");
    g.addColorStop(1, full ? f.char.color : "#7af0ff");
    ctx.fillStyle = g;
    ctx.fillRect(fx, y, fw, H);
    if (full) {
      const sweep = ((this.t * 8) % (W + 120)) - 60;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(x + (side === 0 ? sweep : W - sweep), y, 26, H);
    }
    ctx.restore();
    const lblX = side === 0 ? x : x + W;
    const al = side === 0 ? "left" : "right";
    text(ctx, full ? "SUPER MAX" : "SUPER", lblX, y - 12, { size: 16, font: FONT.arcade, weight: 400, align: al, color: full ? (Math.floor(this.t / 6) % 2 ? COLOR.gold : "#fff") : COLOR.dim, stroke: COLOR.ink, sw: 4 });
    if (f.buff) {
      const bw = (f.buff.frames / 600) * 120;
      text(ctx, f.buff.name, side === 0 ? x + W + 20 : x - 20, y - 10, { size: 16, weight: 900, align: side === 0 ? "left" : "right", color: "#ff7a5a", stroke: COLOR.ink, sw: 4 });
      ctx.fillStyle = "#ff7a5a";
      ctx.fillRect(side === 0 ? x + W + 20 : x - 20 - bw, y + 4, bw, 6);
    }
    // stolen move card
    if (f.stolen) {
      const st = f.stolen;
      const cw = 270;
      const cx = side === 0 ? x : x + W - cw;
      const cy = y - 76;
      const pulse = 0.6 + Math.sin(this.t * 0.2) * 0.25;
      ctx.save();
      ctx.shadowColor = st.char.color;
      ctx.shadowBlur = 16 * pulse;
      slant(ctx, cx, cy, cw, 44, 8, rgba(st.char.colorB || "#000000", 0.95));
      ctx.restore();
      ctx.strokeStyle = st.char.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + 4, cy + 2, cw - 8, 40);
      text(ctx, (f.char.faction === "philosophy" ? "논파한 기술" : "인수한 기술") + " · ↑+기술", cx + 14, cy + 16, { size: 12, weight: 900, color: st.char.color });
      text(ctx, st.move.name, cx + 14, cy + 36, { size: 18, weight: 900, color: "#fff", maxW: cw - 70 });
      text(ctx, `${Math.ceil(st.timer / 60)}s`, cx + cw - 14, cy + 34, { size: 18, font: FONT.arcade, weight: 400, align: "right", color: st.char.color });
      ctx.fillStyle = st.char.color;
      ctx.fillRect(cx + 6, cy + 40, (cw - 12) * (st.timer / st.max), 3);
    }
    // locked moves
    const locks = Object.entries(f.locked).filter(([, v]) => v > 0);
    if (locks.length) {
      const [id, v] = locks[0];
      const m = f.moves[id];
      const cx = side === 0 ? x : x + W - 250;
      const cy = y - (f.stolen ? 124 : 70);
      const shake = this.lockPing[side] > 0 ? Math.sin(this.lockPing[side] * 1.5) * 5 : 0;
      slant(ctx, cx + shake, cy, 250, 34, 6, "rgba(60,8,16,0.92)");
      text(ctx, `🔒 ${m ? m.name : id}`, cx + 14 + shake, cy + 23, { size: 15, weight: 900, color: "#ff8a8a", maxW: 170 });
      text(ctx, `${Math.ceil(v / 60)}s`, cx + 236 + shake, cy + 23, { size: 15, font: FONT.arcade, weight: 400, align: "right", color: "#ff8a8a" });
    }
    if (this.meterFlash[side] > 0) {
      const u = this.meterFlash[side] / 40;
      text(ctx, "필살기 준비!", side === 0 ? x + 20 : x + W - 20, y - 40 - (1 - u) * 20, { size: 24, font: FONT.title, weight: 400, align: side === 0 ? "left" : "right", color: COLOR.gold, stroke: COLOR.ink, sw: 6, alpha: Math.min(1, u * 2) });
    }
    ctx.restore();
  }

  drawCombos(ctx, b) {
    for (let side = 0; side < 2; side++) {
      const c = this.combo[side];
      if (!c || c.n < 2) continue;
      const x = side === 0 ? 60 : VIEW_W - 60;
      const al = side === 0 ? "left" : "right";
      const pop = c.t < 6 ? 1.25 - c.t * 0.04 : 1;
      const alpha = c.t > 70 ? (90 - c.t) / 20 : 1;
      ctx.save();
      ctx.translate(x, 250);
      ctx.scale(pop, pop);
      text(ctx, String(c.n), 0, 0, { size: 76, font: FONT.arcade, weight: 400, align: al, color: c.n >= 8 ? "#ff7ad9" : c.n >= 5 ? COLOR.gold : "#fff", stroke: COLOR.ink, sw: 10, alpha });
      text(ctx, "HITS", side === 0 ? 4 : -4, 34, { size: 28, font: FONT.arcade, weight: 400, align: al, color: "#fff", stroke: COLOR.ink, sw: 6, alpha });
      text(ctx, `${c.dmg} DMG`, side === 0 ? 4 : -4, 62, { size: 18, font: FONT.arcade, weight: 400, align: al, color: COLOR.gold, stroke: COLOR.ink, sw: 5, alpha });
      const label = c.n >= 10 ? "철학적 완성!" : c.n >= 7 ? "복리 효과!" : c.n >= 4 ? "좋은 논증!" : null;
      if (label) text(ctx, label, side === 0 ? 4 : -4, 92, { size: 20, font: FONT.title, weight: 400, align: al, color: "#7af0ff", stroke: COLOR.ink, sw: 5, alpha });
      ctx.restore();
    }
  }

  drawNotices(ctx, b) {
    for (const n of this.notice) {
      const u = n.t / 150;
      const x = n.side === 0 ? 40 : VIEW_W - 40;
      const y = VIEW_H - 170 - Math.min(1, n.t / 10) * 10;
      text(ctx, n.text, x, y, { size: 18, weight: 900, align: n.side === 0 ? "left" : "right", color: "#fff", stroke: COLOR.ink, sw: 5, alpha: u > 0.8 ? (1 - u) * 5 : 1 });
    }
  }

  drawRuleBadge(ctx, b) {
    const r = b.rule;
    const w = 230;
    const x = VIEW_W / 2 - w / 2;
    const y = 104;
    slant(ctx, x, y, w, 30, 8, "rgba(10,6,18,0.85)");
    ctx.fillStyle = r.color;
    ctx.fillRect(x + 4, y + 26, w - 8, 3);
    text(ctx, `법칙 · ${r.name}`, VIEW_W / 2, y + 21, { size: 16, weight: 900, align: "center", color: r.color });
  }

  drawRuleCard(ctx, b) {
    const { rule, t } = b.ruleCard;
    const inU = ease.outBack(clamp(t / 18, 0, 1));
    const out = t > 96 ? clamp((t - 96) / 16, 0, 1) : 0;
    ctx.save();
    ctx.fillStyle = `rgba(5,3,10,${0.6 * (1 - out)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    ctx.translate(cx, cy + out * 400);
    const flip = Math.abs(Math.cos(clamp(t / 18, 0, 1) * Math.PI)) * (t < 18 ? 1 : 0);
    ctx.scale(Math.max(0.05, t < 9 ? flip : inU), inU);
    ctx.rotate((1 - inU) * 0.3);
    const W = 560;
    const H = 330;
    ctx.save();
    ctx.shadowColor = rule.color;
    ctx.shadowBlur = 40;
    roundRect(ctx, -W / 2, -H / 2, W, H, 22);
    ctx.fillStyle = "#120c1c";
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 4;
    ctx.strokeStyle = rule.color;
    roundRect(ctx, -W / 2 + 10, -H / 2 + 10, W - 20, H - 20, 16);
    ctx.stroke();
    // rotating rays
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.rotate(t * 0.01);
    ctx.fillStyle = rule.color;
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-30, -400);
      ctx.lineTo(30, -400);
      ctx.fill();
    }
    ctx.restore();
    text(ctx, "PARADIGM SHIFT", 0, -H / 2 + 52, { size: 26, font: FONT.arcade, weight: 400, align: "center", color: rule.color, spacing: 4 });
    text(ctx, "세계의 법칙이 바뀌었다", 0, -H / 2 + 80, { size: 15, weight: 700, align: "center", color: COLOR.dim });
    text(ctx, rule.name, 0, 10, { size: 66, font: FONT.title, weight: 400, align: "center", color: "#fff", stroke: COLOR.ink, sw: 8 });
    text(ctx, rule.en, 0, 44, { size: 16, font: FONT.arcade, weight: 400, align: "center", color: rule.color });
    text(ctx, rule.desc, 0, 92, { size: 17, weight: 700, align: "center", color: COLOR.paper, maxW: W - 60 });
    text(ctx, `— ${rule.by}`, W / 2 - 34, H / 2 - 28, { size: 15, weight: 700, align: "right", color: COLOR.dim });
    ctx.restore();
  }

  drawCutIn(ctx, b) {
    const s = b.superInfo;
    const f = b.fighters[s.side];
    const t = s.t;
    const u = ease.outCubic(clamp(t / 10, 0, 1));
    const out = t > 44 ? clamp((t - 44) / 14, 0, 1) : 0;
    const dir = s.side === 0 ? 1 : -1;
    ctx.save();
    const y = 250;
    const h = 200;
    const shift = (1 - u) * -dir * VIEW_W + out * dir * VIEW_W;
    ctx.translate(shift, 0);
    ctx.beginPath();
    ctx.moveTo(0, y + 30);
    ctx.lineTo(VIEW_W, y - 30);
    ctx.lineTo(VIEW_W, y + h - 30);
    ctx.lineTo(0, y + h + 30);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, VIEW_W, 0);
    g.addColorStop(0, rgba(f.char.colorB || "#000000", 0.95));
    g.addColorStop(0.5, rgba(f.char.color, 0.9));
    g.addColorStop(1, rgba(f.char.colorB || "#000000", 0.95));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // speed lines
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      const ly = y - 40 + ((i * 37 + t * 9) % (h + 80));
      const lx = ((i * 211 + t * 40 * dir) % (VIEW_W + 400)) - 200;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 180 * dir, ly - 10);
      ctx.stroke();
    }
    const px = s.side === 0 ? 260 : VIEW_W - 260;
    drawFighterAt(ctx, f.char, px + (t * 0.6) * dir, y + h * 2.25, 1.85, dir, { ...P.taunt, face: "angry" }, "angry", b.realFrame);
    ctx.restore();
    const tx = s.side === 0 ? 520 : VIEW_W - 520;
    const al = s.side === 0 ? "left" : "right";
    text(ctx, "SUPER", tx, y + 46, { size: 22, font: FONT.arcade, weight: 400, align: al, color: "#fff", alpha: 0.85 });
    text(ctx, s.name, tx, y + 110, { size: 58, font: FONT.title, weight: 400, align: al, color: "#fff", stroke: COLOR.ink, sw: 10 });
    if (s.line) text(ctx, `“${s.line}”`, tx, y + 150, { size: 19, weight: 700, align: al, color: "#fff", stroke: COLOR.ink, sw: 5, maxW: 680 });
    ctx.restore();
  }

  drawAnnounce(ctx) {
    for (const a of this.announce) {
      if (a.t < 0) continue;
      const t = a.t;
      const kind = a.kind;
      const big = kind === "ko" ? 150 : kind === "fight" ? 130 : kind === "perfect" ? 100 : kind === "small" ? 60 : 92;
      const inU = ease.outBack(clamp(t / 12, 0, 1));
      const fade = t > 70 ? (90 - t) / 20 : 1;
      const col = kind === "ko" ? "#ff4d5e" : kind === "fight" ? COLOR.gold : kind === "perfect" ? "#7af0ff" : "#ffffff";
      ctx.save();
      ctx.translate(VIEW_W / 2, VIEW_H / 2 - 30);
      ctx.scale(inU * (kind === "fight" ? 1 + Math.max(0, (t - 50) / 60) : 1), inU);
      ctx.rotate(kind === "ko" ? -0.06 : 0);
      if (kind === "round" || kind === "fight") {
        ctx.globalAlpha = fade * 0.85;
        slant(ctx, -VIEW_W / 2 - 40, -big * 0.55, VIEW_W + 80, big * 0.95, 30, "rgba(10,6,18,0.7)");
        ctx.globalAlpha = 1;
      }
      text(ctx, a.text, 0, big * 0.32, { size: big, font: kind === "small" ? FONT.title : FONT.arcade, weight: 400, align: "center", color: col, stroke: COLOR.ink, sw: big / 7, alpha: fade, shadow: "rgba(0,0,0,0.5)" });
      ctx.restore();
    }
  }

  drawTraining(ctx, b, opts) {
    const [a, c] = b.fighters;
    const lines = [
      `콤보 데미지  ${opts.lastCombo || 0}`,
      `최대 콤보  ${opts.maxCombo || 0} HIT`,
      `더미: ${opts.dummyLabel}`,
      `판정 표시: ${opts.boxes ? "ON" : "OFF"}  (Tab) · 위치 초기화 (Backspace)`,
    ];
    ctx.save();
    roundRect(ctx, VIEW_W / 2 - 160, 150, 320, lines.length * 22 + 20, 10);
    ctx.fillStyle = "rgba(10,6,18,0.6)";
    ctx.fill();
    lines.forEach((l, i) => text(ctx, l, VIEW_W / 2, 176 + i * 22, { size: 15, weight: 700, align: "center", color: COLOR.paper }));
    if (a.state === "attack") text(ctx, `${a.move.name} · 발생 ${a.move.startup}F · 전체 ${a.move.frames}F`, VIEW_W / 2, VIEW_H - 92, { size: 16, weight: 700, align: "center", color: COLOR.gold, stroke: COLOR.ink, sw: 4 });
    ctx.restore();
  }
}
