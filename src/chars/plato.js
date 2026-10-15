// 플라톤 — 이데아의 형상을 소환하는 철인.
import { keyframes, shape, circle, ellipse, line, OUT, headBase, eyes, brows, mouth, ear, nose, rr } from "../render/rig.js";
import { P } from "../render/poses.js";
import { ease, clamp } from "../core/util.js";
import { hit, castAnim, shoot, glow, burst, worldText, skirt } from "./kit.js";
import { STAGE_W, WALL } from "../game/constants.js";

const C = {
  skin: "#e5b089",
  shade: "#c48d68",
  hair: "#5b4a3d",
  hairHi: "#7a6656",
  gray: "#a39a90",
  band: "#e2b84c",
  toga: "#3e6fb6",
  togaShade: "#2e5590",
  trim: "#e2b84c",
  sandal: "#6b4a2e",
  violet: "#a98bff",
};

// ----------------------------------------------------- platonic solids
const PHI = (1 + Math.sqrt(5)) / 2;
function edgesFor(verts) {
  let min = Infinity;
  for (let i = 0; i < verts.length; i++)
    for (let j = i + 1; j < verts.length; j++) {
      const d = Math.hypot(verts[i][0] - verts[j][0], verts[i][1] - verts[j][1], verts[i][2] - verts[j][2]);
      if (d < min) min = d;
    }
  const e = [];
  for (let i = 0; i < verts.length; i++)
    for (let j = i + 1; j < verts.length; j++) {
      const d = Math.hypot(verts[i][0] - verts[j][0], verts[i][1] - verts[j][1], verts[i][2] - verts[j][2]);
      if (d < min * 1.01) e.push([i, j]);
    }
  return e;
}
function normalize(vs) {
  const m = Math.max(...vs.map((v) => Math.hypot(...v)));
  return vs.map((v) => v.map((c) => c / m));
}
const SOLIDS = (() => {
  const tetra = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  const cube = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) cube.push([x, y, z]);
  const octa = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const ico = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) ico.push([0, a, b], [a, b, 0], [b, 0, a]);
  const dode = [...cube];
  for (const a of [-1, 1]) for (const b of [-1, 1]) dode.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [b * PHI, 0, a / PHI]);
  const list = [
    ["tetra", tetra, "#ff6b6b"],
    ["cube", cube, "#ffd45a"],
    ["octa", octa, "#7af08f"],
    ["dodeca", dode, "#5fe3ff"],
    ["icosa", ico, "#c48bff"],
  ];
  return list.map(([name, v, color]) => {
    const verts = normalize(v);
    return { name, verts, edges: edgesFor(verts), color };
  });
})();

export function drawSolid(ctx, x, y, r, solid, ax, ay, alpha = 1) {
  const ca = Math.cos(ax);
  const sa = Math.sin(ax);
  const cb = Math.cos(ay);
  const sb = Math.sin(ay);
  const pts = solid.verts.map(([vx, vy, vz]) => {
    const y1 = vy * ca - vz * sa;
    const z1 = vy * sa + vz * ca;
    const x2 = vx * cb + z1 * sb;
    const z2 = -vx * sb + z1 * cb;
    const k = 1 + z2 * 0.18;
    return [x + x2 * r * k, y + y1 * r * k, z2];
  });
  ctx.save();
  ctx.globalAlpha = alpha;
  glow(ctx, x, y, r * 2.1, solid.color, 0.45);
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = OUT;
  for (const [i, j] of solid.edges) {
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[j][0], pts[j][1]);
    ctx.stroke();
  }
  for (const [i, j] of solid.edges) {
    const depth = (pts[i][2] + pts[j][2]) / 2;
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = depth > 0 ? "#ffffff" : solid.color;
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[j][0], pts[j][1]);
    ctx.stroke();
  }
  ctx.restore();
}

// ----------------------------------------------------- art
function hairBlob(ctx, pts, r) {
  for (const [x, y] of pts) circle(ctx, x, y, r, C.hair, OUT, 3.5);
  for (const [x, y] of pts) circle(ctx, x, y, r - 3, C.hair, null);
}

