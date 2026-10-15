// 니체 — 망치로 철학하는 초인.
import { keyframes, shape, circle, ellipse, line, OUT, headBase, eyes, brows, mouth, ear, nose, rr, handFrame } from "../render/rig.js";
import { P } from "../render/poses.js";
import { ease } from "../core/util.js";
import { hit, glow, burst, worldText, coatTails } from "./kit.js";

const C = {
  skin: "#efc7a7",
  shade: "#d3a283",
  hair: "#4a372b",
  hairHi: "#6a5242",
  stache: "#5a4232",
  stacheHi: "#7a5e48",
  coat: "#2b2733",
  coatHi: "#3d3846",
  collar: "#f2efe6",
  pants: "#3a3742",
  shoe: "#121214",
  steel: "#9aa2ae",
  steelDark: "#5c6370",
  wood: "#8b5a2b",
  red: "#ff4d4d",
};

function head(ctx, R, face) {
  shape(ctx, [[-6, -40], [-38, -44, -50, -18], [-56, 8, -42, 24], [-30, 12], [-20, -16]], C.hair, OUT, 4);
  headBase(ctx, R, C.skin, C.shade, { tall: 1.05 });
  ear(ctx, -10, 6, C.skin, C.shade);
  shape(ctx, [[28, -30], [26, -48, 2, -52], [-26, -54, -42, -36], [-50, -20, -46, 0], [-34, -10], [-26, -28, -4, -34], [16, -38, 28, -30]], C.hair, OUT, 4);
  ctx.strokeStyle = C.hairHi;
  ctx.lineWidth = 2.5;
  line(ctx, [[14, -44], [-20, -46]]);
  line(ctx, [[6, -38], [-30, -32]]);
  // deep-set eyes under heavy brows
  ctx.fillStyle = "rgba(90,50,40,0.25)";
  ctx.beginPath();
  ctx.ellipse(22, -2, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, face, 14, 31, 0);
  const intense = face === "normal" || !face ? "angry" : face;
  brows(ctx, intense, 14, 31, -2, C.hair, 6.5);
  nose(ctx, 42, 8, 1.1, C.skin, C.shade);
  if (face === "angry" || face === "hurt" || face === "ko") mouth(ctx, face, 28, 34, { w: 12 });
  // the legendary moustache
  shape(ctx, [[14, 14], [28, 6, 46, 14], [56, 22, 52, 38], [48, 30, 42, 26], [36, 32, 26, 34], [18, 36, 8, 30], [4, 26, 6, 20], [10, 18, 14, 14]], C.stache, OUT, 4);
  ctx.strokeStyle = C.stacheHi;
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 6; i++) line(ctx, [[14 + i * 6, 16], [12 + i * 7, 30]]);
}

