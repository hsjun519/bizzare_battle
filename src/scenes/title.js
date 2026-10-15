// Title screen with a live CPU demo match running behind the logo.
import { Battle } from "../game/battle.js";
import { AIController } from "../game/ai.js";
import { BattleRenderer } from "../render/renderer.js";
import { ROSTER } from "../chars/index.js";
import { STAGES } from "../render/stages.js";
import { VIEW_W, VIEW_H } from "../game/constants.js";
import { text, FONT, COLOR, slant, button, keycap } from "../render/ui.js";
import { pick, ease, clamp } from "../core/util.js";
import { Flow } from "./flow.js";

const MENU = [
  ["arcade", "아케이드", "6연전 · 숙명의 라이벌과 엔딩"],
  ["cpu", "VS CPU", "원하는 상대와 한판 승부"],
  ["versus", "2P 대전", "한 키보드 / 게임패드 두 개"],
  ["training", "트레이닝", "콤보 연습 · 판정 표시 · 법칙 시험"],
  ["guide", "플레이 가이드", "조작법 · 논파와 인수 · 패러다임"],
  ["options", "설정", "소리 · 라운드 · 난이도"],
];

export class TitleScene {
  constructor(app, opts = {}) {
    this.app = app;
    this.t = 0;
    this.started = Boolean(opts.skipPress) || Boolean(app.titleSeen);
    this.idx = 0;
    this.renderer = new BattleRenderer();
    this.newDemo();
  }

  newDemo() {
    const a = pick(ROSTER);
    let b = pick(ROSTER);
    if (b === a) b = ROSTER[(ROSTER.indexOf(a) + 4) % ROSTER.length];
    this.demo = new Battle({ p1: a, p2: b, stage: pick(STAGES).id, mode: "demo", timer: 99, rounds: 2, seed: Math.floor(Math.random() * 1e9) });
    this.ais = [new AIController("hard"), new AIController("hard")];
  }

  enter() {
    this.app.input.setLayout("solo");
    this.app.audio.playSong("title");
  }

  update() {
    this.t++;
    const d = this.demo;
    const [f0, f1] = d.fighters;
    d.step([this.ais[0].think(d, f0, f1), this.ais[1].think(d, f1, f0)]);
    d.drain();
    if (d.phase === "matchEnd" && d.phaseT > 100) this.newDemo();
    if (d.phase === "matchEnd") d.phaseT++;

    const input = this.app.input;
    if (!this.started) {
      if (this.t > 20 && (input.anyPressed || input.pointer.released)) {
        this.started = true;
        this.app.titleSeen = true;
        this.app.audio.unlock();
        this.app.audio.play("ui_start");
        this.t = 0;
      }
      return;
    }
    const m = input.menu();
    if (m.up) {
      this.idx = (this.idx + MENU.length - 1) % MENU.length;
      this.app.audio.play("ui_move");
    }
    if (m.down) {
      this.idx = (this.idx + 1) % MENU.length;
      this.app.audio.play("ui_move");
    }
    if (m.confirm) this.choose(MENU[this.idx][0]);
    if (m.back && this.t > 10) {
      this.started = false;
      this.app.titleSeen = false;
    }
  }

  choose(id) {
    this.app.audio.play("ui_ok");
    if (id === "guide") Flow.guide(this.app);
    else if (id === "options") Flow.options(this.app);
    else Flow.select(this.app, id);
  }

  draw(view) {
    const ctx = view.ctx;
    this.renderer.draw(view, this.demo, this.app.t);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    const g = ctx.createLinearGradient(0, 0, VIEW_W, 0);
    g.addColorStop(0, "rgba(8,5,16,0.92)");
    g.addColorStop(0.55, "rgba(8,5,16,0.55)");
    g.addColorStop(1, "rgba(8,5,16,0.2)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.drawLogo(ctx);
    if (!this.started) {
      if (Math.floor(this.t / 30) % 2 === 0) text(ctx, "PRESS ANY KEY", 96, 560, { size: 34, font: FONT.arcade, weight: 400, color: COLOR.gold, stroke: COLOR.ink, sw: 6 });
      text(ctx, "아무 키나 누르거나 화면을 터치하세요", 98, 596, { size: 18, weight: 700, color: COLOR.dim });
    } else this.drawMenu(ctx);
    text(ctx, "M 음소거 · 실존 인물을 모티브로 한 비공식 패러디 게임 · 모든 대사는 허구입니다", VIEW_W - 24, VIEW_H - 18, { size: 13, weight: 500, align: "right", color: "rgba(255,248,236,0.45)" });
  }

  drawLogo(ctx) {
    const u = ease.outBack(clamp(this.app.t / 30, 0, 1));
    ctx.save();
    ctx.translate(92, 110);
    ctx.scale(u, u);
    slant(ctx, -14, 18, 300, 40, 10, "#ff4d5e");
    text(ctx, "철학 VS 자본", 8, 48, { size: 28, font: FONT.title, weight: 400, color: "#fff" });
    text(ctx, "BIZZARE", 0, 150, { size: 108, font: FONT.arcade, weight: 400, color: "#fff8ec", stroke: COLOR.ink, sw: 14, shadow: "rgba(255,77,94,0.9)" });
    text(ctx, "BATTLE", 6, 250, { size: 108, font: FONT.arcade, weight: 400, color: COLOR.gold, stroke: COLOR.ink, sw: 14, shadow: "rgba(122,240,255,0.8)" });
    text(ctx, "논리로 막고, 자본으로 빼앗고, 법칙을 뒤집어라.", 6, 296, { size: 20, weight: 700, color: COLOR.paper });
    ctx.restore();
  }

  drawMenu(ctx) {
    const x0 = 96;
    const y0 = 448;
    MENU.forEach(([id, label, sub], i) => {
      const y = y0 + i * 38;
      const on = i === this.idx;
      const p = this.app.input.pointer;
      const hover = p.x > x0 - 20 && p.x < x0 + 420 && p.y > y - 30 && p.y < y + 8;
      if (hover && p.moved && i !== this.idx) {
        this.idx = i;
        this.app.audio.play("ui_move");
      }
      if (hover && p.released) this.choose(id);
      const slide = on ? 18 : 0;
      if (on) slant(ctx, x0 - 20, y - 30, 470, 38, 10, COLOR.gold);
      text(ctx, label, x0 + slide, y, { size: 26, font: FONT.title, weight: 400, color: on ? COLOR.ink : COLOR.paper });
      if (on) text(ctx, sub, x0 + 200, y - 2, { size: 15, weight: 800, color: COLOR.ink });
    });
    const records = this.app.save.records;
    const clears = Object.keys(records.clears || {}).length;
    text(ctx, `아케이드 클리어 ${clears}/8 · 최고 점수 ${(records.best || 0).toLocaleString()} · 발견한 법칙 ${(records.paradigms || []).length}/8 · 빼앗은 기술 ${records.steals || 0}`, x0 - 4, VIEW_H - 40, { size: 14, weight: 700, color: COLOR.dim });
  }
}
