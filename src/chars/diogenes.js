// 디오게네스 — 통 속에 사는 견유학파의 악동.
import { keyframes, shape, circle, ellipse, line, OUT, headBase, eyes, brows, mouth, ear, nose, rr, handFrame } from "../render/rig.js";
import { P, ANIM } from "../render/poses.js";
import { ease, clamp } from "../core/util.js";
import { hit, castAnim, shoot, glow, burst, worldText, skirt } from "./kit.js";

const C = {
  skin: "#c98e66",
  shade: "#a96f4c",
  hair: "#a7a29b",
  hairDark: "#7e7a73",
  beard: "#b8b3ab",
  rag: "#8a6a48",
  ragShade: "#6e5236",
  patch: "#5b6b3a",
  brass: "#c9a24a",
  glass: "#ffe08a",
  barrel: "#8b5a2b",
  band: "#3c3c40",
  orange: "#ffa133",
};

function head(ctx, R, face) {
  // scraggly hair
  shape(ctx, [[20, -36], [10, -54], [0, -42], [-12, -58], [-20, -44], [-36, -52], [-38, -34], [-54, -30], [-46, -14], [-58, 4], [-42, 8], [-48, 26], [-30, 16], [-20, -20]], C.hair, OUT, 4);
  headBase(ctx, R, C.skin, C.shade);
  ear(ctx, -10, 6, C.skin, C.shade);
  shape(ctx, [[30, -26], [26, -46], [12, -38], [4, -52], [-8, -40], [-22, -50], [-30, -32], [-40, -24], [-30, -18], [-14, -28], [6, -30]], C.hair, OUT, 4);
  // long beard with ragged tips
  shape(ctx, [[-8, 12], [-12, 40], [-4, 70], [4, 58], [12, 78], [18, 60], [28, 72], [32, 52], [44, 52], [46, 22], [34, 20], [18, 22]], C.beard, OUT, 4);
  ctx.strokeStyle = C.hairDark;
  ctx.lineWidth = 2;
  for (const x of [4, 16, 28]) line(ctx, [[x, 30], [x - 2, 54]]);
  if (face === "happy") {
    shape(ctx, [[18, 24], [40, 24], [30, 34]], "#5a1e24", OUT, 3);
    ctx.fillStyle = "#fff";
    ctx.fillRect(20, 24, 6, 4);
    ctx.fillRect(30, 24, 6, 4);
  } else if (face !== "normal" && face) mouth(ctx, face, 30, 28, { w: 12 });
  else {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(20, 26);
    ctx.quadraticCurveTo(30, 32, 40, 24);
    ctx.stroke();
  }
  // moustache
  shape(ctx, [[20, 16], [34, 10, 48, 18], [40, 26, 30, 22], [22, 26, 20, 16]], C.beard, OUT, 3);
  brows(ctx, face, 13, 31, -2, C.hairDark, 6);
  eyes(ctx, face, 13, 31, 0);
  ctx.strokeStyle = "rgba(90,50,30,0.5)";
  ctx.lineWidth = 2;
  line(ctx, [[8, 8], [18, 9]]);
  line(ctx, [[27, 8], [35, 9]]);
  // big crooked nose
  shape(ctx, [[38, -8], [56, 8, 46, 16], [36, 16]], C.skin, OUT, 3.5, false);
  ctx.fillStyle = C.shade;
  ctx.beginPath();
  ctx.arc(42, 12, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function torso(ctx, w, top) {
  shape(ctx, [[-w * 0.46, top + 16], [-w * 0.16, top - 2], [-w * 0.06, top + 8], [-w * 0.28, top + 30]], C.skin, OUT, 3);
  rr(ctx, -w * 0.3, top + 34, 16, 14, 2, C.patch, OUT, 2.5);
  rr(ctx, w * 0.1, top + 16, 14, 12, 2, "#7a5a3a", OUT, 2.5);
  ctx.strokeStyle = "rgba(255,240,200,0.5)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 2]);
  ctx.strokeRect(-w * 0.3 + 2, top + 36, 12, 10);
  ctx.setLineDash([]);
  ctx.strokeStyle = "#5a4028";
  ctx.lineWidth = 4;
  line(ctx, [[-w * 0.46, -16], [w * 0.46, -20]]);
}

function overLegs(ctx, J, p, opts) {
  skirt(ctx, J, C.rag, C.ragShade, { len: 0.95, ragged: true });
  const f = opts.fighter;
  if (f && (f.state === "crouch" || (f.state === "blockstun" && f.blockLow)) ) {
    const [px, py] = J.pelvis;
    ctx.save();
    ctx.translate(px + 4, 0);
    rr(ctx, -50, -96, 100, 98, 26, C.barrel, OUT, 5);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(-46, -92, 26, 90);
    for (const y of [-80, -24]) {
      ctx.fillStyle = C.band;
      ctx.fillRect(-50, y, 100, 9);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2;
    for (const x of [-20, 6, 30]) line(ctx, [[x, -92], [x, -4]]);
    ctx.restore();
  }
}

function propBack(ctx, J, p, opts) {
  const h = handFrame(J.armB);
  ctx.save();
  ctx.translate(h.x, h.y);
  const sway = Math.sin((opts.t || 0) * 0.08) * 0.15;
  ctx.rotate(sway);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 6, 7, Math.PI, 0);
  ctx.stroke();
  rr(ctx, -12, 10, 24, 30, 4, C.glass, OUT, 3.5);
  ctx.strokeStyle = C.brass;
  ctx.lineWidth = 3;
  line(ctx, [[0, 10], [0, 40]]);
  shape(ctx, [[-14, 10], [0, 2], [14, 10]], C.brass, OUT, 3);
  rr(ctx, -14, 38, 28, 6, 2, C.brass, OUT, 2.5);
  ctx.restore();
  glow(ctx, h.x, h.y + 24, 46, "#ffd27a", 0.45);
}

const style = {
  skin: C.skin,
  skinShade: C.shade,
  sleeve: C.skin,
  forearm: C.skin,
  top: C.rag,
  thigh: C.skin,
  shin: C.skin,
  pants: C.skin,
  shoe: C.skin,
  barefoot: true,
  torsoW: 48,
  armW: 16,
  legW: 19,
  head,
  torso,
  overLegs,
  propBack,
};

// ------------------------------------------------------------ visuals
function drawDog(ctx, p) {
  const dir = Math.sign(p.vx) || 1;
  const run = p.age * 0.7;
  ctx.save();
  ctx.translate(p.x, -p.y + 20);
  ctx.scale(dir, 1);
  ctx.strokeStyle = OUT;
  ctx.lineCap = "round";
  for (const [lx, ph] of [[-16, 0], [-8, Math.PI], [14, Math.PI / 2], [22, -Math.PI / 2]]) {
    ctx.lineWidth = 9;
    ctx.strokeStyle = OUT;
    line(ctx, [[lx, -8], [lx + Math.sin(run + ph) * 9, 4]]);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#c98a4a";
    line(ctx, [[lx, -8], [lx + Math.sin(run + ph) * 9, 4]]);
  }
  ellipse(ctx, 2, -18, 30, 15, 0, "#d89a5a", OUT, 4);
  ellipse(ctx, 32, -30, 14, 12, 0, "#d89a5a", OUT, 4);
  shape(ctx, [[26, -40], [24, -54], [34, -42]], "#b5743a", OUT, 3);
  ellipse(ctx, 44, -26, 7, 5, 0, "#e8b07a", OUT, 3);
  circle(ctx, 49, -27, 2.5, OUT, null);
  circle(ctx, 35, -33, 2, OUT, null);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-26, -22);
  ctx.quadraticCurveTo(-40, -36 + Math.sin(p.age * 1.2) * 8, -36, -44);
  ctx.stroke();
  ctx.restore();
}

function drawChicken(ctx, p) {
  ctx.save();
  ctx.translate(p.x, -p.y);
  ctx.rotate(p.age * 0.3 * (Math.sign(p.vx) || 1));
  ellipse(ctx, 0, 0, 22, 17, 0, "#ffc7c7", OUT, 4);
  ctx.fillStyle = "rgba(255,150,150,0.5)";
  for (const [x, y] of [[-8, -4], [4, 6], [8, -6]]) {
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  circle(ctx, 18, -16, 9, "#ffc7c7", OUT, 3);
  shape(ctx, [[24, -18], [34, -14], [24, -12]], "#ffb02e", OUT, 2.5);
  shape(ctx, [[14, -26], [18, -32], [22, -26]], "#ff3a3a", OUT, 2);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  line(ctx, [[-6, 14], [-10, 26]]);
  line(ctx, [[6, 14], [8, 26]]);
  ctx.restore();
}

function drawBarrel(ctx, f) {
  const k = f.mt * 0.45;
  ctx.save();
  ctx.translate(f.x, -50);
  ctx.save();
  ctx.rotate(k * f.facing);
  circle(ctx, 0, 0, 52, C.barrel, OUT, 5);
  ctx.strokeStyle = C.band;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 4);
    line(ctx, [[-50, 0], [50, 0]]);
  }
  ctx.restore();
  // head poking out of the side
  ctx.scale(f.facing, 1);
  circle(ctx, 18, -40, 18, C.skin, OUT, 3.5);
  shape(ctx, [[10, -30], [20, -10], [32, -28]], C.beard, OUT, 3);
  ctx.fillStyle = OUT;
  ctx.fillRect(22, -46, 4, 5);
  ctx.restore();
}

