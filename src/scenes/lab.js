// Developer gallery (#lab): every fighter in a set of key poses.
import { ROSTER } from "../chars/index.js";
import { P, ANIM, NORMAL_ANIMS } from "../render/poses.js";
import { drawFighterAt, text, FONT } from "../render/ui.js";
import { getStage } from "../render/stages.js";
import { VIEW_W, VIEW_H } from "../game/constants.js";

export class LabScene {
  constructor(app) {
    this.app = app;
    this.idx = 0;
    this.t = 0;
  }
  update() {
    this.t++;
    const m = this.app.input.menu();
    if (m.right) this.idx = (this.idx + 1) % ROSTER.length;
    if (m.left) this.idx = (this.idx + ROSTER.length - 1) % ROSTER.length;
  }
  draw(view) {
    const ctx = view.ctx;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    const st = getStage("agora");
    st.drawBack(ctx, { x: 950, y: 0, zoom: 1, sx: 0, sy: 0 }, this.t, view, null);
    const c = ROSTER[this.idx];
    const poses = [
      ["idle", ANIM.idle(this.t)],
      ["walk", ANIM.walk(this.t, 1)],
      ["crouch", P.crouch],
      ["jab", NORMAL_ANIMS.jab(6)],
      ["kick", NORMAL_ANIMS.kick(10)],
      ["upper", NORMAL_ANIMS.uppercut(10)],
      ["block", P.blockHigh],
      ["hurt", P.hurtHigh],
      ["air", P.air],
      ["lying", P.lying],
      ["win", ANIM.win(this.t)],
      ["S", c.moves.S.anim(14, null)],
    ];
    poses.forEach(([name, p], i) => {
      const x = 110 + (i % 6) * 210;
      const y = i < 6 ? 330 : 660;
      drawFighterAt(ctx, c, x, y, 0.95, 1, p, p.face, this.t);
      text(ctx, name, x, y + 26, { size: 16, align: "center", color: "#fff", stroke: "#000", sw: 4 });
    });
    text(ctx, `${c.name} (${this.idx + 1}/${ROSTER.length})  ← →`, VIEW_W / 2, 40, { size: 30, font: FONT.title, weight: 400, align: "center", stroke: "#000", sw: 6 });
  }
}
