// 젠슨 황 — 가죽 재킷의 GPU 군주.
import { keyframes, shape, circle, ellipse, line, OUT, headBase, eyes, brows, mouth, ear, nose, rr, handFrame } from "../render/rig.js";
import { P } from "../render/poses.js";
import { ease } from "../core/util.js";
import { hit, castAnim, shoot, glow, worldText, burst } from "./kit.js";

const C = {
  skin: "#e9b591",
  shade: "#c88d69",
  hair: "#c6cad2",
  hairDark: "#8c929c",
  jacket: "#2b2b33",
  jacketHi: "#5a5a6a",
  tee: "#141418",
  jeans: "#2c3346",
  shoe: "#141418",
  frame: "#16161a",
  green: "#76b900",
  lime: "#b8ff4a",
};

function head(ctx, R, face) {
  shape(ctx, [[-4, -38], [-34, -42, -46, -16], [-52, 8, -38, 24], [-30, 10], [-18, -18]], C.hair, OUT, 4);
  headBase(ctx, R, C.skin, C.shade);
  ear(ctx, -10, 6, C.skin, C.shade);
  shape(ctx, [[34, -22], [38, -44, 14, -50], [-14, -56, -40, -40], [-50, -24, -46, -4], [-36, -10], [-26, -22, -6, -28], [16, -32, 34, -22]], C.hair, OUT, 4);
  ctx.strokeStyle = C.hairDark;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  for (const [a, b, c, d] of [[20, -40, -20, -46], [10, -34, -28, -36], [-8, -48, -38, -26]]) {
    ctx.beginPath();
    ctx.moveTo(a, b);
    ctx.quadraticCurveTo((a + c) / 2, Math.min(b, d) - 6, c, d);
    ctx.stroke();
  }
  brows(ctx, face, 14, 32, -1, C.hairDark, 4);
  eyes(ctx, face, 14, 32, -1);
  ctx.fillStyle = "rgba(170,220,255,0.22)";
  rr(ctx, 3, -11, 21, 16, 4, "rgba(170,220,255,0.22)", C.frame, 3.5);
  rr(ctx, 26, -11, 15, 16, 4, "rgba(170,220,255,0.22)", C.frame, 3.5);
  ctx.strokeStyle = C.frame;
  ctx.lineWidth = 3;
  line(ctx, [[24, -5], [26, -5]]);
  line(ctx, [[3, -6], [-8, -2]]);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  line(ctx, [[7, -8], [12, -8]]);
  nose(ctx, 41, 7, 1, C.skin, C.shade);
  mouth(ctx, face, 26, 22, { smile: true, w: 16 });
}

function jacketTorso(ctx, w, top) {
  shape(ctx, [[w * 0.14, top + 6], [w * 0.42, top + 8], [w * 0.44, -6], [w * 0.2, -4]], C.tee, OUT, 3);
  shape(ctx, [[w * 0.0, top + 2], [w * 0.3, top + 2], [w * 0.2, top + 26]], C.jacketHi, OUT, 3);
  ctx.strokeStyle = "#b8bcc4";
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  line(ctx, [[w * 0.2, top + 26], [w * 0.22, -6]]);
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-w * 0.34, top + 18);
  ctx.quadraticCurveTo(-w * 0.42, top + 40, -w * 0.3, -16);
  ctx.stroke();
  ctx.fillStyle = "#1c1c22";
  ctx.fillRect(-w * 0.42, -12, w * 0.86, 6);
}

