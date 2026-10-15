// How to play: controls, fundamentals and the two signature systems.
import { VIEW_W, VIEW_H } from "../game/constants.js";
import { text, FONT, COLOR, slant, panel, keycap, wrap, drawFighterAt, portrait } from "../render/ui.js";
import { P, ANIM } from "../render/poses.js";
import { PARADIGMS } from "../game/paradigms.js";
import { ROSTER, charById } from "../chars/index.js";
import { MoveList } from "./movelist.js";
import { Flow } from "./flow.js";
import { rgba } from "../core/util.js";

const PAGES = ["조작법", "기본 시스템", "시그니처 ① 논파·인수", "시그니처 ② 패러다임 시프트", "캐릭터 기술표"];

export class GuideScene {
  constructor(app) {
    this.app = app;
    this.page = 0;
    this.t = 0;
    this.charIdx = 0;
    this.moveList = null;
  }

  enter() {
    this.app.input.setLayout("solo");
  }

  update() {
    this.t++;
    if (this.moveList) {
      if (this.moveList.update()) this.moveList = null;
      return;
    }
    const m = this.app.input.menu();
    const p = this.app.input.pointer;
    if (this.page === 4) {
      if (m.up) this.charIdx = (this.charIdx + ROSTER.length - 4) % ROSTER.length;
      if (m.down) this.charIdx = (this.charIdx + 4) % ROSTER.length;
      if (m.confirm) this.moveList = new MoveList(this.app, ROSTER[this.charIdx]);
      ROSTER.forEach((c, i) => {
        const x = 220 + (i % 4) * 220;
        const y = 210 + Math.floor(i / 4) * 230;
        if (p.x > x && p.x < x + 180 && p.y > y && p.y < y + 200) {
          if (p.moved) this.charIdx = i;
          if (p.released) this.moveList = new MoveList(this.app, c);
        }
      });
    }
    const prev = m.left && (this.page !== 4 || this.charIdx % 4 === 0);
    const next = m.right && (this.page !== 4 || this.charIdx % 4 === 3);
    if (this.page === 4 && m.left && !prev) this.charIdx--;
    if (this.page === 4 && m.right && !next) this.charIdx++;
    if (prev || (p.released && p.x < 120 && p.y > 300 && p.y < 420)) this.turn(-1);
    if (next || (p.released && p.x > VIEW_W - 120 && p.y > 300 && p.y < 420)) this.turn(1);
    if (m.back || m.start) {
      this.app.audio.play("ui_back");
      Flow.title(this.app, { skipPress: true });
    }
  }

  turn(d) {
    this.page = (this.page + d + PAGES.length) % PAGES.length;
    this.t = 0;
    this.app.audio.play("ui_move");
  }

  draw(view) {
    const ctx = view.ctx;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, "#15102a");
    g.addColorStop(1, "#07050c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, "PLAY GUIDE", 60, 70, { size: 34, font: FONT.arcade, weight: 400, color: COLOR.gold });
    PAGES.forEach((name, i) => {
      const x = 330 + i * 186;
      const on = i === this.page;
      slant(ctx, x, 40, 178, 40, 8, on ? COLOR.gold : "rgba(255,255,255,0.07)");
      text(ctx, name, x + 89, 66, { size: 14, weight: 900, align: "center", color: on ? COLOR.ink : COLOR.paper, maxW: 160 });
    });
    [this.pageControls, this.pageBasics, this.pageSteal, this.pageParadigm, this.pageChars][this.page].call(this, ctx);
    text(ctx, "◀", 50, 380, { size: 40, weight: 900, align: "center", color: COLOR.dim });
    text(ctx, "▶", VIEW_W - 50, 380, { size: 40, weight: 900, align: "center", color: COLOR.dim });
    text(ctx, "← → 페이지 · K/Esc 돌아가기", VIEW_W / 2, VIEW_H - 20, { size: 15, weight: 700, align: "center", color: COLOR.dim });
    if (this.moveList) this.moveList.draw(ctx);
  }

  keyRow(ctx, x, y, label, keys) {
    text(ctx, label, x, y, { size: 17, weight: 800, color: COLOR.paper });
    let kx = x + 130;
    for (const k of keys) kx += keycap(ctx, k, kx, y, { size: 16 }) + 8;
  }

