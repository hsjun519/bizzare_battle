// Character + stage select for every mode.
import { ROSTER } from "../chars/index.js";
import { STAGES, getStage } from "../render/stages.js";
import { VIEW_W, VIEW_H, DIFFICULTY } from "../game/constants.js";
import { text, FONT, COLOR, slant, panel, portrait, drawFighterAt, roundRect, bar, wrap, keycap } from "../render/ui.js";
import { ANIM, P } from "../render/poses.js";
import { rgba, pick, clamp, ease } from "../core/util.js";
import { INPUT_LABEL } from "../game/moves.js";
import { KEY_HELP } from "../core/input.js";
import { MoveList } from "./movelist.js";
import { Flow } from "./flow.js";

const COLS = 4;
const CELL = 104;
const GAP = 10;
const GX = (VIEW_W - (COLS * CELL + (COLS - 1) * GAP)) / 2;
const ROWS_Y = [170, 322];
const MODE_LABEL = { arcade: "아케이드", cpu: "VS CPU", versus: "2P 대전", training: "트레이닝" };
const DIFFS = ["easy", "normal", "hard", "insane"];

function cellRect(i) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { x: GX + col * (CELL + GAP), y: ROWS_Y[row], w: CELL, h: CELL };
}

let thumbs = null;
function makeThumbs(scale) {
  const list = {};
  for (const st of STAGES) {
    const w = 256;
    const h = 144;
    const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w * scale, h * scale) : Object.assign(document.createElement("canvas"), { width: w * scale, height: h * scale });
    const ctx = c.getContext("2d");
    ctx.scale((w / VIEW_W) * scale, (h / VIEW_H) * scale);
    st.drawBack(ctx, { x: 950, y: 0, zoom: 1, sx: 0, sy: 0 }, 200, { scale: Math.max(0.2, (w / VIEW_W) * scale) }, null);
    ctx.fillStyle = st.accent;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, 640, VIEW_W, 80);
    list[st.id] = c;
  }
  return list;
}

export class SelectScene {
  constructor(app, mode) {
    this.app = app;
    this.mode = mode;
    this.t = 0;
    this.step = "chars";
    this.active = 0;
    this.cur = [
      { idx: 0, locked: false, t: 0 },
      { idx: 4, locked: false, t: 0 },
    ];
    this.stageIdx = 0;
    this.diff = Math.max(0, DIFFS.indexOf(app.save.settings.difficulty));
    this.moveList = null;
  }

  enter() {
    this.app.input.setLayout(this.mode === "versus" ? "versus" : "solo");
    this.app.audio.playSong("select");
  }

  get twoSlots() {
    return this.mode !== "arcade";
  }

  update() {
    this.t++;
    const app = this.app;
    if (this.moveList) {
      if (this.moveList.update()) this.moveList = null;
      return;
    }
    if (this.step === "stage") return this.updateStage();
    if (this.mode === "versus") {
      this.updateCursor(0, app.input.menu(0));
      this.updateCursor(1, app.input.menu(1));
    } else this.updateCursor(this.active, app.input.menu(null));
    this.updatePointer();
    // Tab/H key: open move list for the active cursor's character
    if (app.input.tappedCode("Tab")) {
      this.moveList = new MoveList(app, ROSTER[this.cur[this.active].idx]);
    }
    for (const c of this.cur) c.t++;
    const need = this.twoSlots ? 2 : 1;
    if (this.cur.slice(0, need).every((c) => c.locked)) {
      if (this.mode === "arcade") {
        this.go();
        return;
      }
      if (!this.readyT) this.readyT = this.t;
      if (this.t - this.readyT > 18) {
        this.step = "stage";
        this.stageIdx = Math.floor(Math.random() * STAGES.length);
        this.readyT = 0;
      }
    } else this.readyT = 0;
  }

