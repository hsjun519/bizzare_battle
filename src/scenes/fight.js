// The fight itself: runs the Battle, routes input/AI, plays audio and draws
// the renderer + HUD. Also hosts the pause menu and training options.
import { Battle } from "../game/battle.js";
import { AIController, dummyControls } from "../game/ai.js";
import { BattleRenderer } from "../render/renderer.js";
import { HUD } from "../render/hud.js";
import { getStage } from "../render/stages.js";
import { charById } from "../chars/index.js";
import { PARADIGMS } from "../game/paradigms.js";
import { VIEW_W, VIEW_H } from "../game/constants.js";
import { text, FONT, COLOR, panel, slant } from "../render/ui.js";
import { MoveList } from "./movelist.js";
import { TouchControls } from "../core/touch.js";

const DUMMY = [
  ["stand", "서 있기"],
  ["crouch", "앉기"],
  ["jump", "점프 반복"],
  ["block", "자동 가드"],
  ["crouchblock", "앉아 가드"],
  ["cpu", "CPU (보통)"],
];

export class FightScene {
  constructor(app, opts) {
    this.app = app;
    this.opts = opts;
    const s = app.save.settings;
    this.mode = opts.mode;
    const training = this.mode === "training" ? { meter: true, invincible: true } : null;
    this.battle = new Battle({
      p1: charById(opts.p1),
      p2: charById(opts.p2),
      stage: opts.stage,
      mode: this.mode,
      rounds: this.mode === "training" ? 99 : opts.rounds || s.rounds,
      timer: this.mode === "training" ? Infinity : s.timer === 0 ? Infinity : opts.timer || s.timer,
      seed: opts.seed || Math.floor(Math.random() * 1e9),
      training,
      paradigm: this.mode !== "training" && s.paradigm,
    });
    const level = opts.difficulty || s.difficulty;
    this.ai = [this.mode === "demo" ? new AIController("hard") : null, new AIController(level)];
    this.renderer = new BattleRenderer();
    this.hud = new HUD();
    this.paused = false;
    this.pauseIdx = 0;
    this.endT = 0;
    this.dummy = 0;
    this.lastCombo = 0;
    this.maxCombo = 0;
    this.moveList = null;
    if (!app.touch) app.touch = new TouchControls(app);
    this.touch = app.touch;
  }

  enter() {
    this.app.input.setLayout(this.mode === "versus" ? "versus" : "solo");
    this.touch.enabled = this.mode !== "versus" && this.mode !== "demo";
    const st = getStage(this.battle.stage);
    this.app.audio.playSong(st.song);
  }

  exit() {
    this.touch.enabled = false;
  }

  onBlur() {
    if (this.mode !== "demo" && this.battle.phase !== "matchEnd") this.paused = true;
  }

  pauseItems() {
    const items = [["resume", "계속하기"], ["moves", "기술표 보기"]];
    if (this.mode === "training") {
      items.push(["dummy", `더미 행동: ${DUMMY[this.dummy][1]}`]);
      items.push(["boxes", `판정 박스 표시: ${this.renderer.showBoxes ? "ON" : "OFF"}`]);
      items.push(["meter", `게이지 무한: ${this.battle.training.meter ? "ON" : "OFF"}`]);
      const r = this.battle.rule;
      items.push(["rule", `패러다임 시험: ${r ? r.name : "없음"}`]);
      items.push(["reset", "위치 초기화"]);
    } else items.push(["restart", "처음부터 다시"]);
    items.push(["select", "캐릭터 선택으로"]);
    items.push(["title", "메인 메뉴로"]);
    return items;
  }

  update() {
    const { app, battle } = this;
    const input = app.input;
    if (this.moveList) {
      if (this.moveList.update()) this.moveList = null;
      return;
    }
    const startPressed = input.menu().start || this.touch.consumePause();
    if (this.mode !== "demo" && startPressed && battle.phase !== "matchEnd") {
      this.paused = !this.paused;
      this.pauseIdx = 0;
      app.audio.play(this.paused ? "ui_back" : "ui_ok");
    }
    if (this.mode === "demo" && (input.anyPressed || input.pointer.pressed)) {
      this.opts.onExit?.();
      return;
    }
    if (this.paused) {
      this.updatePause();
      return;
    }
    if (this.mode === "training") {
      if (input.tappedCode("Backspace") || input.tappedCode("Digit0")) this.resetTraining();
      if (input.tappedCode("Tab")) this.renderer.showBoxes = !this.renderer.showBoxes;
    }
    const [f0, f1] = battle.fighters;
    const c0 = this.mode === "demo" ? this.ai[0].think(battle, f0, f1) : input.controls(0);
    let c1;
    if (this.mode === "versus") c1 = input.controls(1);
    else if (this.mode === "training") {
      const kind = DUMMY[this.dummy][0];
      if (kind === "cpu") c1 = this.ai[1].think(battle, f1, f0);
      else c1 = dummyControls(kind, f1, battle);
    } else c1 = this.ai[1].think(battle, f1, f0);
    battle.step([c0, c1]);
    if (!app.save.settings.shake) battle.shakeAmt = 0;
    this.hud.update(battle);
    const stage = getStage(battle.stage);
    for (const e of battle.drain()) {
      if (e.type === "sfx") app.audio.play(e.name);
      this.hud.onEvent(e, battle);
      stage.onEvent?.(e);
      if (e.type === "hit") {
        this.lastCombo = e.comboDmg;
        this.maxCombo = Math.max(this.maxCombo, e.combo);
      }
      if (e.type === "steal") app.save.records.steals = (app.save.records.steals || 0) + 1;
      if (e.type === "paradigm") {
        const seen = app.save.records.paradigms || [];
        if (!seen.includes(e.rule.id)) seen.push(e.rule.id);
        app.save.records.paradigms = seen;
      }
      if (e.type === "matchEnd") this.onMatchEnd(e);
      if (e.type === "announce" && e.kind === "fight") app.audio.play("fight");
      else if (e.type === "announce" && e.kind !== "small") app.audio.play("announce");
      if (e.type === "ko" && e.perfect) setTimeout(() => app.audio.play("perfect"), 1100);
    }
    if (battle.phase === "matchEnd") {
      this.endT++;
      if (this.endT > 150) this.finish();
    }
  }

