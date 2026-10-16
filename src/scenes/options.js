// Settings screen.
import { VIEW_W, VIEW_H, DIFFICULTY } from "../game/constants.js";
import { text, FONT, COLOR, slant, panel } from "../render/ui.js";
import { Flow } from "./flow.js";
import { DEFAULT_SETTINGS } from "../core/save.js";

const DIFFS = ["easy", "normal", "hard", "insane"];

export class OptionsScene {
  constructor(app) {
    this.app = app;
    this.idx = 0;
    this.t = 0;
  }

  enter() {
    this.app.input.setLayout("solo");
  }

  rows() {
    const s = this.app.save.settings;
    return [
      ["sfx", "효과음", `${Math.round(s.sfx * 10)} / 10`, s.sfx],
      ["music", "배경음악", `${Math.round(s.music * 10)} / 10`, s.music],
      ["timer", "라운드 시간", s.timer === 0 ? "무제한" : `${s.timer}초`],
      ["rounds", "승리 라운드", `${s.rounds}선승`],
      ["paradigm", "패러다임 시프트", s.paradigm ? "ON" : "OFF"],
      ["difficulty", "CPU 난이도", DIFFICULTY[s.difficulty].label],
      ["shake", "화면 흔들림", s.shake ? "ON" : "OFF"],
      ["reset", "기본값으로 되돌리기", ""],
      ["back", "돌아가기", ""],
    ];
  }

  change(id, d) {
    const s = this.app.save.settings;
    const cyc = (arr, v) => arr[(arr.indexOf(v) + d + arr.length) % arr.length];
    switch (id) {
      case "sfx":
        s.sfx = Math.round(Math.min(1, Math.max(0, s.sfx + d * 0.1)) * 10) / 10;
        break;
      case "music":
        s.music = Math.round(Math.min(1, Math.max(0, s.music + d * 0.1)) * 10) / 10;
        break;
      case "timer":
        s.timer = cyc([60, 99, 0], s.timer);
        break;
      case "rounds":
        s.rounds = cyc([1, 2, 3], s.rounds);
        break;
      case "paradigm":
        s.paradigm = !s.paradigm;
        break;
      case "difficulty":
        s.difficulty = cyc(DIFFS, s.difficulty);
        break;
      case "shake":
        s.shake = !s.shake;
        break;
      default:
        return;
    }
    this.app.audio.setVolumes(s.sfx, s.music);
    this.app.audio.play("ui_move");
    this.app.saveNow();
  }

  update() {
    this.t++;
    const m = this.app.input.menu();
    const rows = this.rows();
    if (m.up) {
      this.idx = (this.idx + rows.length - 1) % rows.length;
      this.app.audio.play("ui_move");
    }
    if (m.down) {
      this.idx = (this.idx + 1) % rows.length;
      this.app.audio.play("ui_move");
    }
    const id = rows[this.idx][0];
    if (m.left) this.change(id, -1);
    if (m.right) this.change(id, 1);
    const p = this.app.input.pointer;
    rows.forEach(([rid], i) => {
      const y = 170 + i * 52;
      if (p.x > 300 && p.x < 980 && p.y > y - 34 && p.y < y + 12) {
        if (p.moved) this.idx = i;
        if (p.released) this.activate(rid, p.x > 640 ? 1 : -1);
      }
    });
    if (m.confirm) this.activate(id, 1);
    if (m.back || m.start) this.leave();
  }

  activate(id, d) {
    if (id === "back") return this.leave();
    if (id === "reset") {
      Object.assign(this.app.save.settings, DEFAULT_SETTINGS);
      this.app.audio.setVolumes(DEFAULT_SETTINGS.sfx, DEFAULT_SETTINGS.music);
      this.app.saveNow();
      this.app.audio.play("ui_ok");
      return;
    }
    this.change(id, d);
  }

  leave() {
    this.app.saveNow();
    this.app.audio.play("ui_back");
    Flow.title(this.app, { skipPress: true });
  }

  draw(view) {
    const ctx = view.ctx;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, "#15102a");
    g.addColorStop(1, "#07050c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, "OPTIONS", VIEW_W / 2, 92, { size: 46, font: FONT.arcade, weight: 400, align: "center", color: COLOR.gold, stroke: COLOR.ink, sw: 8 });
    this.rows().forEach(([id, label, value, frac], i) => {
      const y = 170 + i * 52;
      const on = i === this.idx;
      if (on) slant(ctx, 300, y - 34, 680, 46, 10, COLOR.gold);
      else slant(ctx, 300, y - 34, 680, 46, 10, "rgba(255,255,255,0.05)");
      text(ctx, label, 336, y, { size: 22, weight: 900, color: on ? COLOR.ink : COLOR.paper });
      if (value) text(ctx, `◀  ${value}  ▶`, 940, y, { size: 20, weight: 900, align: "right", color: on ? COLOR.ink : COLOR.gold });
      if (frac !== undefined) {
        ctx.fillStyle = on ? "rgba(22,17,29,0.3)" : "rgba(255,255,255,0.1)";
        ctx.fillRect(560, y - 14, 200, 8);
        ctx.fillStyle = on ? COLOR.ink : COLOR.gold;
        ctx.fillRect(560, y - 14, 200 * frac, 8);
      }
    });
    text(ctx, "↑↓ 항목 · ←→ 변경 · K/Esc 저장 후 나가기", VIEW_W / 2, VIEW_H - 30, { size: 15, weight: 700, align: "center", color: COLOR.dim });
  }
}