  updateCursor(i, m) {
    const app = this.app;
    const c = this.cur[i];
    if (c.locked) {
      if (m.back) {
        c.locked = false;
        app.audio.play("ui_back");
      }
      return;
    }
    const before = c.idx;
    if (m.left) c.idx = (c.idx % COLS === 0 ? c.idx + COLS - 1 : c.idx - 1);
    if (m.right) c.idx = (c.idx % COLS === COLS - 1 ? c.idx - COLS + 1 : c.idx + 1);
    if (m.up || m.down) c.idx = (c.idx + COLS) % ROSTER.length;
    if (c.idx !== before) {
      app.audio.play("ui_move");
      c.t = 0;
    }
    if (m.confirm) this.lock(i);
    if (m.back) {
      if (this.mode !== "versus" && i === 1) {
        this.active = 0;
        this.cur[0].locked = false;
        app.audio.play("ui_back");
      } else if (i === 0 || this.mode === "versus") {
        app.audio.play("ui_back");
        Flow.title(app, { skipPress: true });
      }
    }
  }

  lock(i) {
    const c = this.cur[i];
    c.locked = true;
    c.t = 0;
    this.app.audio.play("ui_lock");
    if (this.mode !== "versus" && this.twoSlots && i === 0) {
      this.active = 1;
      this.cur[1].locked = false;
    }
  }