  onMatchEnd(e) {
    const youWon = e.winner === 0;
    if (this.mode === "versus" || this.mode === "demo") this.app.audio.playSong("victory");
    else this.app.audio.playSong(youWon ? "victory" : "defeat");
    if (youWon && this.mode !== "demo") {
      this.app.save.records.wins = (this.app.save.records.wins || 0) + 1;
    }
    this.app.saveNow();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.opts.onEnd?.(this.battle);
  }

  resetTraining() {
    const b = this.battle;
    b.fighters.forEach((f) => (f.meter = 100));
    b.startRound(false);
    b.phase = "fight";
    b.phaseT = 0;
    this.lastCombo = 0;
  }

  updatePause() {
    const m = this.app.input.menu();
    const items = this.pauseItems();
    if (m.up) {
      this.pauseIdx = (this.pauseIdx + items.length - 1) % items.length;
      this.app.audio.play("ui_move");
    }
    if (m.down) {
      this.pauseIdx = (this.pauseIdx + 1) % items.length;
      this.app.audio.play("ui_move");
    }
    let choose = m.confirm ? items[this.pauseIdx][0] : null;
    const p = this.app.input.pointer;
    items.forEach(([id], i) => {
      const y = 230 + i * 50;
      if (p.x > VIEW_W / 2 - 220 && p.x < VIEW_W / 2 + 220 && p.y > y - 30 && p.y < y + 14) {
        if (p.moved) this.pauseIdx = i;
        if (p.released) choose = id;
      }
    });
    if (m.back && !choose) {
      this.paused = false;
      return;
    }
    if (!choose) return;
    this.app.audio.play("ui_ok");
    switch (choose) {
      case "resume":
        this.paused = false;
        break;
      case "moves":
        this.moveList = new MoveList(this.app, this.battle.fighters[0].char);
        break;
      case "dummy":
        this.dummy = (this.dummy + 1) % DUMMY.length;
        break;
      case "boxes":
        this.renderer.showBoxes = !this.renderer.showBoxes;
        break;
      case "meter":
        this.battle.training.meter = !this.battle.training.meter;
        break;
      case "rule": {
        const b = this.battle;
        const idx = b.rule ? PARADIGMS.indexOf(b.rule) : -1;
        if (idx + 1 >= PARADIGMS.length) {
          b.rule = null;
          b.ruleCard = null;
        } else {
          b.shiftParadigm(PARADIGMS[idx + 1].id);
          this.paused = false;
        }
        break;
      }
      case "reset":
        this.resetTraining();
        this.paused = false;
        break;
      case "restart":
        this.opts.onRestart?.();
        break;
      case "select":
        this.opts.onSelect?.();
        break;
      case "title":
        this.opts.onTitle?.();
        break;
    }
  }

  draw(view) {
    const ctx = view.ctx;
    const b = this.battle;
    this.renderer.draw(view, b, this.app.t);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    this.hud.draw(ctx, b, {
      training: this.mode === "training",
      lastCombo: this.lastCombo,
      maxCombo: this.maxCombo,
      dummyLabel: DUMMY[this.dummy][1],
      boxes: this.renderer.showBoxes,
    });
    if (this.mode === "demo") {
      if (Math.floor(this.app.t / 40) % 2) text(ctx, "DEMO PLAY · 아무 키나 누르세요", VIEW_W / 2, VIEW_H - 24, { size: 20, font: FONT.arcade, weight: 400, align: "center", stroke: COLOR.ink, sw: 5 });
    } else this.touch.draw(ctx, Boolean(b.fighters[0].stolen));
    if (this.paused) this.drawPause(ctx);
    if (this.moveList) this.moveList.draw(ctx);
  }

  drawPause(ctx) {
    ctx.fillStyle = "rgba(6,4,12,0.72)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, "PAUSE", VIEW_W / 2, 160, { size: 64, font: FONT.arcade, weight: 400, align: "center", color: COLOR.gold, stroke: COLOR.ink, sw: 8 });
    const items = this.pauseItems();
    items.forEach(([id, label], i) => {
      const y = 230 + i * 50;
      const on = i === this.pauseIdx;
      if (on) slant(ctx, VIEW_W / 2 - 220, y - 32, 440, 44, 10, COLOR.gold);
      text(ctx, label, VIEW_W / 2, y, { size: 24, weight: 900, align: "center", color: on ? COLOR.ink : COLOR.paper });
    });
    text(ctx, "↑↓ 선택 · 확인 J/Enter · ESC 닫기", VIEW_W / 2, VIEW_H - 30, { size: 16, weight: 700, align: "center", color: COLOR.dim });
  }
}