function teeTorso(ctx, w, top) {
  ctx.fillStyle = C.green;
  ctx.font = "900 13px Bungee, sans-serif";
  ctx.save();
  ctx.translate(w * 0.06, top + 34);
  ctx.fillRect(-9, -7, 18, 14);
  ctx.fillStyle = C.tee;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Fan blades spin around the fist during the cooling-fan uppercut.
function propFront(ctx, J, p, opts) {
  const f = opts.fighter;
  if (!f || f.state !== "attack" || f.moveId !== "2S" || f.mt < 3 || f.mt > 30) return;
  const h = handFrame(J.armF);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(f.b.realFrame * 0.9);
  for (let i = 0; i < 5; i++) {
    ctx.rotate((Math.PI * 2) / 5);
    shape(ctx, [[0, 0], [30, -14, 44, 4], [24, 8, 0, 0]], "#9fe04a", OUT, 3);
  }
  circle(ctx, 0, 0, 9, "#3a3f44", OUT, 3);
  ctx.restore();
  glow(ctx, h.x, h.y, 60, C.lime, 0.35);
}

const style = {
  skin: C.skin,
  skinShade: C.shade,
  sleeve: C.jacket,
  forearm: C.jacket,
  cuff: "#3d3d48",
  top: C.jacket,
  pants: C.jeans,
  shoe: C.shoe,
  torsoW: 54,
  head,
  torso: jacketTorso,
  propFront,
};

const teeStyle = { ...style, sleeve: C.tee, forearm: C.skin, cuff: null, top: C.tee, torso: teeTorso };

// ------------------------------------------------------------ projectiles
function drawChip(ctx, p) {
  const x = p.x;
  const y = -p.y;
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = 0.15 * (4 - i);
    ctx.fillStyle = C.green;
    ctx.fillRect(x - p.vx * i * 2.2 - 16, y - 16, 32, 32);
  }
  ctx.globalAlpha = 1;
  glow(ctx, x, y, 54, C.lime, 0.5);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(p.age * 0.2) * 0.25);
  ctx.fillStyle = "#e7c35a";
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(i * 7 - 2, -27, 4, 8);
    ctx.fillRect(i * 7 - 2, 19, 4, 8);
    ctx.fillRect(-27, i * 7 - 2, 8, 4);
    ctx.fillRect(19, i * 7 - 2, 8, 4);
  }
  rr(ctx, -20, -20, 40, 40, 5, "#1f2a16", OUT, 4);
  rr(ctx, -11, -11, 22, 22, 3, C.green, null);
  ctx.fillStyle = "#0e1408";
  ctx.font = "900 11px Bungee, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("AI", 0, 1);
  ctx.restore();
}

function drawSwirl(ctx, p) {
  const u = p.age / p.life;
  ctx.save();
  ctx.translate(p.x, -p.y);
  ctx.globalAlpha = 1 - u;
  ctx.strokeStyle = p.c || "#3a3a46";
  ctx.lineWidth = 10 * (1 - u) + 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 80 + u * 20, 26, 0, p.a, p.a + Math.PI * 1.3);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 70 + u * 20, 20, 0, p.a + 0.4, p.a + Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawBeam(ctx, p) {
  const f = p.f;
  const t = p.age;
  const x0 = f.x + f.facing * 112 * (f.char.scale || 1);
  const y0 = -(f.y + 150);
  const open = Math.min(1, t / 6) * (t > p.life - 10 ? (p.life - t) / 10 : 1);
  const len = 2200;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.scale(f.facing, 1);
  ctx.globalCompositeOperation = "lighter";
  const layers = [
    [62, "rgba(118,185,0,0.35)"],
    [44, "rgba(150,230,40,0.6)"],
    [26, "rgba(220,255,160,0.9)"],
    [11, "rgba(255,255,255,1)"],
  ];
  for (const [h, col] of layers) {
    const hh = h * open * (1 + Math.sin(t * 0.9 + h) * 0.06);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -hh * 0.6);
    for (let x = 0; x <= len; x += 80) ctx.lineTo(x, -hh + Math.sin(x * 0.03 + t * 0.8) * 4);
    for (let x = len; x >= 0; x -= 80) ctx.lineTo(x, hh + Math.sin(x * 0.03 - t * 0.8) * 4);
    ctx.lineTo(0, hh * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  // data packets racing down the beam
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = 0; i < 18; i++) {
    const x = ((t * 34 + i * 137) % len) | 0;
    const y = ((i * 53) % 60) - 30;
    ctx.fillRect(x, y * open, 26, 4);
  }
  ctx.restore();
  glow(ctx, x0, y0, 120 * open + 20, C.lime, 0.8);
}