  updatePointer() {
    const p = this.app.input.pointer;
    const slot = this.mode === "versus" ? 0 : this.active;
    const c = this.cur[slot];
    for (let i = 0; i < ROSTER.length; i++) {
      const r = cellRect(i);
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        if (p.moved && !c.locked && c.idx !== i) {
          c.idx = i;
          c.t = 0;
          this.app.audio.play("ui_move");
        }
        if (p.released && !c.locked) {
          c.idx = i;
          this.lock(slot);
        }
      }
    }
    // random button
    const rx = VIEW_W / 2 - 70;
    if (p.released && p.x > rx && p.x < rx + 140 && p.y > 456 && p.y < 492 && !c.locked) {
      c.idx = Math.floor(Math.random() * ROSTER.length);
      this.lock(slot);
    }
    // move list button
    if (p.released && p.x > VIEW_W / 2 - 110 && p.x < VIEW_W / 2 + 110 && p.y > 676 && p.y < 708) {
      this.moveList = new MoveList(this.app, ROSTER[this.cur[slot].idx]);
    }
  }

  updateStage() {
    const app = this.app;
    const m = app.input.menu(this.mode === "versus" ? null : null);
    const n = STAGES.length + 1;
    if (m.left) {
      this.stageIdx = (this.stageIdx + n - 1) % n;
      app.audio.play("ui_move");
    }
    if (m.right) {
      this.stageIdx = (this.stageIdx + 1) % n;
      app.audio.play("ui_move");
    }
    if (this.mode === "cpu" && (m.up || m.down)) {
      this.diff = (this.diff + (m.up ? 1 : DIFFS.length - 1)) % DIFFS.length;
      app.audio.play("ui_move");
    }
    const p = app.input.pointer;
    for (let i = 0; i < n; i++) {
      const x = this.stageX(i);
      if (p.x > x && p.x < x + 180 && p.y > 300 && p.y < 420) {
        if (p.moved && this.stageIdx !== i) {
          this.stageIdx = i;
          app.audio.play("ui_move");
        }
        if (p.released) {
          this.stageIdx = i;
          return this.go();
        }
      }
    }
    if (m.confirm) this.go();
    if (m.back) {
      this.step = "chars";
      this.cur[this.mode === "versus" ? 1 : 1].locked = false;
      if (this.mode !== "versus") this.active = 1;
      app.audio.play("ui_back");
    }
  }

  stageX(i) {
    const n = STAGES.length + 1;
    const total = n * 180 + (n - 1) * 14;
    return (VIEW_W - total) / 2 + i * 194;
  }

  go() {
    const app = this.app;
    app.audio.play("ui_start");
    const p1 = ROSTER[this.cur[0].idx].id;
    if (this.mode === "arcade") return Flow.startArcade(app, p1);
    const p2 = ROSTER[this.cur[1].idx].id;
    const stage = this.stageIdx >= STAGES.length ? pick(STAGES).id : STAGES[this.stageIdx].id;
    const difficulty = DIFFS[this.diff];
    if (this.mode === "cpu") {
      app.save.settings.difficulty = difficulty;
      app.saveNow();
    }
    const setup = { mode: this.mode, p1, p2, stage, difficulty };
    if (this.mode === "training") Flow.fight(app, setup);
    else Flow.versus(app, setup);
  }

  // ------------------------------------------------------------ drawing
  draw(view) {
    const ctx = view.ctx;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    this.drawBackground(ctx);
    const c0 = ROSTER[this.cur[0].idx];
    const c1 = ROSTER[this.cur[1].idx];
    this.drawPreview(ctx, c0, 0, this.cur[0]);
    if (this.twoSlots && (this.mode === "versus" || this.active === 1 || this.cur[1].locked)) this.drawPreview(ctx, c1, 1, this.cur[1]);
    else if (this.twoSlots) this.drawWaiting(ctx);
    else this.drawArcadeInfo(ctx);
    this.drawGrid(ctx);
    text(ctx, "CHOOSE YOUR FIGHTER", VIEW_W / 2, 64, { size: 34, font: FONT.arcade, weight: 400, align: "center", color: "#fff", stroke: COLOR.ink, sw: 8 });
    slant(ctx, VIEW_W / 2 - 90, 84, 180, 30, 8, COLOR.red);
    text(ctx, MODE_LABEL[this.mode], VIEW_W / 2, 106, { size: 18, weight: 900, align: "center", color: "#fff" });
    this.drawHelp(ctx);
    if (this.step === "stage") this.drawStage(ctx);
    if (this.moveList) this.moveList.draw(ctx);
  }

  drawBackground(ctx) {
    const g = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
    g.addColorStop(0, "#0d1a33");
    g.addColorStop(0.5, "#120c1e");
    g.addColorStop(1, "#2a1c08");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#ffffff";
    const off = (this.t * 0.6) % 80;
    for (let x = -VIEW_H; x < VIEW_W + VIEW_H; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x + off, 0);
      ctx.lineTo(x + off + 30, 0);
      ctx.lineTo(x + off + 30 - VIEW_H, VIEW_H);
      ctx.lineTo(x + off - VIEW_H, VIEW_H);
      ctx.fill();
    }
    ctx.restore();
  }

  drawGrid(ctx) {
    text(ctx, "PHILOSOPHY · 철학", GX, ROWS_Y[0] - 14, { size: 15, font: FONT.arcade, weight: 400, color: COLOR.philosophy });
    text(ctx, "CAPITAL · 자본", GX, ROWS_Y[1] - 14, { size: 15, font: FONT.arcade, weight: 400, color: COLOR.capital });
    ROSTER.forEach((c, i) => {
      const r = cellRect(i);
      const showP2 = this.twoSlots && (this.mode === "versus" || this.active === 1 || this.cur[1].locked || this.step === "stage");
      const hov = this.cur.map((cu, s) => (cu.idx === i && (s === 0 || showP2) ? s : -1)).filter((s) => s >= 0);
      const lit = hov.length > 0;
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      const sc = lit ? 1.06 : 1;
      ctx.scale(sc, sc);
      ctx.translate(-r.w / 2, -r.h / 2);
      portrait(ctx, c, 0, 0, r.w, r.h, { bg: lit ? c.color : rgba(c.color, 0.35), face: lit ? "angry" : "normal", zoom: 1.45 });
      roundRect(ctx, 0, 0, r.w, r.h, 10);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.stroke();
      ctx.restore();
      hov.forEach((s) => {
        const col = s === 0 ? "#3fd0ff" : this.mode === "versus" ? "#ff4d5e" : "#ff9a3a";
        const pulse = 2 + Math.sin(this.t * 0.25) * 1.5;
        ctx.save();
        roundRect(ctx, r.x - 5 - s * 4, r.y - 5 - s * 4, r.w + 10 + s * 8, r.h + 10 + s * 8, 14);
        ctx.lineWidth = 4 + pulse;
        ctx.strokeStyle = col;
        ctx.stroke();
        const tag = s === 0 ? "1P" : this.mode === "versus" ? "2P" : this.mode === "training" ? "더미" : "CPU";
        slant(ctx, s === 0 ? r.x - 6 : r.x + r.w - 46, r.y + r.h - 4, 52, 22, 5, col);
        text(ctx, tag, s === 0 ? r.x + 20 : r.x + r.w - 20, r.y + r.h + 13, { size: 14, weight: 900, align: "center", color: "#fff" });
        ctx.restore();
      });
    });
    const rx = VIEW_W / 2 - 70;
    slant(ctx, rx, 458, 140, 34, 8, "rgba(255,255,255,0.1)");
    text(ctx, "? 랜덤", VIEW_W / 2, 482, { size: 18, weight: 900, align: "center", color: COLOR.paper });
  }

  drawPreview(ctx, c, side, cur) {
    const x = side === 0 ? 215 : VIEW_W - 215;
    const dir = side === 0 ? 1 : -1;
    const slide = ease.outCubic(clamp(cur.t / 12, 0, 1));
    ctx.save();
    // backdrop
    const bx = side === 0 ? 0 : VIEW_W - 430;
    const g = ctx.createLinearGradient(bx, 0, bx + 430, 0);
    const a0 = side === 0 ? rgba(c.color, 0.35) : "rgba(0,0,0,0)";
    const a1 = side === 0 ? "rgba(0,0,0,0)" : rgba(c.color, 0.35);
    g.addColorStop(0, a0);
    g.addColorStop(1, a1);
    ctx.fillStyle = g;
    ctx.fillRect(bx, 0, 430, VIEW_H);
    text(ctx, c.short, x - dir * 10, 300, { size: 92, font: FONT.arcade, weight: 400, align: "center", color: rgba(c.color, 0.18) });
    const pose = cur.locked && cur.t < 50 ? { ...P.win, face: "happy" } : ANIM.idle(this.t);
    drawFighterAt(ctx, c, x - dir * (1 - slide) * 120, 452, 1.22, dir, pose, cur.locked ? "happy" : null, this.t);
    ctx.globalAlpha = slide;
    const tx = side === 0 ? 30 : VIEW_W - 30;
    const al = side === 0 ? "left" : "right";
    text(ctx, c.name, tx, 512, { size: 42, font: FONT.title, weight: 400, align: al, color: "#fff", stroke: COLOR.ink, sw: 6 });
    text(ctx, `${c.en} · ${c.title}`, tx, 540, { size: 15, weight: 800, align: al, color: c.color });
    text(ctx, `“${c.quote}”`, tx, 566, { size: 15, weight: 500, align: al, color: COLOR.paper, maxW: 390 });
    const stats = [["파워", c.stats.power], ["스피드", c.stats.speed], ["사거리", c.stats.range], ["난이도", c.stats.tech]];
    stats.forEach(([lab, v], i) => {
      const yy = 592 + i * 20;
      const lx = side === 0 ? 30 : VIEW_W - 250;
      text(ctx, lab, lx, yy + 4, { size: 13, weight: 800, color: COLOR.dim });
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k < v ? c.color : "rgba(255,255,255,0.12)";
        ctx.fillRect(lx + 60 + k * 32, yy - 6, 28, 10);
      }
    });
    text(ctx, `특성 · ${c.passive.name}`, tx, 690, { size: 14, weight: 900, align: al, color: COLOR.gold });
    text(ctx, c.passive.desc, tx, 710, { size: 12, weight: 500, align: al, color: COLOR.paper, maxW: 400 });
    if (cur.locked) {
      ctx.globalAlpha = 1;
      const pop = ease.outBack(clamp(cur.t / 10, 0, 1));
      ctx.translate(x, 112);
      ctx.rotate(-0.12 * dir);
      ctx.scale(pop, pop);
      slant(ctx, -90, -26, 180, 52, 10, COLOR.gold);
      text(ctx, "READY!", 0, 14, { size: 34, font: FONT.arcade, weight: 400, align: "center", color: COLOR.ink });
    }
    ctx.restore();
  }

  drawWaiting(ctx) {
    const x = VIEW_W - 215;
    text(ctx, this.mode === "training" ? "더미 캐릭터" : "상대를 고르세요", x, 380, { size: 26, font: FONT.title, weight: 400, align: "center", color: COLOR.dim });
    text(ctx, "1P 선택 후 지정", x, 412, { size: 15, weight: 700, align: "center", color: COLOR.dim });
  }

  drawArcadeInfo(ctx) {
    const x = VIEW_W - 215;
    const rec = this.app.save.records;
    text(ctx, "ARCADE", x, 300, { size: 40, font: FONT.arcade, weight: 400, align: "center", color: COLOR.gold });
    const lines = ["6명의 상대와 연전", "마지막은 숙명의 라이벌", "클리어하면 캐릭터 엔딩", `클리어 기록 ${Object.keys(rec.clears || {}).length}/8`, `최고 점수 ${(rec.best || 0).toLocaleString()}`];
    lines.forEach((l, i) => text(ctx, l, x, 350 + i * 30, { size: 18, weight: 700, align: "center", color: i >= 3 ? COLOR.dim : COLOR.paper }));
    const c = ROSTER[this.cur[0].idx];
    if (rec.clears?.[c.id]) text(ctx, `★ ${c.name} 클리어 ${rec.clears[c.id]}회`, x, 520, { size: 18, weight: 900, align: "center", color: COLOR.gold });
  }

  drawHelp(ctx) {
    const y = VIEW_H - 30;
    if (this.mode === "versus") {
      text(ctx, "1P: WASD 이동 · F 결정 · G 취소     2P: 방향키 이동 · , 결정 · . 취소", VIEW_W / 2, y - 24, { size: 14, weight: 700, align: "center", color: COLOR.dim });
    } else {
      text(ctx, "방향키/WASD 이동 · J/Enter 결정 · K/Esc 취소 · Tab 기술표", VIEW_W / 2, y - 24, { size: 14, weight: 700, align: "center", color: COLOR.dim });
    }
    slant(ctx, VIEW_W / 2 - 110, 676, 220, 30, 6, "rgba(255,255,255,0.08)");
    text(ctx, "기술표 보기 (Tab)", VIEW_W / 2, 697, { size: 15, weight: 800, align: "center", color: COLOR.paper });
  }

  drawStage(ctx) {
    if (!thumbs) thumbs = makeThumbs(Math.min(2, this.app.view.scale * 1.2));
    ctx.fillStyle = "rgba(6,4,12,0.8)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, "SELECT STAGE", VIEW_W / 2, 220, { size: 40, font: FONT.arcade, weight: 400, align: "center", color: COLOR.gold, stroke: COLOR.ink, sw: 8 });
    const n = STAGES.length + 1;
    for (let i = 0; i < n; i++) {
      const x = this.stageX(i);
      const on = i === this.stageIdx;
      const y = on ? 296 : 306;
      ctx.save();
      roundRect(ctx, x, y, 180, 112, 10);
      ctx.clip();
      if (i < STAGES.length) ctx.drawImage(thumbs[STAGES[i].id], x, y, 180, 112);
      else {
        ctx.fillStyle = "#222";
        ctx.fillRect(x, y, 180, 112);
        text(ctx, "?", x + 90, y + 76, { size: 64, font: FONT.arcade, weight: 400, align: "center", color: COLOR.dim });
      }
      ctx.restore();
      roundRect(ctx, x, y, 180, 112, 10);
      ctx.lineWidth = on ? 5 : 2;
      ctx.strokeStyle = on ? COLOR.gold : "rgba(255,255,255,0.25)";
      ctx.stroke();
      const name = i < STAGES.length ? STAGES[i].name : "랜덤";
      text(ctx, name, x + 90, y + 138, { size: 16, weight: 900, align: "center", color: on ? COLOR.gold : COLOR.paper });
    }
    const st = this.stageIdx < STAGES.length ? STAGES[this.stageIdx] : null;
    text(ctx, st ? st.en : "RANDOM STAGE", VIEW_W / 2, 488, { size: 22, font: FONT.arcade, weight: 400, align: "center", color: "#fff" });
    text(ctx, st ? st.desc : "어디서 싸우게 될지는 운명에 맡긴다.", VIEW_W / 2, 518, { size: 17, weight: 700, align: "center", color: COLOR.dim });
    if (this.mode === "cpu") {
      const d = DIFFICULTY[DIFFS[this.diff]];
      slant(ctx, VIEW_W / 2 - 150, 548, 300, 40, 8, "rgba(255,255,255,0.08)");
      text(ctx, `CPU 난이도  ◀ ${d.label} ▶`, VIEW_W / 2, 576, { size: 20, weight: 900, align: "center", color: ["#7af08f", "#ffd45a", "#ff7a5a", "#ff3a6a"][this.diff] });
      text(ctx, "↑↓ 난이도 변경", VIEW_W / 2, 608, { size: 14, weight: 700, align: "center", color: COLOR.dim });
    }
    text(ctx, "← → 선택 · 결정 키로 시작 · 취소로 돌아가기", VIEW_W / 2, 660, { size: 15, weight: 700, align: "center", color: COLOR.dim });
  }
}