  pageControls(ctx) {
    panel(ctx, 100, 120, 520, 470, { r: 16 });
    text(ctx, "혼자 할 때 (1P)", 130, 165, { size: 22, font: FONT.title, weight: 400, color: COLOR.gold });
    const rows = [
      ["이동 / 점프 / 앉기", ["W A S D", "방향키"]],
      ["약 공격", ["J", "Z"]],
      ["강 공격", ["K", "X"]],
      ["기술", ["L", "C"]],
      ["필살기", ["I", "V"]],
      ["잡기", ["U", "B", "약+강"]],
      ["가드", ["상대 반대 방향"]],
      ["일시정지", ["ESC", "P"]],
    ];
    rows.forEach(([l, k], i) => this.keyRow(ctx, 130, 215 + i * 44, l, k));
    text(ctx, "M 키로 소리 끄기/켜기", 130, 570, { size: 15, weight: 700, color: COLOR.dim });
    panel(ctx, 660, 120, 520, 470, { r: 16 });
    text(ctx, "둘이 할 때 (2P 대전)", 690, 165, { size: 22, font: FONT.title, weight: 400, color: COLOR.gold });
    const r1 = [
      ["1P 이동", ["W A S D"]],
      ["1P 약·강·기술", ["F", "G", "H"]],
      ["1P 필살·잡기", ["T", "R"]],
      ["2P 이동", ["방향키"]],
      ["2P 약·강·기술", [",", ".", "/"]],
      ["2P 필살·잡기", [";", "'"]],
      ["2P (넘패드)", ["1", "2", "3", "5", "4"]],
    ];
    r1.forEach(([l, k], i) => this.keyRow(ctx, 690, 215 + i * 44, l, k));
    wrap(ctx, "게임패드: X 약 · Y 강 · B 기술 · RB 필살 · LB 잡기 · A 점프. 터치: 왼쪽 스틱 + 오른쪽 버튼.", 690, 530, 460, 22, { size: 15, weight: 600, color: COLOR.dim });
  }

  pageBasics(ctx) {
    const items = [
      ["가드", "상대 반대 방향을 누르고 있으면 막는다. 하단 공격은 ↙(앉아 가드), 점프 공격·내려찍기는 서서 막아야 한다."],
      ["콤보", "약 → 약 → 강 → 기술 처럼 이어진다. 적중 시 기술을 입력하면 캔슬된다. 히트 수가 늘수록 데미지는 줄어든다."],
      ["띄우기", "↓+강 어퍼로 상대를 띄우고, 적중 순간 ↑를 누르면 하이 점프로 추격해 공중 콤보를 넣을 수 있다."],
      ["잡기", "약+강 동시(또는 잡기 키). 가드를 무시한다. 잡혔을 때 바로 약+강을 누르면 풀어낸다(TECH)."],
      ["대시", "앞으로 두 번: 대시, 뒤로 두 번: 무적 백대시."],
      ["필살기 게이지", "때리거나 맞으면 찬다. 가득 차면 필살 키로 화면을 멈추는 슈퍼 필살기를 쓴다."],
      ["카운터", "상대가 공격을 내미는 순간 때리면 COUNTER! 데미지와 경직이 늘어난다."],
    ];
    items.forEach(([h, d], i) => {
      const y = 140 + i * 74;
      slant(ctx, 110, y - 4, 200, 40, 8, "rgba(255,212,90,0.15)");
      text(ctx, h, 130, y + 24, { size: 22, font: FONT.title, weight: 400, color: COLOR.gold });
      wrap(ctx, d, 340, y + 12, 820, 24, { size: 17, weight: 600, color: COLOR.paper });
    });
  }

