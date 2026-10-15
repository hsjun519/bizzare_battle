// 애덤 스미스 — 보이지 않는 손을 부리는 경제학의 아버지.
import { keyframes, shape, circle, ellipse, line, OUT, headBase, eyes, brows, mouth, ear, nose, rr, handFrame } from "../render/rig.js";
import { P } from "../render/poses.js";
import { ease, clamp, lerp } from "../core/util.js";
import { hit, castAnim, shoot, glow, burst, worldText, coatTails } from "./kit.js";
import { STAGE_W, WALL } from "../game/constants.js";

const C = {
  skin: "#f4d3bd",
  shade: "#dbb096",
  wig: "#efeee9",
  wigShade: "#c9c7bf",
  coat: "#2c4178",
  coatDark: "#203261",
  gold: "#e8c15a",
  cravat: "#fbf9f2",
  vest: "#d9c79c",
  breeches: "#b99d6b",
  stocking: "#f1efe8",
  shoe: "#1a1a1e",
  teal: "#36c2b4",
  hand: "#e9fffb",
};

function head(ctx, R, face) {
  // queue ribbon and ponytail behind
  shape(ctx, [[-36, 4], [-56, 18, -54, 40], [-44, 42], [-40, 24, -28, 10]], C.wig, OUT, 4);
  shape(ctx, [[-44, 0], [-60, -8], [-58, 10], [-44, 6], [-30, 12], [-30, -6]], "#1d1d24", OUT, 3);
  headBase(ctx, R, C.skin, C.shade, { tall: 1.04 });
  ear(ctx, -8, 6, C.skin, C.shade);
  shape(ctx, [[30, -26], [28, -48, 2, -52], [-30, -54, -46, -28], [-50, -8, -42, 6], [-30, 2], [-24, -24, 6, -36], [22, -36, 30, -26]], C.wig, OUT, 4);
  ctx.strokeStyle = C.wigShade;
  ctx.lineWidth = 2;
  line(ctx, [[18, -42], [-20, -44]]);
  line(ctx, [[10, -34], [-26, -32]]);
  // side curls
  for (const y of [-2, 12]) {
    rr(ctx, -30, y - 6, 26, 13, 6, C.wig, OUT, 3);
    ctx.strokeStyle = C.wigShade;
    ctx.beginPath();
    ctx.arc(-17, y, 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  brows(ctx, face, 14, 31, -1, "#b9b5ab", 3.5);
  eyes(ctx, face, 14, 31, -1);
  shape(ctx, [[36, -8], [52, 10], [38, 12]], C.skin, OUT, 3, false);
  ctx.fillStyle = C.shade;
  ctx.beginPath();
  ctx.arc(40, 10, 2, 0, Math.PI * 2);
  ctx.fill();
  mouth(ctx, face, 26, 23, { smile: true, w: 13 });
}

function torso(ctx, w, top) {
  // waistcoat
  shape(ctx, [[w * 0.14, top + 10], [w * 0.42, top + 12], [w * 0.46, -2], [w * 0.18, -2]], C.vest, OUT, 3);
  ctx.fillStyle = C.gold;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(w * 0.36, top + 24 + i * 12, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // lapels with gold trim
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  line(ctx, [[w * 0.12, top + 6], [w * 0.16, -4]]);
  // cravat
  shape(ctx, [[w * 0.12, top - 2], [w * 0.4, top], [w * 0.46, top + 12], [w * 0.36, top + 24], [w * 0.4, top + 30], [w * 0.24, top + 30], [w * 0.2, top + 14]], C.cravat, OUT, 3);
  ctx.strokeStyle = "#d9d4c4";
  ctx.lineWidth = 2;
  line(ctx, [[w * 0.26, top + 6], [w * 0.32, top + 22]]);
  line(ctx, [[w * 0.34, top + 6], [w * 0.38, top + 18]]);
}

function torsoBack(ctx, w, top, p, opts) {
  ctx.save();
  shape(ctx, [[-w * 0.44, top + 50], [-w * 0.2, -4], [-w * 0.3, 50], [-w * 0.62, 56]], C.coatDark, OUT, 4);
  ctx.restore();
}

function propBack(ctx, J, p, opts) {
  const f = opts.fighter;
  if (f && f.state === "attack" && f.moveId === "X") return;
  const h = handFrame(J.armB);
  ctx.save();
  ctx.translate(h.x, h.y + 4);
  ctx.rotate(-0.2);
  rr(ctx, -16, -4, 32, 40, 4, "#7a3b22", OUT, 3.5);
  ctx.fillStyle = C.gold;
  ctx.fillRect(-16, 2, 32, 3);
  ctx.fillRect(-16, 28, 32, 3);
  ctx.fillStyle = "#f3e6c4";
  ctx.fillRect(12, -2, 4, 36);
  ctx.restore();
}

const style = {
  skin: C.skin,
  skinShade: C.shade,
  sleeve: C.coat,
  forearm: C.coat,
  cuff: C.gold,
  top: C.coat,
  thigh: C.breeches,
  shin: C.stocking,
  pants: C.breeches,
  shoe: C.shoe,
  torsoW: 50,
  head,
  torso,
  torsoBack,
  propBack,
};

// ------------------------------------------------------------ visuals
function drawHand(ctx, x, y, s, close, alpha, dir = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * dir, s);
  ctx.globalAlpha = alpha;
  glow(ctx, 0, 0, 120, "#bffff4", 0.4);
  ctx.globalAlpha = alpha * 0.85;
  const c = close;
  ctx.fillStyle = "rgba(225,255,250,0.55)";
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  // palm
  ctx.beginPath();
  ctx.ellipse(0, 20, 46, 54, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // fingers curling with `close`
  for (let i = 0; i < 4; i++) {
    const fx = -30 + i * 20;
    const len = 60 - Math.abs(i - 1.5) * 8;
    ctx.beginPath();
    ctx.moveTo(fx, -20);
    ctx.quadraticCurveTo(fx + c * 20, -20 - len * (1 - c * 0.5), fx + c * 40, -20 - len * (1 - c) + c * 30);
    ctx.lineWidth = 22;
    ctx.strokeStyle = "rgba(225,255,250,0.55)";
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(40, 30);
  ctx.quadraticCurveTo(70, 10 - c * 10, 66 - c * 30, -20 + c * 30);
  ctx.lineWidth = 22;
  ctx.strokeStyle = "rgba(225,255,250,0.55)";
  ctx.stroke();
  ctx.restore();
}

function drawWorker(ctx, p) {
  const dir = Math.sign(p.vx) || 1;
  const step = Math.sin(p.age * 0.5);
  ctx.save();
  ctx.translate(p.x, -p.y + 22);
  ctx.scale(dir, 1);
  // pin carried forward
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 7;
  line(ctx, [[-10, -30], [40, -30]]);
  ctx.strokeStyle = "#d6dbe2";
  ctx.lineWidth = 3.5;
  line(ctx, [[-10, -30], [40, -30]]);
  circle(ctx, -12, -30, 5, "#e8c15a", OUT, 2.5);
  // legs
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  line(ctx, [[-4, -14], [-4 + step * 8, 0]]);
  line(ctx, [[4, -14], [4 - step * 8, 0]]);
  rr(ctx, -10, -34, 20, 22, 6, p.color, OUT, 3);
  circle(ctx, 0, -44, 10, "#f2cdb2", OUT, 3);
  shape(ctx, [[-12, -48], [12, -48], [8, -58], [-8, -58]], p.hat, OUT, 2.5);
  ctx.fillStyle = OUT;
  ctx.fillRect(4, -46, 2.5, 3);
  ctx.restore();
}

function drawGraph(ctx, p) {
  const f = p.f;
  const u = Math.min(1, p.age / 10);
  const fade = p.age > p.life - 8 ? (p.life - p.age) / 8 : 1;
  ctx.save();
  ctx.translate(p.x, -p.y);
  ctx.scale(p.dir, 1);
  ctx.globalAlpha = fade;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 4;
  line(ctx, [[0, 0], [0, -230]]);
  line(ctx, [[0, 0], [190, 0]]);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#5aa9ff";
  ctx.beginPath();
  ctx.moveTo(10, -220);
  ctx.quadraticCurveTo(60, -40, 180 * u + 10, -20 * u);
  ctx.stroke();
  ctx.strokeStyle = "#ff5a6a";
  ctx.beginPath();
  ctx.moveTo(10, -10);
  ctx.quadraticCurveTo(60, -180, 180 * u + 10, -220 * u);
  ctx.stroke();
  if (u > 0.6) {
    glow(ctx, 70, -110, 50, "#ffffff", 0.8);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(70, -110, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBook(ctx, p) {
  const x = p.x;
  const y = -p.y;
  // shadow on the floor grows as it approaches
  const sh = Math.max(0.2, 1 - p.y / 900);
  ctx.fillStyle = `rgba(0,0,0,${0.35 * sh})`;
  ctx.beginPath();
  ctx.ellipse(x, 0, 150 * sh, 18 * sh, 0, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, x, y, 200, "#ffe9a8", 0.35);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(p.age * 0.1) * 0.05);
  rr(ctx, -140, -60, 280, 120, 10, "#6e2f1c", OUT, 6);
  ctx.fillStyle = "#f4e7c6";
  ctx.fillRect(-130, 44, 260, 12);
  ctx.fillStyle = C.gold;
  ctx.fillRect(-140, -40, 280, 6);
  ctx.fillRect(-140, 30, 280, 6);
  ctx.restore();
  worldText(ctx, "THE WEALTH OF NATIONS", x, y - 10, 22, C.gold, "#3a1508");
  worldText(ctx, "國富論 · 1776", x, y + 16, 15, "#f4e7c6", "#3a1508");
}

// ------------------------------------------------------------ moves
const reach = { hip: [10, -86], lean: 16, head: 4, hF: [108, -158], hB: [-20, -124], fF: [40, 0], fB: [-30, 0], face: "angry" };

const HAND_GRAB = {
  frames: 58,
  sfx: "grab",
  onStart(g) {
    g.vars.x0 = (g.def.x - g.att.x) * g.att.facing;
    g.vars.y0 = g.def.y;
  },
  hold(t, g) {
    const u = ease.inOut(Math.min(1, t / 26));
    return { x: lerp(g.vars.x0, 84, u), y: Math.sin(u * Math.PI) * 120 + (1 - u) * g.vars.y0, rot: -u * 40 };
  },
  attPose: (t) => (t < 26 ? { ...reach, hF: [108 - t, -150 + t * 0.5] } : { ...P.stance, lean: 20, hF: [80, -60], face: "happy" }),
  events(t, g, b) {
    const { att, def } = g;
    if (t % 2 === 0 && t < 30) {
      b.fx.custom({ x: def.x, y: def.y + 130, life: 3, dir: att.facing, draw: (ctx, p) => drawHand(ctx, p.x, -p.y, 1.1, 0.95, 0.8, -p.dir) });
    }
    if (t === 28) {
      b.shake(9);
      b.sfx("slam");
      b.fx.dust(def.x, 0, 14);
      b.fx.text(def.x, def.y + 240, "시장의 심판!", C.teal, 34, 46);
    }
  },
  release: { at: 30, dmg: 125, launch: [3, 8], kd: true, spark: "h", stop: 14 },
};

const SUPPLY = { id: "supplyDemand" };

const moves = {
  S: {
    name: "보이지 않는 손",
    desc: "멀리 있는 상대를 거대한 손이 붙잡아 끌고 와 내리꽂는다. 가드 불가.",
    kind: "special",
    frames: 54,
    startup: 18,
    noLimb: true,
    anim: keyframes([[0, P.stance], [10, { ...reach, hF: [70, -170] }, ease.outQuad], [18, reach], [28, reach], [54, P.stance]]),
    hits: [hit({ at: [18, 23], box: [190, 0, 130, 220], grab: HAND_GRAB, dmg: 0 })],
    update(t, f, b) {
      if (t === 8) {
        b.sfx("teleport");
        const hx = f.x + f.facing * 255;
        b.fx.custom({
          x: hx,
          y: f.y + 120,
          life: 26,
          dir: f.facing,
          draw: (ctx, p) => {
            const close = Math.min(1, Math.max(0, (p.age - 8) / 8));
            const alpha = p.age < 4 ? p.age / 4 : p.age > 20 ? (26 - p.age) / 6 : 1;
            drawHand(ctx, p.x, -p.y, 1.05, close, alpha, -p.dir);
          },
        });
      }
    },
  },
  "6S": {
    name: "핀 공장의 분업",
    desc: "핀을 든 노동자 셋이 줄지어 행진한다. 모두 하단 판정.",
    kind: "special",
    frames: 46,
    startup: 14,
    anim: castAnim(14, 46, { throwPose: { ...P.cast, hip: [10, -70], lean: 30, hF: [100, -70], hB: [70, -80] } }),
    hits: [],
    update(t, f, b) {
      const hats = ["#c94f4f", "#4f7fc9", "#4fc98b"];
      [14, 20, 26].forEach((k, i) => {
        if (t === k) {
          shoot(f, b, {
            dx: 60,
            dy: 24,
            speed: 6.2 + i * 0.25,
            w: 34,
            h: 48,
            life: 120,
            homable: false,
            color: "#c9a36a",
            hat: hats[i],
            hit: hit({ dmg: 28, chip: 4, level: "low", stun: 15, bstun: 10, push: 3, spark: "l", stop: 5 }),
            draw: drawWorker,
          });
          b.sfx("pop");
        }
      });
    },
  },
  "2S": {
    name: "수요와 공급의 교차",
    desc: "두 곡선이 교차하며 솟는 대공기. 공중 공격에 무적.",
    kind: "special",
    frames: 44,
    startup: 7,
    airInvuln: [1, 15],
    noLimb: true,
    anim: keyframes([
      [0, P.crouch],
      [7, { hip: [6, -96], lean: -8, head: -10, hF: [80, -230], hB: [40, -200], fF: [26, 0], fB: [-24, 0], face: "angry" }, ease.outQuad],
      [18, { hip: [6, -96], lean: -8, head: -10, hF: [84, -226], hB: [40, -200], fF: [26, 0], fB: [-24, 0], face: "angry" }],
      [44, P.stance],
    ]),
    hits: [hit({ at: [7, 17], box: [10, 70, 160, 210], dmg: 80, chip: 9, launch: [3.5, 15], kd: true, spark: "s", stop: 12, tint: C.teal, bstun: 14 })],
    update(t, f, b) {
      if (t === 6) {
        b.sfx("cube");
        b.fx.custom({ x: f.x + f.facing * 30, y: f.y + 20, dir: f.facing, life: 24, f, draw: drawGraph });
      }
    },
  },
  X: {
    name: "국부론 (1776)",
    desc: "상대 머리 위로 거대한 『국부론』이 떨어진다. 서서 막아야 한다.",
    kind: "super",
    frames: 84,
    startup: 20,
    line: "우리가 저녁을 먹는 건 정육점 주인의 자비 덕이 아니다.",
    anim: keyframes([
      [0, P.stance],
      [14, { hip: [0, -90], lean: -10, head: -14, hF: [20, -250], hB: [-10, -244], fF: [26, 0], fB: [-26, 0], face: "angry" }, ease.outQuad],
      [22, { hip: [10, -84], lean: 20, head: 6, hF: [100, -120], hB: [80, -110], fF: [40, 0], fB: [-30, 0], face: "angry" }, ease.inQuad],
      [70, { hip: [10, -84], lean: 18, head: 6, hF: [96, -124], hB: [80, -110], fF: [40, 0], fB: [-30, 0], face: "happy" }],
      [84, P.stance],
    ]),
    hits: [],
    update(t, f, b) {
      if (t === 20) {
        const o = f.opp;
        b.spawn({
          owner: f,
          x: clamp(o.x, WALL + 100, STAGE_W - WALL - 100),
          y: 900,
          vx: 0,
          vy: -4,
          gravity: 1.1,
          w: 270,
          h: 120,
          life: 160,
          super: true,
          strength: 99,
          clash: false,
          homable: false,
          ground: 0,
          hit: hit({ dmg: 250, chip: 40, level: "high", launch: [4, 12], kd: true, spark: "super", stop: 20, bstun: 26 }),
          update(p, bb) {
            p.vx = clamp((p.owner.opp.x - p.x) * 0.06, -6, 6);
          },
          onGround(p, bb) {
            bb.shake(14);
            bb.sfx("slam");
            bb.fx.dust(p.x, 0, 22, "#d9c7a0");
            bb.fx.debris(p.x, 30, 16, { color: ["#f4e7c6", "#6e2f1c"], speed: 10, up: 6, size: 8, life: 50, shape: "feather" });
            bb.spawn({ owner: p.owner, x: p.x, y: 20, vx: 0, w: 420, h: 40, life: 6, clash: false, homable: false, super: true, hit: hit({ dmg: 50, chip: 10, level: "low", launch: [5, 8], kd: true, spark: "h", stop: 10 }), draw: () => {} });
            const px = p.x;
            bb.fx.custom({ x: px, y: 60, life: 40, draw: (ctx, q) => {
              ctx.save();
              ctx.globalAlpha = 1 - q.age / 40;
              drawBook(ctx, { x: q.x, y: 60, age: 0 });
              ctx.restore();
            } }, false);
            bb.killProjectile(p, false);
          },
          draw: drawBook,
        });
        b.sfx("book");
      }
    },
  },
};

export default {
  id: "smith",
  name: "애덤 스미스",
  short: "SMITH",
  en: "ADAM SMITH",
  title: "보이지 않는 손의 주인",
  faction: "capital",
  color: C.teal,
  colorB: "#0f2e2b",
  quote: "시장은 언제나 균형을 찾는다. 당신을 쓰러뜨리는 쪽으로.",
  bio: "경제학의 아버지. 멀리서 상대를 낚아채는 보이지 않는 손, 줄지어 행진하는 핀 공장 노동자, 그리고 하늘에서 떨어지는 국부론 초판.",
  winQuotes: ["분업의 승리입니다.", "자비가 아니라 이기심이 당신을 이겼소.", "시장은 이미 결론을 냈습니다.", "보이지 않았다고 없는 건 아니지."],
  stats: { power: 4, speed: 3, range: 5, tech: 5 },
  health: 980,
  walk: 3.9,
  back: 3.3,
  scale: 1,
  passive: { name: "시장 균형", desc: "체력 비율이 상대보다 낮으면 필살기 게이지가 저절로 찬다." },
  style,
  hooks: {
    update(f, b) {
      const o = f.opp;
      if (b.phase === "fight" && f.health / f.maxHealth < o.health / o.maxHealth - 0.05) f.gainMeter(0.07);
    },
  },
  moves,
  ai: { zoner: true, projectile: "6S", antiAir: "2S", grab: "S", range: 300 },
};