function torso(ctx, w, top) {
  shape(ctx, [[w * 0.0, top + 2], [w * 0.36, top - 4], [w * 0.42, top + 12], [w * 0.1, top + 16]], C.collar, OUT, 3);
  shape(ctx, [[w * 0.16, top + 10], [w * 0.36, top + 10], [w * 0.3, top + 24], [w * 0.2, top + 24]], "#141418", OUT, 2.5);
  shape(ctx, [[w * 0.0, top + 10], [w * 0.22, top + 22], [w * 0.2, -6], [w * 0.04, -6]], C.coatHi, OUT, 3);
  ctx.fillStyle = "#8f8a9a";
  for (const y of [top + 40, top + 54]) {
    ctx.beginPath();
    ctx.arc(w * 0.34, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function torsoBack(ctx, w, top) {
  shape(ctx, [[-w * 0.42, top + 46], [-w * 0.18, -4], [-w * 0.26, 56], [-w * 0.6, 60]], "#221f29", OUT, 4);
}

function propFront(ctx, J, p, opts) {
  const h = handFrame(J.armF);
  const f = opts.fighter;
  const big = f && f.buff;
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.ang);
  ctx.lineCap = "round";
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 11;
  line(ctx, [[-14, 0], [66, 0]]);
  ctx.strokeStyle = C.wood;
  ctx.lineWidth = 6;
  line(ctx, [[-14, 0], [66, 0]]);
  rr(ctx, 56, -22, 26, 44, 4, big ? "#ffcf5a" : C.steel, OUT, 4);
  ctx.fillStyle = big ? "#c99a2a" : C.steelDark;
  ctx.fillRect(56, -22, 7, 44);
  ctx.restore();
  if (big) glow(ctx, h.x, h.y, 60, C.red, 0.35);
}

const style = {
  skin: C.skin,
  skinShade: C.shade,
  sleeve: C.coat,
  forearm: C.coat,
  cuff: C.collar,
  top: C.coat,
  pants: C.pants,
  shoe: C.shoe,
  torsoW: 54,
  head,
  torso,
  torsoBack,
  propFront,
};

function drawWave(ctx, p) {
  const dir = Math.sign(p.vx) || 1;
  ctx.save();
  ctx.translate(p.x, -p.y + 18);
  ctx.scale(dir, 1);
  ctx.globalAlpha = Math.min(1, p.life / 10);
  for (let i = 0; i < 3; i++) {
    const h = 26 + i * 12 + Math.sin(p.age * 0.8 + i) * 6;
    shape(ctx, [[-30 + i * 14, 0], [-16 + i * 14, -h], [-2 + i * 14, 0]], ["#8a7a6a", "#a8957f", "#c7b49a"][i], OUT, 3);
  }
  ctx.restore();
}

const moves = {
  S: {
    name: "망치로 철학하기",
    desc: "땅을 부수는 중단 내려찍기. 지면을 따라 충격파가 퍼진다.",
    kind: "special",
    frames: 54,
    startup: 20,
    anim: keyframes([
      [0, P.stance],
      [12, { hip: [-8, -92], lean: -16, head: -10, hF: [-30, -236], hB: [-20, -220], fF: [26, 0], fB: [-32, 0], face: "angry" }, ease.outQuad],
      [20, { hip: [22, -68], lean: 42, head: 12, hF: [120, -44], hB: [96, -50], fF: [52, 0], fB: [-30, 0], face: "angry" }, ease.inQuad],
      [32, { hip: [22, -68], lean: 40, head: 12, hF: [118, -40], hB: [96, -48], fF: [52, 0], fB: [-30, 0], face: "angry" }],
      [54, P.stance],
    ]),
    hits: [hit({ at: [20, 25], box: [40, 0, 140, 200], dmg: 96, chip: 12, level: "high", stun: 24, bstun: 18, push: 7, spark: "h", stop: 15, sfx: "hammer" })],
    update(t, f, b) {
      if (t === 20) {
        b.shake(8);
        b.sfx("hammer");
        b.fx.debris(f.x + f.facing * 150, 6, 10, { color: ["#8a7a6a", "#c7b49a"], angle: Math.PI / 2, spread: 1.4, speed: 8, size: 8, life: 36 });
        b.spawn({
          owner: f,
          x: f.x + f.facing * 160,
          y: 20,
          vx: f.facing * 7.5,
          w: 64,
          h: 40,
          life: 40,
          homable: false,
          hit: hit({ dmg: 36, chip: 5, level: "low", stun: 16, bstun: 10, push: 4, spark: "l", stop: 6 }),
          update(p, bb) {
            if (p.age % 4 === 0) bb.fx.dust(p.x, 0, 1, "#b8a890");
          },
          draw: drawWave,
        });
      }
    },
  },
  "6S": {
    name: "힘에의 의지",
    desc: "한 번의 공격을 버티며 돌진하는 펀치(슈퍼 아머).",
    kind: "special",
    frames: 46,
    startup: 14,
    armor: [3, 22],
    armorHits: 1,
    anim: keyframes([
      [0, P.stance],
      [8, { hip: [-14, -88], lean: -14, hF: [-30, -150], hB: [10, -150], fF: [26, 0], fB: [-36, 0], face: "angry" }],
      [14, { hip: [22, -82], lean: 30, head: 6, hF: [126, -150], hB: [-10, -130], fF: [56, 0], fB: [-36, 0], face: "angry" }, ease.outCubic],
      [24, { hip: [22, -82], lean: 28, head: 6, hF: [122, -150], hB: [-10, -130], fF: [56, 0], fB: [-36, 0], face: "angry" }],
      [46, P.stance],
    ]),
    move: (t) => (t >= 8 && t < 22 ? { vx: 11 } : { vx: 0 }),
    hits: [hit({ at: [14, 22], box: [30, 96, 110, 96], dmg: 92, chip: 10, stun: 22, bstun: 16, push: 11, spark: "h", stop: 14, sfx: "hit_h" })],
    update(t, f, b) {
      if (t === 6) {
        b.sfx("roar");
        f.trail = 18;
      }
      if (t >= 3 && t < 22 && t % 4 === 0) b.fx.ring(f.x, f.y + 120, C.red, 5, 10, 4);
    },
  },
  "2S": {
    name: "디오니소스의 춤",
    desc: "망치를 휘두르며 회전 상승하는 대공기.",
    kind: "special",
    frames: 52,
    startup: 5,
    invuln: [1, 7],
    landLag: 12,
    anim: (t) => {
      if (t < 5) return { ...P.crouch, face: "angry" };
      const spin = t < 26 ? (t - 5) * 26 : 0;
      return { hip: [0, -96], lean: 0, head: 0, hF: [96, -150], hB: [-60, -140], fF: [26, -30], fB: [-20, -36], rot: spin, face: "angry" };
    },
    move: (t) => (t === 5 ? { vx: 2.2, vy: 13, raw: true } : undefined),
    hits: [hit({ at: [5, 25], box: [-70, 30, 180, 210], every: 5, max: 4, dmg: 24, chip: 4, launch: [2.5, 11], kd: true, spark: "h", stop: 7, jug: 0, bstun: 12 })],
    update(t, f, b) {
      if (t === 5) b.sfx("spin");
    },
  },
  X: {
    name: "위버멘쉬 각성",
    desc: "주변을 날려 버리고 10초간 공격력·속도가 오른다.",
    kind: "super",
    frames: 58,
    startup: 22,
    invuln: [0, 28],
    noLimb: true,
    line: "나를 죽이지 못하는 것은, 나를 더 강하게 만든다.",
    anim: keyframes([
      [0, P.stance],
      [16, { hip: [0, -70], lean: 30, head: 16, hF: [40, -90], hB: [-20, -90], fF: [36, 0], fB: [-36, 0], face: "angry" }],
      [22, { hip: [0, -96], lean: -12, head: -20, hF: [60, -250], hB: [-56, -244], fF: [36, 0], fB: [-36, 0], face: "angry" }, ease.outCubic],
      [44, { hip: [0, -96], lean: -10, head: -18, hF: [60, -246], hB: [-56, -240], fF: [36, 0], fB: [-36, 0], face: "angry" }],
      [58, P.stance],
    ]),
    hits: [hit({ at: [22, 28], box: [-150, 0, 300, 300], dmg: 110, chip: 20, launch: [8, 13], kd: true, spark: "super", stop: 16, bstun: 20 })],
    update(t, f, b) {
      if (t === 22) {
        b.sfx("roar");
        b.shake(14);
        b.flashScreen(C.red, 8, 0.4);
        for (let i = 0; i < 3; i++) b.fx.ring(f.x, f.y + 130, i ? "#ffcf5a" : C.red, 10 + i * 4, 22, 9);
        b.fx.text(f.x, f.y + 300, "위버멘쉬!", "#ffcf5a", 48, 60);
        f.buff = { name: "위버멘쉬", frames: 600, dmg: 1.25, speed: 1.15, noMeter: true, color: "#ff5a3a" };
        b.emit({ type: "buff", side: f.side, name: "위버멘쉬" });
      }
    },
  },
};

export default {
  id: "nietzsche",
  name: "니체",
  short: "NIETZSCHE",
  en: "FRIEDRICH NIETZSCHE",
  title: "망치를 든 초인",
  faction: "philosophy",
  color: C.red,
  colorB: "#3a1014",
  quote: "나를 쓰러뜨리지 못하면, 더 강해진다.",
  bio: "우상을 망치로 깨부수는 철학자. 땅을 울리는 망치, 맞아도 멈추지 않는 의지의 돌진, 그리고 10초간 모든 것을 초월하는 위버멘쉬 각성.",
  winQuotes: ["신은... 아니, 당신은 쓰러졌다.", "심연을 들여다보면, 심연도 당신을 들여다본다.", "다시 한 번! 영원히 반복되어도 좋다!", "춤추는 별을 낳으려면 혼돈이 필요하지."],
  stats: { power: 5, speed: 3, range: 3, tech: 3 },
  health: 1000,
  walk: 3.9,
  back: 3.2,
  scale: 1.01,
  passive: { name: "나를 죽이지 못하는 것은", desc: "체력 30% 이하가 되면 모든 공격 데미지 +20%." },
  style,
  hooks: {
    dmgMult: (f) => (f.health <= f.maxHealth * 0.3 ? 1.2 : 1),
    aura: (f) => (f.health > 0 && f.health <= f.maxHealth * 0.3 ? "#ff3a3a" : null),
  },
  moves,
  ai: { zoner: false, antiAir: "2S", rush: "6S", heavy: "S", range: 220 },
};
