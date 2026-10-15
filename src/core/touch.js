// On-screen fight controls for touch devices: a floating stick on the left,
// action buttons on the right. Multi-touch aware.
import { VIEW_W, VIEW_H } from "../game/constants.js";

const BTNS = [
  { id: "L", label: "약", x: 1010, y: 610, r: 50, color: "#ffd45a" },
  { id: "H", label: "강", x: 1130, y: 560, r: 50, color: "#ff7a5a" },
  { id: "S", label: "기술", x: 1050, y: 480, r: 46, color: "#7af0ff" },
  { id: "X", label: "필살", x: 1180, y: 440, r: 42, color: "#ff7ad9" },
  { id: "G", label: "잡기", x: 915, y: 650, r: 36, color: "#c9b8ff" },
  { id: "U", label: "인수", x: 930, y: 530, r: 36, color: "#9cff8a" },
];

export class TouchControls {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.enabled = false;
    this.stick = null;
    this.buttons = new Map();
    this.pause = false;
    const canvas = app.canvas;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const d = app.view.dpr;
      return { x: ((e.clientX - r.left) * d - app.view.ox) / app.view.scale, y: ((e.clientY - r.top) * d - app.view.oy) / app.view.scale };
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      this.active = true;
      if (!this.enabled) return;
      const p = pos(e);
      if (p.x > VIEW_W - 90 && p.y > 112 && p.y < 190) {
        this.pause = true;
        return;
      }
      if (p.x < VIEW_W * 0.45) {
        this.stick = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
      } else {
        const b = this.hitButton(p);
        if (b) this.buttons.set(e.pointerId, b.id);
      }
      this.sync();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "touch" || !this.enabled) return;
      const p = pos(e);
      if (this.stick && this.stick.id === e.pointerId) {
        this.stick.x = p.x;
        this.stick.y = p.y;
        const dx = p.x - this.stick.ox;
        const dy = p.y - this.stick.oy;
        const d = Math.hypot(dx, dy);
        if (d > 90) {
          this.stick.ox = p.x - (dx / d) * 90;
          this.stick.oy = p.y - (dy / d) * 90;
        }
      } else if (this.buttons.has(e.pointerId)) {
        const b = this.hitButton(p);
        if (b) this.buttons.set(e.pointerId, b.id);
      }
      this.sync();
    });
    const end = (e) => {
      if (e.pointerType !== "touch") return;
      if (this.stick && this.stick.id === e.pointerId) this.stick = null;
      this.buttons.delete(e.pointerId);
      this.sync();
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }

  hitButton(p) {
    let best = null;
    let bd = Infinity;
    for (const b of BTNS) {
      if (b.id === "U" && !this.showSteal) continue;
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < b.r + 26 && d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  sync() {
    const s = this.app.input.touchState;
    for (const k of Object.keys(s)) s[k] = false;
    if (this.stick) {
      const dx = this.stick.x - this.stick.ox;
      const dy = this.stick.y - this.stick.oy;
      s.left = dx < -28;
      s.right = dx > 28;
      s.up = dy < -40;
      s.down = dy > 34;
    }
    for (const id of this.buttons.values()) {
      if (id === "U") {
        s.up = true;
        s.S = true;
      } else s[id] = true;
    }
  }

  consumePause() {
    const p = this.pause;
    this.pause = false;
    return p;
  }

  draw(ctx, showSteal) {
    this.showSteal = showSteal;
    if (!this.enabled || !this.active) return;
    ctx.save();
    ctx.globalAlpha = 0.85;
    // stick
    const st = this.stick;
    const bx = st ? st.ox : 190;
    const by = st ? st.oy : 560;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, by, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(st ? st.x : bx, st ? st.y : by, 40, 0, Math.PI * 2);
    ctx.fill();
    const pressed = new Set(this.buttons.values());
    for (const b of BTNS) {
      if (b.id === "U" && !showSteal) continue;
      const on = pressed.has(b.id);
      ctx.fillStyle = on ? b.color : "rgba(10,6,18,0.55)";
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = on ? "#16111d" : "#fff";
      ctx.font = `900 ${b.r > 40 ? 24 : 18}px "Noto Sans KR", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, b.x, b.y + 1);
    }
    // pause button
    ctx.fillStyle = "rgba(10,6,18,0.6)";
    ctx.beginPath();
    ctx.arc(VIEW_W - 46, 150, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(VIEW_W - 55, 138, 6, 24);
    ctx.fillRect(VIEW_W - 43, 138, 6, 24);
    ctx.restore();
  }
}