// ------------------------------------------------------------ moves
const spinPose = (t) => {
  const flip = Math.floor(t / 3) % 2 === 0;
  return {
    ...P.stance,
    hip: [0, -84],
    lean: 4,
    hF: flip ? [92, -156] : [-70, -150],
    hB: flip ? [-66, -150] : [88, -156],
    fF: [22, 0],
    fB: [-22, 0],
    face: "angry",
  };
};

const moves = {
  S: {
    name: "텐서 코어 칩",
    desc: "곧게 날아가는 GPU 칩. 견제와 콤보 마무리에 모두 쓰인다.",
    kind: "special",
    frames: 42,
    startup: 13,
    anim: castAnim(13, 42),
    hits: [],
    update(t, f, b) {
      if (t === 13) {
        shoot(f, b, {
          dx: 92,
          dy: 146,
          speed: 9.6,
          w: 44,
          h: 42,
          life: 150,
          color: C.green,
          hit: hit({ dmg: 68, chip: 9, stun: 20, bstun: 16, push: 6, spark: "s", stop: 10, tint: C.green }),
          draw: drawChip,
          onDie: (p, bb) => burst(bb, p, C.lime, 10),
        });
        b.sfx("chip");
      }
    },
  },
  "6S": {
    name: "가죽 재킷 토네이도",
    desc: "재킷을 휘날리며 회전 돌진. 회전 중엔 투사체를 튕겨낸다.",
    kind: "special",
    frames: 48,
    startup: 9,
    projInvuln: [6, 34],
    noLimb: true,
    anim: (t) => (t < 8 ? { ...P.crouch, lean: 30, face: "angry" } : t < 34 ? spinPose(t) : keyframes([[34, spinPose(0)], [48, P.stance]])(t)),
    move: (t) => (t >= 8 && t < 33 ? { vx: 6.4 } : { vx: 0 }),
    hits: [
      hit({ at: [9, 31], box: [-34, 40, 126, 170], every: 7, max: 3, dmg: 26, chip: 4, stun: 18, bstun: 9, push: 1.5, stop: 6 }),
      hit({ at: [31, 35], box: [-24, 40, 126, 170], dmg: 44, chip: 6, launch: [7, 10], kd: true, push: 6, spark: "h", stop: 12, bstun: 12, sfx: "hit_h" }),
    ],
    cancel: { super: true },
    update(t, f, b) {
      if (t === 9) b.sfx("spin");
      if (t >= 9 && t < 34 && t % 3 === 0) {
        b.fx.custom({ x: f.x, y: f.y + 110 + (t % 6) * 6, life: 10, a: t * 0.7, draw: drawSwirl });
      }
    },
  },
  "2S": {
    name: "쿨링 팬 어퍼컷",
    desc: "무적으로 솟구치는 대공기. 막히면 큰 틈이 생긴다.",
    kind: "special",
    frames: 46,
    startup: 5,
    invuln: [1, 8],
    landLag: 14,
    anim: keyframes([
      [0, P.crouch],
      [4, { hip: [6, -58], lean: 22, hF: [40, -90], hB: [20, -100], fF: [30, 0], fB: [-24, 0], face: "angry" }],
      [8, { hip: [10, -110], lean: -10, head: -14, hF: [40, -252], hB: [0, -150], fF: [20, -22], fB: [-16, -42], face: "angry" }, ease.outQuad],
      [30, { hip: [10, -110], lean: -6, head: -10, hF: [36, -246], hB: [0, -150], fF: [20, -22], fB: [-16, -42], face: "angry" }],
      [46, P.jumpDown],
    ]),
    move: (t) => (t === 5 ? { vx: 3, vy: 15.5, raw: true } : undefined),
    hits: [hit({ at: [5, 21], box: [0, 80, 84, 178], every: 5, max: 3, dmg: 30, launch: [2.5, 13], kd: true, spark: "h", stop: 9, sfx: "hit_h", jug: 0, bstun: 14 })],
    update(t, f, b) {
      if (t === 5) b.sfx("fan");
    },
  },
  X: {
    name: "레이 트레이싱: 풀 패스",
    desc: "화면 끝까지 닿는 연산 빔. 10연타 후 날려 버린다.",
    kind: "super",
    frames: 92,
    startup: 18,
    noLimb: true,
    line: "많이 살수록, 많이 아낍니다!",
    anim: keyframes([
      [0, P.stance],
      [12, { hip: [-8, -88], lean: -12, hF: [-14, -170], hB: [-28, -152], fF: [24, 0], fB: [-32, 0], face: "angry" }],
      [18, { hip: [12, -84], lean: 14, hF: [106, -152], hB: [98, -140], fF: [46, 0], fB: [-34, 0], face: "angry" }, ease.outCubic],
      [76, { hip: [8, -84], lean: 12, hF: [104, -150], hB: [96, -140], fF: [46, 0], fB: [-34, 0], face: "angry" }],
      [92, P.stance],
    ]),
    hits: [
      hit({ at: [18, 72], box: [70, 96, 1600, 104], every: 5, max: 10, dmg: 28, chip: 6, stun: 22, bstun: 20, push: 1.2, stop: 4, tint: C.lime, spark: "l" }),
      hit({ at: [72, 77], box: [70, 86, 1600, 124], dmg: 60, chip: 10, launch: [9, 13], kd: true, spark: "super", stop: 18, bstun: 20 }),
    ],
    update(t, f, b) {
      if (t === 18) {
        b.sfx("beam");
        b.shake(7);
        b.fx.custom({ x: f.x, y: f.y, life: 60, f, draw: drawBeam });
      }
      if (t > 18 && t < 74 && t % 6 === 0) {
        b.fx.debris(f.x + f.facing * 300 + (b.rng() - 0.5) * 400, 520, 1, { color: C.green, size: 9, g: 0.5, angle: -Math.PI / 2, spread: 0.6, speed: 4, life: 50 });
      }
    },
  },
};

