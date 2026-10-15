// Post-match screen: winner, quote, the fight receipt and what to do next.
import { VIEW_W, VIEW_H } from "../game/constants.js";
import { text, FONT, COLOR, slant, panel, drawFighterAt, wrap } from "../render/ui.js";
import { ANIM, P } from "../render/poses.js";
import { ease, clamp, rgba, pick } from "../core/util.js";

export class ResultScene {
  constructor(app, setup, battle, actions) {
    this.app = app;
    this.setup = setup;
    this.battle = battle;
    this.actions = actions;
    this.t = 0;
    this.idx = 0;
    const w = battle.matchWinner ?? 0;
    this.winner = battle.fighters[w];
    this.loser = battle.fighters[1 - w];
    this.quote = pick(this.winner.char.winQuotes);
    this.playerWon = w === 0;
    this.items = this.buildItems();
  }

  buildItems() {
    const m = this.setup.mode;
    if (m === "arcade") {
      return this.playerWon ? [["next", "다음 상대로"], ["title", "메인 메뉴"]] : [["next", "이어하기 (점수 절반)"], ["select", "캐릭터 다시 고르기"], ["title", "메인 메뉴"]];
    }
    return [["next", "재대전"], ["select", "캐릭터 선택"], ["title", "메인 메뉴"]];
  }

  update() {
    this.t++;
    if (this.t < 30) return;
    const m = this.app.input.menu();
    const n = this.items.length;
    if (m.up || m.left) {
      this.idx = (this.idx + n - 1) % n;
      this.app.audio.play("ui_move");
    }
    if (m.down || m.right) {
      this.idx = (this.idx + 1) % n;
      this.app.audio.play("ui_move");
    }
    const p = this.app.input.pointer;
    this.items.forEach(([id], i) => {
      const x = 760;
      const y = 540 + i * 54;
      if (p.x > x - 10 && p.x < x + 420 && p.y > y - 34 && p.y < y + 12) {
        if (p.moved) this.idx = i;
        if (p.released) this.choose(id);
      }
    });
    if (m.confirm) this.choose(this.items[this.idx][0]);
  }

  choose(id) {
    this.app.audio.play("ui_ok");
    if (id === "next") this.actions.onNext();
    else if (id === "select") this.actions.onSelect();
    else this.actions.onTitle();
  }

  draw(view) {
    const ctx = view.ctx;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    const w = this.winner;
    const c = w.char;
    const g = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
    g.addColorStop(0, c.colorB || "#000");
    g.addColorStop(1, "#07050c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // rays
    ctx.save();
    ctx.translate(360, 380);
    ctx.rotate(this.t * 0.004);
    ctx.fillStyle = rgba(c.color, 0.09);
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-60, -900);
      ctx.lineTo(60, -900);
      ctx.fill();
    }
    ctx.restore();
    const u = ease.outBack(clamp(this.t / 24, 0, 1));
    drawFighterAt(ctx, c, 350, 690, 1.75 * u, 1, ANIM.win(this.t), "happy", this.t);
    // header
    const mode = this.setup.mode;
    const title = mode === "versus" ? `${w.side === 0 ? "1P" : "2P"} WINS` : this.playerWon ? "YOU WIN" : "YOU LOSE";
    text(ctx, title, 720, 120, { size: 76, font: FONT.arcade, weight: 400, color: this.playerWon || mode === "versus" ? COLOR.gold : "#ff5a6a", stroke: COLOR.ink, sw: 12 });
    text(ctx, c.name, 724, 172, { size: 36, font: FONT.title, weight: 400, color: "#fff" });
    panel(ctx, 716, 196, 500, 96, { fill: "rgba(255,255,255,0.06)", stroke: rgba(c.color, 0.6), r: 14 });
    wrap(ctx, `“${this.quote}”`, 736, 236, 460, 28, { size: 21, weight: 700, color: "#fff" });
    // receipt
    const f0 = this.battle.fighters[0];
    const f1 = this.battle.fighters[1];
    const rows = [
      ["총 데미지", f0.stats.dmg, f1.stats.dmg],
      ["최대 콤보", f0.stats.maxCombo, f1.stats.maxCombo],
      ["필살기", f0.stats.supers, f1.stats.supers],
      ["논파·인수", f0.stats.justGuards || 0, f1.stats.justGuards || 0],
      ["잡기", f0.stats.throws, f1.stats.throws],
    ];
    text(ctx, "THE FIGHT RECEIPT", 724, 330, { size: 16, font: FONT.arcade, weight: 400, color: COLOR.dim });
    text(ctx, f0.char.short, 1010, 330, { size: 14, font: FONT.arcade, weight: 400, align: "right", color: f0.char.color });
    text(ctx, f1.char.short, 1180, 330, { size: 14, font: FONT.arcade, weight: 400, align: "right", color: f1.char.color });
    rows.forEach(([lab, a, b], i) => {
      const y = 360 + i * 26;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(724, y + 8, 460, 1);
      text(ctx, lab, 724, y, { size: 16, weight: 700, color: COLOR.paper });
      text(ctx, String(a), 1010, y, { size: 16, weight: 900, align: "right", color: a >= b ? "#fff" : COLOR.dim });
      text(ctx, String(b), 1180, y, { size: 16, weight: 900, align: "right", color: b >= a ? "#fff" : COLOR.dim });
    });
    const ar = this.setup.arcade;
    if (ar) {
      text(ctx, `SCORE ${ar.score.toLocaleString()}${this.playerWon && ar.lastGain ? `  (+${ar.lastGain.toLocaleString()})` : ""}`, 724, 500 - 4, { size: 20, font: FONT.arcade, weight: 400, color: COLOR.gold });
    }
    if (this.t > 30) {
      this.items.forEach(([id, label], i) => {
        const x = 760;
        const y = 540 + i * 54;
        const on = i === this.idx;
        if (on) slant(ctx, x - 16, y - 34, 430, 46, 10, COLOR.gold);
        text(ctx, label, x, y, { size: 26, font: FONT.title, weight: 400, color: on ? COLOR.ink : COLOR.paper });
      });
    }
  }
}
