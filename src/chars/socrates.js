// 소크라테스 — 질문으로 때리는 아테네의 등에.
import { keyframes, shape, circle, ellipse, line, OUT, headBase, eyes, brows, mouth, ear, rr, handFrame } from "../render/rig.js";
import { P } from "../render/poses.js";
import { ease } from "../core/util.js";
import { hit, castAnim, shoot, glow, burst, worldText, skirt, bubble } from "./kit.js";

const C = {
  skin: "#dba47e",
  shade: "#b98260",
  beard: "#efece4",
  beardShade: "#cfc9bc",
  toga: "#efe6d2",
  togaShade: "#cdbf9f",
  rope: "#a6804e",
  sandal: "#7a5232",
  sky: "#8fd3ff",
};

const QUESTIONS = ["정의란 무엇인가?", "그건 왜 그렇지?", "확실한가?", "근거는?", "그렇다면 넌 모르는 것 아닌가?", "다시 묻겠네."];

function curls(ctx, pts, r, fill) {
  for (const [x, y] of pts) circle(ctx, x, y, r, fill, OUT, 3);
  for (const [x, y] of pts) circle(ctx, x, y, r - 2.5, fill, null);
}

function head(ctx, R, face) {
  // fringe of curls around the back
  curls(ctx, [[-36, -18], [-42, -2], [-38, 14], [-26, 24], [-12, 28]], 10, C.beard);
  headBase(ctx, R, C.skin, C.shade, { wide: 1.02 });
  // bald shine
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-4, -30, 16, 7, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ear(ctx, -12, 4, C.skin, C.shade);
  curls(ctx, [[-30, -10], [-34, 4]], 8, C.beard);
  // big curly beard
  shape(ctx, [[-6, 12], [-14, 40, 4, 56], [22, 66, 40, 50], [50, 36, 44, 18], [34, 22], [20, 18], [6, 20]], C.beard, OUT, 4);
  curls(ctx, [[-4, 46], [10, 58], [26, 60], [40, 48]], 9, C.beard);
  ctx.strokeStyle = C.beardShade;
  ctx.lineWidth = 2.5;
  for (const [x, y] of [[8, 36], [22, 40], [32, 34]]) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0.3, 2.6);
    ctx.stroke();
  }
  if (face === "angry" || face === "hurt" || face === "ko" || face === "happy") mouth(ctx, face, 28, 26, { w: 13 });
  // moustache
  shape(ctx, [[22, 18], [32, 12, 46, 18], [40, 26, 30, 22], [24, 26, 22, 18]], C.beard, OUT, 3);
  // bushy brows and bulging eyes
  brows(ctx, face, 12, 30, -2, OUT, 9, 2);
  brows(ctx, face, 12, 30, -2, C.beard, 5.5, 2);
  for (const x of [12, 30]) ellipse(ctx, x, -1, 7, 8, 0, "#ffffff", OUT, 2);
  eyes(ctx, face, 13, 31, -1, { size: 0.85 });
  // snub nose
  circle(ctx, 41, 8, 9, C.skin, OUT, 3.5);
  ctx.fillStyle = C.shade;
  ctx.beginPath();
  ctx.arc(43, 12, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function torso(ctx, w, top) {
  // bare back shoulder
  shape(ctx, [[-w * 0.46, top + 14], [-w * 0.18, top - 2], [-w * 0.1, top + 6], [-w * 0.3, top + 26]], C.skin, OUT, 3);
  // drape from front shoulder to back hip
  shape(ctx, [[w * 0.12, top], [w * 0.44, top + 10], [-w * 0.2, -4], [-w * 0.46, -10]], C.togaShade, OUT, 3);
  ctx.strokeStyle = "rgba(120,100,70,0.35)";
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(w * (0.3 - i * 0.12), top + 18 + i * 8);
    ctx.quadraticCurveTo(w * (0.1 - i * 0.1), top + 40, w * (-0.1 - i * 0.12), -12);
    ctx.stroke();
  }
  ctx.fillStyle = C.rope;
  ctx.fillRect(-w * 0.48, -18, w * 0.96, 6);
}

function overLegs(ctx, J) {
  skirt(ctx, J, C.toga, C.togaShade, { len: 1.05 });
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
  torsoW: 62,
  armW: 18,
  head,
  torso,
  overLegs,
};

// ------------------------------------------------------------ projectiles
function drawQuestion(ctx, p) {
  const x = p.x;
  const y = -p.y;
  glow(ctx, x, y, 54, C.sky, 0.45);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(p.age * 0.3) * 0.2);
  bubble(ctx, 0, 0, 58, 54, "#ffffff", OUT, -Math.sign(p.vx) || 1);
  ctx.font = "900 44px Bungee, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = OUT;
  ctx.strokeText("?", 0, 3);
  ctx.fillStyle = "#3a8fd8";
  ctx.fillText("?", 0, 3);
  ctx.restore();
}

