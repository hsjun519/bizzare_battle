// 워런 버핏 — 기다림과 복리의 오마하 현인.
import { keyframes, shape, circle, ellipse, line, OUT, headBase, eyes, brows, mouth, ear, nose, rr, handFrame } from "../render/rig.js";
import { P } from "../render/poses.js";
import { ease } from "../core/util.js";
import { hit, castAnim, shoot, glow, burst, worldText } from "./kit.js";

const C = {
  skin: "#f3c9b1",
  shade: "#d8a68d",
  hair: "#f4f2ec",
  hairShade: "#cfc9bd",
  suit: "#5f6672",
  suitDark: "#4a505b",
  shirt: "#f7f5f0",
  tie: "#c3313f",
  shoe: "#5a3a26",
  frame: "#141414",
  gold: "#f2c94c",
  cola: "#b8102e",
};

function head(ctx, R, face) {
  headBase(ctx, R, C.skin, C.shade, { wide: 1 });
  ear(ctx, -8, 8, C.skin, C.shade);
  // thin white hair, side part
  shape(ctx, [[26, -30], [18, -46, -6, -46], [-30, -44, -44, -22], [-48, -2, -42, 8], [-36, -4], [-30, -26, -8, -36], [10, -38, 26, -30]], C.hair, OUT, 4);
  ctx.strokeStyle = C.hairShade;
  ctx.lineWidth = 2;
  line(ctx, [[14, -40], [-12, -42]]);
  // forehead lines
  ctx.strokeStyle = "rgba(150,90,70,0.45)";
  ctx.lineWidth = 2;
  line(ctx, [[8, -22], [28, -24]]);
  line(ctx, [[10, -16], [26, -17]]);
  // bushy brows: dark edge then white fill
  brows(ctx, face, 13, 32, 0, OUT, 9, 2);
  brows(ctx, face, 13, 32, 0, "#ebe7dc", 5.5, 2);
  eyes(ctx, face, 13, 32, 1);
  rr(ctx, 1, -10, 24, 20, 6, "rgba(200,230,255,0.18)", C.frame, 5);
  rr(ctx, 27, -10, 17, 20, 6, "rgba(200,230,255,0.18)", C.frame, 5);
  ctx.strokeStyle = C.frame;
  ctx.lineWidth = 4;
  line(ctx, [[24, -3], [28, -3]]);
  line(ctx, [[1, -4], [-8, 0]]);
  nose(ctx, 43, 9, 1.3, "#efb39b", C.shade);
  ctx.fillStyle = "rgba(255,120,110,0.3)";
  ctx.beginPath();
  ctx.ellipse(20, 18, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  mouth(ctx, face, 28, 27, { smile: true, w: 16 });
}

function torso(ctx, w, top) {
  shape(ctx, [[w * 0.04, top + 2], [w * 0.38, top + 4], [w * 0.24, top + 36]], C.shirt, OUT, 3);
  shape(ctx, [[w * 0.2, top + 8], [w * 0.28, top + 8], [w * 0.31, top + 42], [w * 0.24, top + 52], [w * 0.17, top + 42]], C.tie, OUT, 3);
  ctx.strokeStyle = C.suitDark;
  ctx.lineWidth = 4;
  line(ctx, [[w * 0.02, top + 4], [w * 0.2, top + 40], [w * 0.22, -8]]);
  ctx.fillStyle = OUT;
  for (const y of [top + 50, top + 62]) {
    ctx.beginPath();
    ctx.arc(w * 0.32, y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  shape(ctx, [[-w * 0.3, top + 30], [-w * 0.14, top + 30], [-w * 0.18, top + 38]], C.shirt, null);
}

function propFront(ctx, J, p, opts) {
  const f = opts.fighter;
  if (!f) return;
  const can = (f.state === "attack" && f.moveId === "6S") || (f.state === "win" && f.char.id === "buffett");
  if (!can) return;
  const h = handFrame(J.armF);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.ang - Math.PI / 2 + (f.state === "attack" && f.mt < 12 ? Math.sin(f.mt * 1.6) * 0.5 : 0));
  rr(ctx, -10, -8, 20, 34, 4, C.cola, OUT, 3.5);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-8, 6, 16, 4);
  ctx.fillStyle = "#c9ccd2";
  ctx.fillRect(-8, -8, 16, 4);
  ctx.restore();
}

const style = {
  skin: C.skin,
  skinShade: C.shade,
  sleeve: C.suit,
  forearm: C.suit,
  cuff: C.shirt,
  top: C.suit,
  pants: C.suit,
  shoe: C.shoe,
  sole: "#2a1a10",
  torsoW: 60,
  head,
  torso,
  propFront,
};

// ------------------------------------------------------------ projectiles
function drawCoin(ctx, p) {
  const r = p.w / 2;
  const x = p.x;
  const y = -p.y;
  glow(ctx, x, y, r * 2.2, "#ffe07a", 0.5);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(p.age * 0.1) * 0.2);
  circle(ctx, 0, 0, r, C.gold, OUT, 4);
  circle(ctx, 0, 0, r * 0.74, "#ffe48a", "#c9971c", 2.5);
  ctx.fillStyle = "#a8780e";
  ctx.font = `900 ${Math.round(r * 1.1)}px Bungee, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", 0, 2);
  ctx.restore();
  const pct = Math.round((p.dmgMult - 1) * 100);
  if (pct > 0) worldText(ctx, `+${pct}%`, x, y - r - 16, 18, "#9cff8a");
}

function drawBull(ctx, p) {
  const dir = Math.sign(p.vx) || 1;
  const run = p.age * 0.6;
  ctx.save();
  ctx.translate(p.x, -p.y + 30);
  ctx.scale(dir * 1.1, 1.1);
  glow(ctx, 0, -30, 160, "#ffd45a", 0.35);
  const body = "#e7b43c";
  const dark = "#b9861f";
  // legs
  for (const [lx, ph] of [[-60, 0], [-36, Math.PI], [44, Math.PI / 2], [66, -Math.PI / 2]]) {
    const sw = Math.sin(run + ph) * 18;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    line(ctx, [[lx, 0], [lx + sw, 46]]);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 10;
    line(ctx, [[lx, 0], [lx + sw, 46]]);
  }
  ellipse(ctx, 0, -18, 96, 50, -0.06, body, OUT, 5);
  ellipse(ctx, -20, -40, 60, 18, -0.1, "#ffd76a", null);
  // head lowered with horns forward
  ellipse(ctx, 98, 2, 34, 28, 0.5, body, OUT, 5);
  shape(ctx, [[104, -18], [146, -40, 152, -10], [128, -14, 110, -6]], "#fff3d0", OUT, 4);
  shape(ctx, [[86, -20], [110, -56, 136, -46], [110, -38, 96, -12]], "#fff3d0", OUT, 4);
  circle(ctx, 112, 0, 4, OUT, null);
  ctx.fillStyle = "#ff6a3a";
  ctx.beginPath();
  ctx.arc(126, 18, 6, 0, Math.PI * 2);
  ctx.fill();
  // tail
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-94, -26);
  ctx.quadraticCurveTo(-130, -60 + Math.sin(run) * 10, -120, -90);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------ moves
const guardPose = { hip: [-4, -86], lean: -6, head: -4, hF: [24, -150], hB: [30, -138], fF: [24, 0], fB: [-30, 0], face: "block" };

const COUNTER_HIT = {
  id: "counterHit",
  name: "저점 매수 반격",
  kind: "special",
  hidden: true,
  frames: 36,
  startup: 4,
  invuln: [0, 10],
  noLimb: true,
  anim: keyframes([
    [0, { hip: [-6, -80], lean: -10, hF: [-20, -120], hB: [-30, -110], fF: [24, 0], fB: [-30, 0], face: "angry" }],
    [4, { hip: [18, -84], lean: 26, hF: [120, -150], hB: [70, -130], fF: [50, 0], fB: [-28, 0], face: "angry" }, ease.outCubic],
    [14, { hip: [18, -84], lean: 24, hF: [116, -150], hB: [70, -130], fF: [50, 0], fB: [-28, 0], face: "angry" }],
    [36, P.stance],
  ]),
  move: (t) => (t < 6 ? { vx: 8 } : { vx: 0 }),
  hits: [hit({ at: [4, 10], box: [0, 40, 140, 190], dmg: 115, launch: [7, 12], kd: true, spark: "s", stop: 16, tint: C.gold, unblockable: true, sfx: "hit_special" })],
  update(t, f, b) {
    if (t === 5) b.fx.debris(f.x + f.facing * 80, f.y + 140, 14, { shape: "bill", speed: 8, up: 4, g: 0.25, life: 60 });
  },
};

const moves = {
  S: {
    name: "복리 코인",
    desc: "느리지만 날아갈수록 커지고 강해진다. 최대 +130% 데미지.",
    kind: "special",
    frames: 44,
    startup: 15,
    anim: castAnim(15, 44, { throwPose: { ...P.cast, hF: [96, -128], hB: [60, -120] } }),
    hits: [],
    update(t, f, b) {
      if (t === 15) {
        shoot(f, b, {
          dx: 86,
          dy: 130,
          speed: 5.2,
          w: 30,
          h: 30,
          life: 220,
          dmgMult: 1,
          color: C.gold,
          hit: hit({ dmg: 46, chip: 7, stun: 20, bstun: 15, push: 5, spark: "s", stop: 9, tint: C.gold, sfx: "coin" }),
          update(p) {
            const k = Math.min(1, p.age / 130);
            const r = 15 + k * 22;
            p.w = p.h = r * 2;
            p.dmgMult = 1 + k * 1.3;
            p.strength = 1 + Math.floor(k * 2.2);
          },
          draw: drawCoin,
          onDie: (p, bb) => {
            burst(bb, p, C.gold, 10);
            bb.fx.debris(p.x, p.y, 8, { shape: "coin", speed: 6, up: 4, life: 40 });
          },
        });
        b.sfx("coin");
      }
    },
  },
  "6S": {
    name: "체리 콜라 샤워",
    desc: "흔든 콜라를 근거리에 뿌리는 다단 공격.",
    kind: "special",
    frames: 48,
    startup: 14,
    noLimb: true,
    anim: (t) => {
      if (t < 13) {
        const s = Math.sin(t * 1.6) * 10;
        return { ...P.stance, hF: [56, -150 + s], hB: [40, -132], lean: 2, face: "happy" };
      }
      if (t < 36) return { hip: [8, -86], lean: 12, hF: [96, -150], hB: [30, -130], fF: [36, 0], fB: [-28, 0], face: "angry" };
      return keyframes([[36, { hip: [8, -86], lean: 12, hF: [96, -150], hB: [30, -130], fF: [36, 0], fB: [-28, 0] }], [48, P.stance]])(t);
    },
    hits: [hit({ at: [14, 34], box: [40, 92, 160, 90], every: 4, max: 5, dmg: 15, chip: 3, stun: 15, bstun: 10, push: 1.6, spark: "l", stop: 4, tint: "#ff4d6d" })],
    update(t, f, b) {
      if (t === 13) b.sfx("soda");
      if (t >= 14 && t < 34) {
        b.fx.debris(f.x + f.facing * 100, f.y + 152, 3, { shape: "circle", angle: f.facing > 0 ? 0.05 : Math.PI - 0.05, spread: 0.45, speed: 13, g: 0.18, color: ["#ff4d6d", "#ffd0d8", "#c3002f", "#ffffff"], size: 4.5, life: 18, floor: false });
      }
    },
  },
  "2S": {
    name: "가치 투자 (저점 매수)",
    desc: "받아치기 자세. 타격은 강력한 반격으로, 투사체는 게이지로 '편입'한다.",
    kind: "special",
    frames: 42,
    startup: 3,
    anim: keyframes([[0, P.stance], [3, guardPose, ease.outQuad], [28, guardPose], [42, P.stance]]),
    hits: [],
    counter: {
      at: [3, 28],
      proj: true,
      on(f, att, h, b, src) {
        if (src.proj) {
          b.killProjectile(src.proj, true);
          f.gainMeter(18);
          b.fx.text(f.x, f.y + 260, "자산 편입!", C.gold, 32, 44);
          b.fx.debris(f.x, f.y + 150, 8, { shape: "coin", speed: 6, up: 5, life: 40 });
          b.sfx("coin");
          f.mt = 30;
          return;
        }
        b.hitstop = Math.max(b.hitstop, 14);
        b.flashScreen(C.gold, 6, 0.4);
        b.fx.text(f.x, f.y + 270, "BUY THE DIP!", C.gold, 40, 50);
        b.fx.spark(f.x + f.facing * 40, f.y + 140, "armor", f.facing);
        b.sfx("parry");
        f.startMove(COUNTER_HIT);
      },
    },
  },
  counterHit: COUNTER_HIT,
  X: {
    name: "월가의 황소",
    desc: "황금 황소가 화면을 질주하며 들이받는다.",
    kind: "super",
    frames: 70,
    startup: 14,
    line: "남들이 두려워할 때 욕심을 내라.",
    anim: keyframes([
      [0, P.stance],
      [10, { hip: [0, -88], lean: -8, head: -10, hF: [60, -220], hB: [-50, -190], fF: [28, 0], fB: [-28, 0], face: "happy" }, ease.outQuad],
      [58, { hip: [0, -88], lean: -8, head: -10, hF: [60, -220], hB: [-50, -190], fF: [28, 0], fB: [-28, 0], face: "happy" }],
      [70, P.stance],
    ]),
    hits: [],
    update(t, f, b) {
      if (t === 14) {
        const final = hit({ dmg: 72, chip: 10, launch: [10, 14], kd: true, spark: "super", stop: 16, bstun: 18 });
        b.spawn({
          owner: f,
          x: f.x - f.facing * 220,
          y: 90,
          vx: f.facing * 15,
          w: 220,
          h: 160,
          life: 150,
          hits: 5,
          every: 6,
          super: true,
          strength: 99,
          homable: false,
          hit: hit({ dmg: 50, chip: 9, stun: 26, bstun: 18, push: 3, spark: "h", stop: 5 }),
          onHit(p) {
            if (p.hitsLeft === 1) p.hit = final;
          },
          update(p, bb) {
            if (p.age % 3 === 0) bb.fx.dust(p.x - Math.sign(p.vx) * 100, 0, 2, "#e8c27a");
            if (p.age % 8 === 0) bb.fx.debris(p.x, p.y + 60, 1, { shape: "coin", speed: 4, up: 6, life: 40 });
          },
          draw: drawBull,
        });
        b.sfx("bull");
        b.shake(8);
      }
    },
  },
};

export default {
  id: "buffett",
  name: "워런 버핏",
  short: "BUFFETT",
  en: "WARREN BUFFETT",
  title: "오마하의 현인",
  faction: "capital",
  color: C.gold,
  colorB: "#3a2e10",
  quote: "좋은 한 방은 기다림에서 온다.",
  bio: "느긋해 보여도 모든 공격이 투자다. 시간이 갈수록 불어나는 복리 코인, 공격을 받아치는 저점 매수, 그리고 월가를 짓밟는 황소.",
  winQuotes: ["가격은 당신이 내는 것, 가치는 내가 얻는 것.", "썰물이 빠지면 누가 맨몸인지 보이죠.", "10년 보유할 게 아니면 10초도 싸우지 마세요.", "콜라 한 잔 하시겠어요?"],
  stats: { power: 4, speed: 2, range: 4, tech: 4 },
  health: 1050,
  walk: 3.6,
  back: 3.0,
  dash: 10,
  scale: 0.98,
  passive: { name: "복리의 마법", desc: "콤보가 길어져도 데미지 감소가 덜하다. (최저 보정 50%)" },
  style,
  hooks: { scaleFloor: 0.5, scaleStep: 0.06 },
  moves,
  ai: { zoner: true, projectile: "S", antiAir: "2H", counter: "2S", rush: "6S", range: 380 },
};