function head(ctx, R, face) {
  hairBlob(ctx, [[-34, -30], [-44, -12], [-42, 8], [-30, 22], [-14, -46], [6, -48]], 14);
  headBase(ctx, R, C.skin, C.shade);
  ear(ctx, -10, 6, C.skin, C.shade);
  hairBlob(ctx, [[22, -36], [6, -44], [-12, -44], [-28, -36], [-36, -22]], 12);
  ctx.strokeStyle = C.band;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-38, -24);
  ctx.quadraticCurveTo(0, -38, 34, -26);
  ctx.stroke();
  ctx.fillStyle = "#3f8a3a";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(-30 + i * 9, -28 - i * 2, 6, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // full beard
  shape(ctx, [[-8, 10], [-12, 36, 6, 48], [26, 56, 42, 38], [48, 24, 42, 16], [30, 20], [14, 18]], C.hair, OUT, 4);
  hairBlob(ctx, [[0, 42], [16, 50], [32, 44]], 9);
  ctx.strokeStyle = C.gray;
  ctx.lineWidth = 2.5;
  line(ctx, [[8, 30], [12, 42]]);
  line(ctx, [[26, 30], [28, 42]]);
  if (face === "angry" || face === "hurt" || face === "ko" || face === "happy") mouth(ctx, face, 28, 24, { w: 12 });
  shape(ctx, [[20, 16], [32, 10, 46, 16], [38, 24, 28, 20], [22, 24, 20, 16]], C.hair, OUT, 3);
  brows(ctx, face, 13, 31, -2, C.hair, 5);
  eyes(ctx, face, 13, 31, -1);
  nose(ctx, 41, 6, 1.1, C.skin, C.shade);
}

function torso(ctx, w, top) {
  shape(ctx, [[-w * 0.46, top + 14], [-w * 0.18, top - 2], [-w * 0.12, top + 8], [-w * 0.3, top + 28]], C.skin, OUT, 3);
  shape(ctx, [[w * 0.12, top], [w * 0.44, top + 10], [-w * 0.2, -4], [-w * 0.46, -10]], C.togaShade, OUT, 3);
  ctx.strokeStyle = C.trim;
  ctx.lineWidth = 4;
  line(ctx, [[w * 0.44, top + 10], [-w * 0.2, -4]]);
  ctx.strokeStyle = "rgba(10,20,50,0.35)";
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(w * (0.3 - i * 0.12), top + 18 + i * 8);
    ctx.quadraticCurveTo(w * (0.1 - i * 0.1), top + 40, w * (-0.1 - i * 0.12), -12);
    ctx.stroke();
  }
  ctx.fillStyle = C.trim;
  ctx.fillRect(-w * 0.48, -18, w * 0.96, 5);
}

function overLegs(ctx, J) {
  skirt(ctx, J, C.toga, C.trim, { len: 1.05 });
}

const style = {
  skin: C.skin,
  skinShade: C.shade,
  sleeve: C.skin,
  forearm: C.skin,
  top: C.toga,
  thigh: C.skin,
  shin: C.skin,
  pants: C.skin,
  shoe: C.sandal,
  sandal: true,
  torsoW: 66,
  armW: 19,
  head,
  torso,
  overLegs,
};