// ------------------------------------------------------------ moves
const lanternPose = { hip: [12, -84], lean: 18, head: 6, hF: [40, -140], hB: [104, -168], fF: [40, 0], fB: [-30, 0], eB: -1, face: "angry" };

const moves = {
  S: {
    name: "정직한 인간 탐색",
    desc: "등불의 빛줄기로 앞을 넓게 비춘다. 발생이 빠르다.",
    kind: "special",
    frames: 38,
    startup: 10,
    noLimb: true,
    anim: keyframes([[0, P.stance], [6, { ...P.castWind, hB: [-40, -150] }], [10, lanternPose, ease.outCubic], [20, lanternPose], [38, P.stance]]),
    hits: [hit({ at: [10, 18], box: [60, 90, 190, 120], dmg: 56, chip: 8, stun: 19, bstun: 15, push: 6, spark: "s", stop: 9, tint: C.glass })],
    update(t, f, b) {
      if (t === 10) {
        b.sfx("lantern");
        b.fx.custom({
          x: f.x + f.facing * 120,
          y: f.y + 170,
          dir: f.facing,
          life: 12,
          draw: (ctx, p) => {
            const u = p.age / p.life;
            ctx.save();
            ctx.translate(p.x, -p.y);
            ctx.scale(p.dir, 1);
            ctx.globalCompositeOperation = "lighter";
            const g = ctx.createLinearGradient(0, 0, 220, 0);
            g.addColorStop(0, `rgba(255,236,160,${0.8 * (1 - u)})`);
            g.addColorStop(1, "rgba(255,236,160,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.lineTo(230, -80);
            ctx.lineTo(230, 70);
            ctx.lineTo(0, 8);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          },
        });
        f.vars.n = (f.vars.n || 0) + 1;
        if (b.rng() < 0.3) b.fx.text(f.x, f.y + 290, "정직한 사람 어디 없소?", "#ffe08a", 22, 50);
      }
    },
  },
  "6S": {
    name: "통 굴리기",
    desc: "통에 들어가 굴러간다. 투사체를 무시하고 다단 히트.",
    kind: "special",
    frames: 54,
    startup: 8,
    projInvuln: [4, 42],
    noLimb: true,
    anim: keyframes([[0, P.stance], [6, { ...P.crouch, lean: 50 }], [42, { ...P.crouch, lean: 30 }], [54, P.stance]]),
    move: (t) => (t >= 6 && t < 42 ? { vx: 9.5 } : { vx: 0 }),
    hits: [
      hit({ at: [8, 40], box: [-40, 0, 100, 104], every: 8, max: 4, dmg: 22, chip: 4, stun: 16, bstun: 10, push: 2, spark: "l", stop: 5 }),
      hit({ at: [40, 44], box: [-30, 0, 100, 104], dmg: 30, chip: 4, launch: [6, 9], kd: true, spark: "h", stop: 10, bstun: 12 }),
    ],
    update(t, f, b) {
      if (t === 6) b.sfx("barrel");
      f.hidden = false;
      f.altDraw = t >= 6 && t < 42 ? "barrel" : null;
      f.hurtH = t >= 6 && t < 42 ? 104 : null;
      if (f.altDraw && t % 5 === 0) b.fx.dust(f.x - f.facing * 40, 0, 1);
    },
  },
  "2S": {
    name: "충견 출동",
    desc: "충직한 개가 달려가 발목을 문다. 하단 판정.",
    kind: "special",
    frames: 34,
    startup: 12,
    anim: keyframes([[0, P.stance], [8, { ...P.taunt, hF: [26, -186], face: "angry" }], [12, { ...P.cast, hip: [6, -84], lean: 10, hF: [110, -110], hB: [30, -130] }, ease.outQuad], [20, { ...P.cast, hip: [6, -84], lean: 10, hF: [110, -110], hB: [30, -130] }], [34, P.stance]]),
    hits: [],
    update(t, f, b) {
      if (t === 8) b.sfx("dog");
      if (t === 12) {
        shoot(f, b, {
          dx: 40,
          dy: 26,
          speed: 8.4,
          w: 66,
          h: 46,
          life: 130,
          homable: false,
          color: "#d89a5a",
          hit: hit({ dmg: 50, chip: 6, level: "low", stun: 18, bstun: 12, push: 4, spark: "l", stop: 8, sfx: "dog" }),
          draw: drawDog,
          onDie: (p, bb) => bb.fx.dust(p.x, 0, 4),
        });
      }
    },
  },
  X: {
    name: "보라, 플라톤의 인간이다!",
    desc: "털 뽑은 닭을 하늘 가득 던진다. 서서 막아야 한다.",
    kind: "super",
    frames: 74,
    startup: 14,
    line: "깃털 없는 두 발 짐승이 인간이라고? 받아라!",
    anim: (t) => {
      if (t < 14) return keyframes([[0, P.stance], [14, { ...P.taunt, hF: [30, -240], face: "happy" }]])(t);
      if (t < 58) {
        const a = Math.floor((t - 14) / 5) % 2;
        return { ...P.cast, hip: [6, -88], lean: 6, hF: a ? [80, -220] : [30, -150], hB: a ? [20, -140] : [-40, -150], face: "happy" };
      }
      return keyframes([[58, P.cast], [74, P.stance]])(t);
    },
    hits: [],
    update(t, f, b) {
      if (t === 14) b.fx.text(f.x, f.y + 300, "플라톤의 인간!", "#ffc7c7", 40, 60);
      if (t >= 14 && t <= 54 && (t - 14) % 5 === 0) {
        const o = f.opp;
        const x0 = f.x + f.facing * 50;
        const target = clamp(o.x + (b.rng() - 0.5) * 220, 80, 1820);
        const T = 52;
        b.spawn({
          owner: f,
          x: x0,
          y: 220,
          vx: (target - x0) / T,
          vy: 15,
          gravity: 0.7,
          w: 50,
          h: 44,
          life: 120,
          ground: 0,
          super: true,
          clash: false,
          homable: false,
          hit: hit({ dmg: 32, chip: 6, level: "high", stun: 20, bstun: 12, push: 2, spark: "l", stop: 5, tint: "#ffc7c7" }),
          onGround(p, bb) {
            bb.fx.debris(p.x, 10, 6, { shape: "feather", color: "#fff1f1", speed: 4, up: 3, g: 0.08, life: 50 });
            bb.killProjectile(p, false);
          },
          draw: drawChicken,
        });
        b.sfx("chicken");
      }
    },
  },
};

export default {
  id: "diogenes",
  name: "디오게네스",
  short: "DIOGENES",
  en: "DIOGENES OF SINOPE",
  title: "통 속의 견유",
  faction: "philosophy",
  color: C.orange,
  colorB: "#3a2208",
  quote: "햇빛 가리지 말고 비켜라.",
  bio: "대낮에 등불을 들고 '정직한 인간'을 찾아다닌 괴짜. 통 속에 숨고, 통째로 굴러오고, 개를 풀고, 털 뽑은 닭으로 플라톤을 조롱한다.",
  winQuotes: ["알렉산더도 내 햇빛은 못 가렸지.", "부끄러움이란 건 개나 주시오. 아, 개는 내 편이었지.", "통 하나면 충분하오. 승리도 하나면 충분하고.", "등불을 켜봐도 당신 같은 패배자뿐이군."],
  stats: { power: 3, speed: 4, range: 3, tech: 3 },
  health: 960,
  walk: 4.4,
  back: 3.6,
  dash: 12.5,
  scale: 0.96,
  passive: { name: "통 속의 현자", desc: "앉아 있으면 통 속에 숨는다. 앉은 상태에서는 투사체를 완전히 무시한다." },
  style,
  hooks: {
    projImmune: (f) => f.state === "crouch" || (f.state === "blockstun" && f.blockLow),
  },
  drawAlt: { barrel: drawBarrel },
  anims: {
    idle: (t) => {
      const p = ANIM.idle(t);
      return { ...p, hB: [-30, -98 + Math.sin(t * 0.09) * 3], lean: 10 };
    },
    walk: (t, dir) => ({ ...ANIM.walk(t, dir), hB: [-28 + Math.sin(t * 0.16 * dir) * 6, -100] }),
  },
  moves,
  ai: { zoner: false, projectile: "2S", antiAir: "2H", rush: "6S", range: 260 },
};