export default {
  id: "huang",
  name: "젠슨 황",
  short: "HUANG",
  en: "JENSEN HUANG",
  title: "가죽 재킷의 GPU 황제",
  faction: "capital",
  color: C.green,
  colorB: "#1d2b12",
  quote: "더 많이 살수록, 더 많이 아낍니다.",
  bio: "AI 시대의 연산 군주. 텐서 칩을 던지고 냉각팬으로 하늘을 가르며, 최후엔 레이 트레이싱 빔으로 화면을 통째로 렌더링해 버린다.",
  winQuotes: [
    "지금 이 순간에도 연산은 계속됩니다.",
    "재킷은 벗어도 리드는 안 뺏깁니다.",
    "당신의 패배는 이미 렌더링이 끝났어요.",
    "다음 세대 칩은 더 빠릅니다. 저도요.",
  ],
  stats: { power: 3, speed: 4, range: 5, tech: 2 },
  health: 1000,
  walk: 4.2,
  back: 3.4,
  scale: 1,
  passive: { name: "가죽 재킷", desc: "체력 50% 이하에서 재킷을 벗어 던진다. 이후 이동 속도 +12%." },
  style,
  getStyle: (f) => (f && f.passive.noJacket ? teeStyle : style),
  hooks: {
    update(f, b) {
      if (!f.passive.noJacket && f.health > 0 && f.health <= f.maxHealth * 0.5 && b.phase === "fight") {
        f.passive.noJacket = true;
        b.fx.debris(f.x, f.y + 150, 1, { color: C.jacket, size: 26, speed: 9, up: 8, g: 0.45, life: 70 });
        b.fx.text(f.x, f.y + 280, "재킷 오프!", C.lime, 34, 50);
        b.sfx("power");
      }
    },
    speedMult: (f) => (f.passive.noJacket ? 1.12 : 1),
  },
  moves,
  ai: { zoner: true, projectile: "S", antiAir: "2S", rush: "6S", range: 420 },
};