// ----------------------------------------------------- projectiles
function drawCube(ctx, p) {
  for (let i = 1; i <= 3; i++) {
    ctx.globalAlpha = 0.12 * (4 - i);
    ctx.fillStyle = C.violet;
    ctx.beginPath();
    ctx.arc(p.x - p.vx * i * 2.5, -p.y, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawSolid(ctx, p.x, -p.y, 28, SOLIDS[1], p.age * 0.09, p.age * 0.13);
}

function drawPillar(ctx, p) {
  const h = p.h;
  const x = p.x;
  if (h < 4) {
    ctx.strokeStyle = "rgba(255,240,200,0.8)";
    ctx.lineWidth = 3;
    for (let i = -2; i <= 2; i++) line(ctx, [[x + i * 12, 0], [x + i * 18, 8]]);
    return;
  }
  ctx.save();
  const g = ctx.createLinearGradient(x - 38, 0, x + 38, 0);
  g.addColorStop(0, "#b8a88a");
  g.addColorStop(0.4, "#f4ead2");
  g.addColorStop(1, "#a8987a");
  ctx.fillStyle = g;
  ctx.fillRect(x - 32, -h, 64, h);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.strokeRect(x - 32, -h, 64, h);
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) line(ctx, [[x - 32 + i * 16, -h + 14], [x - 32 + i * 16, 0]]);
  rr(ctx, x - 42, -h - 14, 84, 16, 3, "#e9dcc0", OUT, 4);
  glow(ctx, x, -h, 70, "#fff2c8", 0.4);
  ctx.restore();
}

// ----------------------------------------------------- moves
const raise = { hip: [0, -98], lean: -6, head: -12, hF: [50, -246], hB: [-40, -236], fF: [20, -14], fB: [-20, -14], face: "angry" };

const moves = {
  S: {
    name: "이데아 큐브",
    desc: "완벽한 형상. 상대 투사체를 부수고 계속 날아간다.",
    kind: "special",
    frames: 40,
    startup: 13,
    anim: castAnim(13, 40),
    hits: [],
    update(t, f, b) {
      if (t === 13) {
        shoot(f, b, {
          dx: 92,
          dy: 150,
          speed: 8.4,
          w: 54,
          h: 54,
          life: 150,
          strength: 2,
          color: C.violet,
          hit: hit({ dmg: 64, chip: 9, stun: 20, bstun: 16, push: 6, spark: "s", stop: 10, tint: C.violet }),
          draw: drawCube,
          onDie: (p, bb) => burst(bb, p, C.violet, 10),
        });
        b.sfx("cube");
      }
    },
  },
  "6S": {
    name: "동굴의 그림자 이동",
    desc: "그림자로 사라졌다가 상대 등 뒤에서 나타난다.",
    kind: "special",
    frames: 46,
    startup: 30,
    invuln: [6, 32],
    noLimb: true,
    anim: keyframes([[0, P.stance], [10, { ...P.crouch, lean: 40, face: "angry" }], [26, { ...P.crouch, lean: 40 }], [36, P.stance, ease.outQuad], [46, P.stance]]),
    hits: [],
    update(t, f, b) {
      if (t >= 6 && t < 14) f.alpha = 1 - (t - 6) / 8;
      f.hidden = t >= 14 && t < 26;
      if (t >= 26 && t < 34) f.alpha = (t - 26) / 8;
      if (t >= 34) f.alpha = 1;
      if (t === 6 || t === 26) {
        b.sfx("teleport");
        b.fx.dust(f.x, 0, 12, "#1a1020");
        b.fx.ring(f.x, 110, C.violet, 7, 16, 5);
      }
      if (t === 20) {
        const o = f.opp;
        const side = f.x < o.x ? 1 : -1;
        let nx = o.x + side * 120;
        if (nx < WALL + 20 || nx > STAGE_W - WALL - 20) nx = o.x - side * 120;
        f.x = clamp(nx, WALL, STAGE_W - WALL);
        f.facing = o.x > f.x ? 1 : -1;
      }
    },
  },
  "2S": {
    name: "철인의 기둥",
    desc: "앞쪽 땅에서 대리석 기둥이 솟아 상대를 띄운다.",
    kind: "special",
    frames: 48,
    startup: 16,
    anim: keyframes([
      [0, P.stance],
      [8, { hip: [0, -100], lean: -6, hF: [40, -230], hB: [10, -210], fF: [26, 0], fB: [-26, 0], face: "angry" }, ease.outQuad],
      [14, { hip: [10, -56], lean: 40, hF: [90, -10], hB: [60, -14], fF: [40, 0], fB: [-36, 0], face: "angry" }, ease.inQuad],
      [32, { hip: [10, -56], lean: 38, hF: [88, -12], hB: [60, -14], fF: [40, 0], fB: [-36, 0], face: "angry" }],
      [48, P.stance],
    ]),
    hits: [],
    update(t, f, b) {
      if (t === 14) {
        b.shake(4);
        b.sfx("pillar");
        const x = clamp(f.x + f.facing * 250, WALL, STAGE_W - WALL);
        b.fx.dust(x, 0, 8, "#e9dcc0");
        b.spawn({
          owner: f,
          x,
          y: 0,
          vx: 0,
          w: 70,
          h: 0,
          life: 40,
          behind: true,
          clash: false,
          homable: false,
          hitsLeft: 1,
          hit: hit({ dmg: 82, chip: 10, launch: [1.5, 16], kd: true, spark: "h", stop: 12, bstun: 16, sfx: "hit_h" }),
          update(p) {
            const a = p.age;
            const H = a < 4 ? 0 : a < 10 ? ((a - 4) / 6) * 270 : a < 30 ? 270 : Math.max(0, 270 - (a - 30) * 30);
            p.h = H;
            p.y = H / 2;
            if (a < 4) p.hitsLeft = 0;
            else if (a === 4) p.hitsLeft = 1;
            if (a > 30) p.hitsLeft = 0;
          },
          draw: drawPillar,
        });
      }
    },
  },
  X: {
    name: "이데아계 강림",
    desc: "다섯 정다면체를 소환해 하나씩 날린다.",
    kind: "super",
    frames: 96,
    startup: 30,
    line: "우리가 보는 것은 진짜의 그림자일 뿐.",
    anim: keyframes([[0, P.stance], [12, raise, ease.outQuad], [80, raise], [96, P.stance]]),
    hits: [],
    update(t, f, b) {
      if (t === 10) {
        b.sfx("power");
        SOLIDS.forEach((solid, i) => {
          const launchAt = 22 + i * 8;
          b.spawn({
            owner: f,
            x: f.x,
            y: f.y + 170,
            w: 60,
            h: 60,
            life: 200,
            hitsLeft: 0,
            super: true,
            strength: 99,
            homable: false,
            color: solid.color,
            hit: hit({ dmg: i === 4 ? 90 : 58, chip: 10, stun: 24, bstun: 16, push: 4, spark: "s", stop: 8, tint: solid.color, launch: i === 4 ? [8, 13] : null, kd: i === 4 }),
            update(p, bb) {
              if (!p.launched) {
                const ang = p.age * 0.14 + (i * Math.PI * 2) / 5;
                p.x = f.x + Math.cos(ang) * 110;
                p.y = f.y + 190 + Math.sin(ang) * 70;
                p.vx = 0;
                p.vy = 0;
                if (p.age >= launchAt) {
                  p.launched = true;
                  p.hitsLeft = 1;
                  const o = f.opp;
                  const dx = o.x - p.x;
                  const dy = o.y + 110 - p.y;
                  const d = Math.hypot(dx, dy) || 1;
                  p.vx = (dx / d) * 15;
                  p.vy = (dy / d) * 15;
                  bb.sfx("cube");
                }
              }
            },
            draw: (ctx, p) => drawSolid(ctx, p.x, -p.y, 30, solid, p.age * 0.1 + i, p.age * 0.13),
            onDie: (p, bb) => burst(bb, p, solid.color, 8),
          });
        });
      }
    },
  },
};

export default {
  id: "plato",
  name: "플라톤",
  short: "PLATO",
  en: "PLATO",
  title: "이데아의 설계자",
  faction: "philosophy",
  color: C.violet,
  colorB: "#231a48",
  quote: "완벽한 한 방은 이데아 속에 존재한다.",
  bio: "어깨가 넓어 '플라톤'이라 불린 레슬러 출신 철학자. 완벽한 형상을 던지고, 그림자 속으로 사라졌다 등 뒤에서 나타나며, 땅에서 철인의 기둥을 세운다.",
  winQuotes: ["당신이 본 건 내 그림자에 불과했소.", "동굴 밖으로 나오시오. 빛이 눈부실 거요.", "철인이 통치하는 세상, 첫 판결이오.", "레슬링은 내가 먼저였다네."],
  stats: { power: 4, speed: 3, range: 4, tech: 4 },
  health: 1040,
  walk: 3.8,
  back: 3.2,
  scale: 1.05,
  passive: { name: "완벽한 형상", desc: "이데아 큐브는 상대 투사체와 부딪혀도 사라지지 않고 뚫고 나간다." },
  style,
  moves,
  ai: { zoner: true, projectile: "S", antiAir: "2S", teleport: "6S", range: 400 },
};