function drawGadfly(ctx, p) {
  const x = p.x;
  const y = -p.y;
  const dir = Math.sign(p.vx) || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const flap = Math.sin(p.age * 1.8) * 0.6;
  ctx.fillStyle = "rgba(220,240,255,0.75)";
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.rotate(s * (0.5 + flap));
    ctx.beginPath();
    ctx.ellipse(-4, -14 * s, 9, 16, 0.3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ellipse(ctx, 0, 0, 16, 10, 0, "#3a3328", OUT, 3);
  ctx.fillStyle = "#e8c15a";
  ctx.fillRect(-8, -8, 4, 16);
  ctx.fillRect(0, -8, 4, 16);
  circle(ctx, 14, -2, 7, "#2a241c", OUT, 2.5);
  circle(ctx, 16, -4, 3, "#c03030", null);
  ctx.restore();
  if (p.age % 20 < 10) worldText(ctx, "윙~", x, y - 30, 14, "#ffffff");
}

// ------------------------------------------------------------ moves
const poke = (n) => ({
  hip: [10, -86],
  lean: 16,
  head: 4,
  hF: n % 2 ? [112, -156] : [96, -136],
  hB: n % 2 ? [40, -130] : [104, -150],
  fF: [38, 0],
  fB: [-26, 0],
  face: "angry",
});

const MAIEUTICS = {
  frames: 128,
  sfx: "grab",
  hold: (t) => ({ x: 92, y: 0, rot: 0 }),
  victimPose: (t) => ({ ...P.hurtHigh, head: -16 + Math.sin(t * 0.4) * 8, face: t % 30 < 15 ? "hurt" : "ko" }),
  attPose: (t) => (t >= 108 ? { ...P.cast, hF: [118, -150], hB: [100, -140], face: "angry" } : { ...P.taunt, hF: [70 + Math.sin(t * 0.5) * 16, -170 + Math.cos(t * 0.5) * 10], face: t % 18 < 9 ? "angry" : "happy" }),
  events(t, g, b) {
    const { att, def } = g;
    const beats = [10, 28, 46, 64, 82, 98];
    const i = beats.indexOf(t);
    if (i >= 0) {
      b.grabTick(att, def, 16, QUESTIONS[i], C.sky);
      b.sfx("question");
    }
    if (t === 106) {
      b.fx.text(def.x, def.y + 300, "!!", "#ffffff", 70, 40);
      b.flashScreen("#8fd3ff", 6, 0.5);
    }
  },
  release: { at: 110, dmg: 175, launch: [8, 14], kd: true, spark: "super", super: true, stop: 18 },
};

const moves = {
  S: {
    name: "질문 공세",
    desc: "흔들리며 날아가는 물음표. 상대의 논리에 구멍을 낸다.",
    kind: "special",
    frames: 40,
    startup: 12,
    anim: castAnim(12, 40, { throwPose: { ...P.cast, hF: [104, -170], hB: [-10, -130] } }),
    hits: [],
    update(t, f, b) {
      if (t === 12) {
        shoot(f, b, {
          dx: 90,
          dy: 160,
          speed: 8,
          w: 52,
          h: 56,
          life: 150,
          color: C.sky,
          hit: hit({ dmg: 62, chip: 9, stun: 20, bstun: 16, push: 6, spark: "s", stop: 10, tint: C.sky, sfx: "question" }),
          update(p) {
            p.vy = Math.cos(p.age * 0.22) * 2.2;
          },
          draw: drawQuestion,
          onDie: (p, bb) => burst(bb, p, C.sky, 8),
        });
        b.sfx("question");
      }
    },
  },
  "6S": {
    name: "논박술 연타",
    desc: "'왜?'를 연발하며 전진하는 손가락 연타.",
    kind: "special",
    frames: 48,
    startup: 8,
    noLimb: true,
    anim: (t) => {
      if (t < 8) return keyframes([[0, P.stance], [8, poke(0)]])(t);
      if (t < 32) return poke(Math.floor(t / 2));
      if (t < 37) return { ...P.cast, hF: [124, -150], hB: [110, -140], lean: 24, hip: [16, -84] };
      return keyframes([[37, P.cast], [48, P.stance]])(t);
    },
    move: (t) => (t >= 8 && t < 32 ? { vx: 2.6 } : { vx: 0 }),
    hits: [
      hit({ at: [8, 32], box: [20, 100, 110, 90], every: 4, max: 6, dmg: 12, chip: 2, stun: 13, bstun: 8, push: 0.8, spark: "l", stop: 3 }),
      hit({ at: [32, 36], box: [20, 90, 116, 100], dmg: 34, chip: 5, push: 9, stun: 22, bstun: 14, spark: "h", stop: 10, sfx: "hit_h" }),
    ],
    cancel: { super: true },
    update(t, f, b) {
      if (t >= 8 && t < 32 && t % 6 === 0) {
        const q = ["왜?", "정말?", "근거는?", "그렇다면?"][(t / 6) % 4];
        b.fx.text(f.x + f.facing * (120 + b.rng() * 40), f.y + 200 + b.rng() * 50, q, "#ffffff", 24, 26, { rot: (b.rng() - 0.5) * 0.4 });
      }
    },
  },
  "2S": {
    name: "아테네의 등에",
    desc: "상대를 끈질기게 쫓아가는 등에. 하나만 유지된다.",
    kind: "special",
    frames: 36,
    startup: 12,
    anim: castAnim(12, 36, { throwPose: { ...P.cast, hF: [70, -230], hB: [10, -140], lean: -4 } }),
    hits: [],
    update(t, f, b) {
      if (t === 12) {
        for (const p of b.projectiles) if (p.owner === f && p.tag === "gadfly") b.killProjectile(p, true);
        shoot(f, b, {
          tag: "gadfly",
          dx: 50,
          dy: 220,
          speed: 3,
          w: 32,
          h: 32,
          life: 260,
          homable: false,
          color: "#e8c15a",
          hit: hit({ dmg: 46, chip: 6, stun: 18, bstun: 12, push: 3, spark: "l", stop: 8 }),
          update(p, bb) {
            const o = p.owner.opp;
            const tx = o.x - p.x;
            const ty = o.y + 170 - p.y;
            const want = Math.atan2(ty, tx);
            let cur = Math.atan2(p.vy, p.vx);
            let d = want - cur;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            cur += Math.max(-0.07, Math.min(0.07, d));
            const sp = Math.min(4.6, 3 + p.age * 0.02);
            p.vx = Math.cos(cur) * sp;
            p.vy = Math.sin(cur) * sp + Math.sin(p.age * 0.5) * 1.2;
            if (p.age % 40 === 1) bb.sfx("buzz");
          },
          draw: drawGadfly,
        });
      }
    },
  },
  X: {
    name: "산파술: 끝없는 문답",
    desc: "돌진해 붙잡은 뒤 질문 공세로 정신을 무너뜨린다. 가드 불가 잡기.",
    kind: "super",
    frames: 56,
    startup: 6,
    invuln: [1, 12],
    noLimb: true,
    line: "나는 내가 모른다는 것을 안다.",
    anim: keyframes([[0, P.stance], [6, { ...P.dashF, face: "angry" }], [28, { ...P.throwReach }], [56, P.stance]]),
    move: (t) => (t >= 6 && t < 28 ? { vx: 12 } : { vx: 0 }),
    hits: [hit({ at: [6, 30], box: [10, 0, 96, 230], grab: MAIEUTICS, dmg: 0 })],
    update(t, f, b) {
      if (t >= 6 && t < 28) f.trail = 2;
    },
  },
};

export default {
  id: "socrates",
  name: "소크라테스",
  short: "SOCRATES",
  en: "SOCRATES",
  title: "아테네의 등에",
  faction: "philosophy",
  color: C.sky,
  colorB: "#12304a",
  quote: "너 자신을 알라. 그리고 막아라.",
  bio: "질문 하나로 상대의 논리를 무너뜨리는 철학자. 물음표를 던지고, 등에를 풀어 괴롭히고, 마지막엔 끝나지 않는 문답으로 상대를 붙잡는다.",
  winQuotes: ["검토하지 않는 삶은 살 가치가 없다네.", "자네가 졌다는 걸, 자네도 이제 알겠지?", "나는 아무것도 모르지만, 이건 알지. 내가 이겼다는 것.", "자, 다음 질문."],
  stats: { power: 3, speed: 3, range: 4, tech: 3 },
  health: 1020,
  walk: 3.9,
  back: 3.3,
  scale: 0.97,
  passive: { name: "무지의 지", desc: "맞을수록 깨닫는다. 피격 시 필살기 게이지를 2배로 얻는다." },
  style,
  hooks: {
    onHurt(f, dmg) {
      f.gainMeter(dmg * 0.065);
    },
  },
  moves,
  ai: { zoner: true, projectile: "S", antiAir: "2H", rush: "6S", range: 360 },
};
