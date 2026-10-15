// Command list overlay for a character (usable from pause, select and guide).
import { VIEW_W, VIEW_H } from "../game/constants.js";
import { text, FONT, COLOR, panel, slant, portrait, wrap, keycap } from "../render/ui.js";
import { INPUT_LABEL, finalizeMoves } from "../game/moves.js";
import { KEY_HELP } from "../core/input.js";

const ORDER_SPECIAL = ["S", "6S", "2S", "X"];
const ORDER_NORMAL = ["L", "H", "6H", "2L", "2H", "jL", "jH", "throw"];

export class MoveList {
  constructor(app, char) {
    this.app = app;
    this.char = char;
    this.moves = finalizeMoves(char);
    this.t = 0;
  }

  update() {
    this.t++;
    const m = this.app.input.menu();
    const p = this.app.input.pointer;
    if (this.t > 2 && (m.back || m.start || m.confirm || p.released)) {
      this.app.audio.play("ui_back");
      return true;
    }
    return false;
  }

  draw(ctx) {
    const c = this.char;
    ctx.fillStyle = "rgba(6,4,12,0.88)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(ctx, 40, 30, VIEW_W - 80, VIEW_H - 60, { fill: "rgba(18,12,30,0.96)", stroke: c.color, lw: 3, r: 20 });
    portrait(ctx, c, 64, 52, 110, 110, { bg: c.color, zoom: 1.6, face: "angry" });
    text(ctx, c.name, 196, 96, { size: 44, font: FONT.title, weight: 400, color: "#fff" });
    text(ctx, `${c.en} · ${c.title}`, 198, 128, { size: 16, weight: 700, color: c.color });
    text(ctx, `특성 · ${c.passive.name}`, 198, 156, { size: 15, weight: 900, color: COLOR.gold });
    text(ctx, c.passive.desc, 330, 156, { size: 15, weight: 500, color: COLOR.paper, maxW: 520 });

    let y = 206;
    text(ctx, "기술 · 필살기", 70, y, { size: 18, font: FONT.arcade, weight: 400, color: c.color });
    y += 14;
    for (const id of ORDER_SPECIAL) {
      const m = this.moves[id];
      if (!m) continue;
      y += 40;
      slant(ctx, 64, y - 28, 600, 38, 6, id === "X" ? "rgba(255,212,90,0.14)" : "rgba(255,255,255,0.05)");
      text(ctx, m.name, 84, y - 2, { size: 19, weight: 900, color: id === "X" ? COLOR.gold : "#fff", maxW: 260 });
      text(ctx, INPUT_LABEL[id], 360, y - 2, { size: 16, weight: 800, color: c.color, maxW: 180 });
      if (m.desc) text(ctx, m.desc, 84, y + 16, { size: 13, weight: 500, color: COLOR.dim, maxW: 560 });
      if (m.desc) y += 14;
    }
    // signature system reminder
    y += 52;
    panel(ctx, 64, y - 30, 600, 92, { fill: "rgba(122,240,255,0.08)", stroke: "rgba(122,240,255,0.4)", r: 10 });
    text(ctx, c.faction === "philosophy" ? "시그니처 · 논파 (REFUTE)" : "시그니처 · 인수 (ACQUIRE)", 84, y - 4, { size: 17, weight: 900, color: "#7af0ff" });
    wrap(ctx, "상대 기술이 맞기 직전 뒤 방향을 '탭'하면 저스트 가드. 상대의 필살 기술이었다면 빼앗아 ↑+기술로 쓸 수 있고, 상대는 그 기술이 잠긴다.", 84, y + 20, 570, 20, { size: 14, weight: 500, color: COLOR.paper });

    // normals column
    let ny = 206;
    text(ctx, "기본기", 720, ny, { size: 18, font: FONT.arcade, weight: 400, color: c.color });
    ny += 8;
    for (const id of ORDER_NORMAL) {
      const m = this.moves[id];
      if (!m) continue;
      ny += 34;
      text(ctx, m.name, 724, ny, { size: 16, weight: 800, color: "#fff" });
      text(ctx, INPUT_LABEL[id], 900, ny, { size: 14, weight: 700, color: c.color });
      const dmg = m.hits[0]?.dmg || "";
      text(ctx, `${m.startup}F${dmg ? " · " + dmg : ""}`, 1196, ny, { size: 13, weight: 700, align: "right", color: COLOR.dim });
    }
    ny += 40;
    text(ctx, "앞 앞 / 뒤 뒤 : 대시 · 백대시", 724, ny, { size: 14, weight: 700, color: COLOR.dim });
    text(ctx, "↓+강 적중 시 ↑ : 하이 점프 추격", 724, ny + 24, { size: 14, weight: 700, color: COLOR.dim });
    text(ctx, "뒤로 누르기 : 가드 (하단은 ↙)", 724, ny + 48, { size: 14, weight: 700, color: COLOR.dim });

    const k = this.app.input.layout === "versus" ? KEY_HELP.p1 : KEY_HELP.solo;
    let kx = 70;
    const ky = VIEW_H - 54;
    for (const [lab, key] of [["약", k.L], ["강", k.H], ["기술", k.S], ["필살", k.X], ["잡기", k.G]]) {
      text(ctx, lab, kx, ky, { size: 15, weight: 900, color: COLOR.dim });
      kx += lab.length * 16 + 8;
      kx += keycap(ctx, key, kx, ky, { size: 15 }) + 22;
    }
    text(ctx, "아무 키나 눌러 닫기", VIEW_W - 70, ky, { size: 15, weight: 700, align: "right", color: COLOR.dim });
  }
}