  pageSteal(ctx) {
    text(ctx, "논파 · 인수  REFUTE & ACQUIRE", VIEW_W / 2, 140, { size: 36, font: FONT.title, weight: 400, align: "center", color: "#7af0ff" });
    wrap(ctx, "이 게임의 핵심 시스템. 상대의 필살 기술이 맞기 직전, 뒤 방향을 '새로 탭'하면 저스트 가드가 발동한다. 철학자는 \"논파!\", 자본가는 \"인수!\"를 외친다.", 150, 186, 980, 28, { size: 19, weight: 600, color: COLOR.paper });
    const steps = [
      ["1", "상대가 기술을 쓴다", "투사체든 돌진기든, '기술' 버튼으로 나가는 필살 기술이 대상이다."],
      ["2", "맞기 직전 뒤를 탭", "9프레임(약 0.15초) 안에 뒤 방향을 새로 누른다. 그냥 누르고만 있으면 안 된다."],
      ["3", "기술을 빼앗는다", "칩 데미지 없이 막고, 게이지를 얻고, 그 기술이 10초간 내 것이 된다."],
      ["4", "↑ + 기술로 사용", "내 캐릭터가 상대의 기술을 쓴다. 상대는 쓰는 순간까지 그 기술이 잠긴다."],
    ];
    steps.forEach(([n, h, d], i) => {
      const x = 110 + i * 270;
      panel(ctx, x, 270, 250, 230, { fill: "rgba(122,240,255,0.07)", stroke: "rgba(122,240,255,0.35)", r: 14 });
      text(ctx, n, x + 24, 330, { size: 50, font: FONT.arcade, weight: 400, color: "#7af0ff" });
      text(ctx, h, x + 70, 322, { size: 20, weight: 900, color: "#fff", maxW: 170 });
      wrap(ctx, d, x + 22, 370, 210, 24, { size: 15, weight: 600, color: COLOR.paper });
    });
    const s = charById("socrates");
    const h = charById("huang");
    drawFighterAt(ctx, h, 380, 690, 0.62, 1, { ...P.cast, face: "angry" }, "angry", this.t);
    drawFighterAt(ctx, s, 900, 690, 0.62, -1, { ...P.blockHigh }, "block", this.t);
    text(ctx, "→ 텐서 코어 칩 →", 640, 610, { size: 22, weight: 900, align: "center", color: "#b8ff4a" });
    if (Math.floor(this.t / 20) % 2) text(ctx, "논파!", 900, 540, { size: 40, font: FONT.title, weight: 400, align: "center", color: "#9ad8ff", stroke: COLOR.ink, sw: 6 });
    text(ctx, "→ 소크라테스가 GPU 칩을 던질 수 있게 된다", 640, 650, { size: 16, weight: 700, align: "center", color: COLOR.dim });
  }

  pageParadigm(ctx) {
    text(ctx, "패러다임 시프트  PARADIGM SHIFT", VIEW_W / 2, 140, { size: 34, font: FONT.title, weight: 400, align: "center", color: COLOR.gold });
    wrap(ctx, "라운드 시작 15초 뒤, 철학과 경제의 '법칙 카드' 한 장이 뒤집힌다. 그 라운드가 끝날 때까지 두 사람 모두에게 똑같이 적용된다. 매 라운드 다른 법칙이 나온다. (설정에서 끌 수 있음)", 150, 178, 980, 26, { size: 17, weight: 600, color: COLOR.paper });
    const seen = this.app.save.records.paradigms || [];
    PARADIGMS.forEach((r, i) => {
      const x = 110 + (i % 4) * 268;
      const y = 250 + Math.floor(i / 4) * 210;
      const found = seen.includes(r.id);
      panel(ctx, x, y, 250, 190, { fill: rgba(r.color, 0.08), stroke: rgba(r.color, found ? 0.8 : 0.3), r: 14 });
      text(ctx, r.name, x + 18, y + 42, { size: 26, font: FONT.title, weight: 400, color: r.color });
      text(ctx, r.en, x + 18, y + 64, { size: 11, font: FONT.arcade, weight: 400, color: COLOR.dim });
      wrap(ctx, r.desc, x + 18, y + 94, 214, 22, { size: 14, weight: 600, color: COLOR.paper });
      text(ctx, found ? "✓ 경험함" : "미발견", x + 232, y + 176, { size: 13, weight: 800, align: "right", color: found ? r.color : COLOR.dim });
    });
  }

  pageChars(ctx) {
    text(ctx, "캐릭터를 골라 기술표를 확인하세요", VIEW_W / 2, 160, { size: 22, weight: 800, align: "center", color: COLOR.paper });
    ROSTER.forEach((c, i) => {
      const x = 220 + (i % 4) * 220;
      const y = 210 + Math.floor(i / 4) * 230;
      const on = i === this.charIdx;
      portrait(ctx, c, x, y, 180, 160, { bg: on ? c.color : rgba(c.color, 0.3), zoom: 1.5, face: on ? "angry" : "normal" });
      if (on) {
        ctx.strokeStyle = COLOR.gold;
        ctx.lineWidth = 5;
        ctx.strokeRect(x - 3, y - 3, 186, 166);
      }
      text(ctx, c.name, x + 90, y + 190, { size: 20, weight: 900, align: "center", color: on ? COLOR.gold : "#fff" });
    });
  }
}
