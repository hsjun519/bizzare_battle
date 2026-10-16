// 일론 머스크 — 로켓과 밈으로 싸우는 파괴적 혁신가.
import { keyframes, shape, circle, ellipse, line, OUT, headBase, eyes, brows, mouth, ear, nose, rr, handFrame } from "../render/rig.js";
import { P } from "../render/poses.js";
import { ease, clamp } from "../core/util.js";
import { hit, castAnim, shoot, glow, burst } from "./kit.js";

const C = {
  skin: "#f0c4a4",
  shade: "#d29d7d",
  hair: "#3d2b20",
  hairHi: "#5e4434",
  tee: "#1d1d24",
  jeans: "#2a3040",
  shoe: "#121214",
  blue: "#5aa9ff",
  steel: "#d8dde4",
  coin: "#ffcf3a",
};

function head(ctx, R, face) {
  headBase(ctx, R, C.skin, C.shade, { tall: 1.03 });
  ear(ctx, -10, 6, C.skin, C.shade);
  shape(ctx, [[32, -24], [38, -40, 22, -48], [0, -56, -28, -46], [-46, -32, -44, -6], [-36, -8], [-28, -24, -6, -30], [14, -34, 32, -24]], C.hair, OUT, 4);
  ctx.strokeStyle = C.hairHi;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  line(ctx, [[22, -44], [4, -50]]);
  line(ctx, [[-6, -44], [-24, -40]]);
  brows(ctx, face, 14, 31, -1, C.hair, 4.5);
  eyes(ctx, face, 14, 31, -1);
  nose(ctx, 40, 6, 1, C.skin, C.shade);
  if (face === "normal" || !face) {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(16, 24);
    ctx.quadraticCurveTo(26, 26, 34, 18);
    ctx.stroke();
  } else mouth(ctx, face, 24, 22, { w: 15 });
  // jaw line
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.quadraticCurveTo(18, 40, 34, 30);
  ctx.stroke();
}

function torso(ctx, w, top) {
  ctx.strokeStyle = "#34343f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w * 0.06, top + 2, 12, 0.1, Math.PI - 0.1);
  ctx.stroke();
  // little rocket print
  ctx.save();
  ctx.translate(w * 0.08, top + 36);
  shape(ctx, [[0, -15], [6, -6], [6, 8], [-6, 8], [-6, -6]], "#f2f4f8", null);
  shape(ctx, [[-6, 4], [-11, 12], [-6, 10]], "#f2f4f8", null);
  shape(ctx, [[6, 4], [11, 12], [6, 10]], "#f2f4f8", null);
  ctx.fillStyle = "#ff8a3a";
  ctx.fillRect(-3, 9, 6, 5);
  ctx.restore();
}

function propFront(ctx, J, p, opts) {
  const f = opts.fighter;
  if (!f || f.state !== "attack" || f.moveId !== "6S" || f.mt < 32 || f.mt > 46) return;
  const h = handFrame(J.armF);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.ang);
  const spin = (f.b.realFrame % 4) * 3;
  shape(ctx, [[0, -14], [54, 0], [0, 14]], "#9aa3ad", OUT, 4);
  ctx.strokeStyle = "#5c6470";
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) line(ctx, [[8 + i * 11 + spin * 0.3, -11 + i * 2.5], [14 + i * 11 + spin * 0.3, 11 - i * 2.5]]);
  ctx.restore();
}

const style = {
  skin: C.skin,
  skinShade: C.shade,
  sleeve: C.tee,
  forearm: C.skin,
  top: C.tee,
  pants: C.jeans,
  shoe: C.shoe,
  torsoW: 52,
  head,
  torso,
  propFront,
};

// ------------------------------------------------------------ projectiles
function drawDoge(ctx, p) {
  const x = p.x;
  const y = -p.y;
  glow(ctx, x, y, 46, "#ffd86a", 0.45);
  ctx.save();
  ctx.translate(x, y);
  const squash = Math.abs(Math.cos(p.age * 0.18));
  ctx.scale(0.35 + squash * 0.65, 1);
  circle(ctx, 0, 0, 22, C.coin, OUT, 4);
  circle(ctx, 0, 0, 16, "#ffe07a", "#d9a21a", 2.5);
  // shiba silhouette
  ctx.fillStyle = "#c98a2a";
  ctx.beginPath();
  ctx.moveTo(-9, 8);
  ctx.lineTo(-10, -6);
  ctx.lineTo(-6, -12);
  ctx.lineTo(-3, -5);
  ctx.lineTo(3, -5);
  ctx.lineTo(6, -12);
  ctx.lineTo(10, -6);
  ctx.lineTo(9, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = OUT;
  ctx.fillRect(-5, -1, 3, 3);
  ctx.fillRect(3, -1, 3, 3);
  ctx.restore();
}

function drawRocket(ctx, p) {
  const dir = Math.sign(p.vx) || 1;
  const x = p.x;
  const y = -p.y;
  // exhaust
  for (let i = 0; i < 4; i++) {
    const fl = 60 + Math.sin(p.age * 1.3 + i) * 18 + i * 22;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = ["#fff6c8", "#ffd25a", "#ff8a2a", "#ff4d2a"][i];
    ctx.globalAlpha = 0.85 - i * 0.15;
    ctx.beginPath();
    ctx.moveTo(x - dir * 120, y - 34 + i * 6);
    ctx.quadraticCurveTo(x - dir * (120 + fl * 1.4), y, x - dir * 120, y + 34 - i * 6);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const g = ctx.createLinearGradient(0, -40, 0, 40);
  g.addColorStop(0, "#f6f8fb");
  g.addColorStop(0.5, "#c7ced8");
  g.addColorStop(1, "#8a93a1");
  shape(ctx, [[-120, -38], [70, -38], [128, 0], [70, 38], [-120, 38]], g, OUT, 5);
  ctx.fillStyle = "#2b2f38";
  ctx.fillRect(-110, 18, 180, 16);
  shape(ctx, [[-120, -38], [-150, -70], [-92, -38]], "#9aa3b0", OUT, 4);
  shape(ctx, [[-120, 38], [-150, 70], [-92, 38]], "#9aa3b0", OUT, 4);
  shape(ctx, [[40, -38], [62, -62], [76, -34]], "#9aa3b0", OUT, 4);
  ctx.fillStyle = "#1c2028";
  ctx.font = "900 20px Bungee, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (dir < 0) ctx.scale(-1, 1);
  ctx.fillText("STARSHIP", dir < 0 ? 20 : -20, -10);
  ctx.restore();
}

function drawShock(ctx, p) {
  const u = p.age / 10;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - u);
  ctx.strokeStyle = "#ffb84a";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(p.x, -6, 60 + u * 120, 14 + u * 10, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMound(ctx, f) {
  const x = f.x;
  const k = f.b.realFrame;
  ctx.fillStyle = "#6b4a2e";
  ctx.beginPath();
  ctx.ellipse(x, 0, 46, 22, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.save();
  ctx.translate(x + f.facing * 30, -18);
  ctx.scale(f.facing, 1);
  ctx.rotate(-0.4);
  shape(ctx, [[0, -10], [40, 0], [0, 10]], "#9aa3ad", OUT, 3);
  ctx.strokeStyle = "#5c6470";
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) line(ctx, [[6 + i * 10 + (k % 3) * 2, -8 + i * 2], [10 + i * 10 + (k % 3) * 2, 8 - i * 2]]);
  ctx.restore();
}

// ------------------------------------------------------------ moves
const rocketPoint = { hip: [4, -88], lean: 2, head: -8, hF: [90, -190], hB: [-20, -120], fF: [28, 0], fB: [-28, 0], face: "happy" };

const moves = {
  S: {
    name: "도지 코인 투척",
    desc: "포물선으로 날아가 한 번 튀는 코인. 앉은 상대도 노린다.",
    kind: "special",
    frames: 40,
    startup: 14,
    anim: castAnim(14, 40, { throwPose: { ...P.cast, hF: [80, -196], hB: [40, -150] } }),
    hits: [],
    update(t, f, b) {
      if (t === 14) {
        shoot(f, b, {
          dx: 70,
          dy: 180,
          speed: 6.8,
          vy: 9.5,
          gravity: 0.42,
          w: 44,
          h: 44,
          life: 170,
          ground: 0,
          bounces: 1,
          color: C.coin,
          onGround(p, bb) {
            if (p.bounces-- > 0) {
              p.vy = 7.5;
              p.y = p.h / 2 + 1;
              bb.sfx("coin");
              bb.fx.dust(p.x, 0, 3, "#ffd447");
            } else bb.killProjectile(p, true);
          },
          hit: hit({ dmg: 60, chip: 8, stun: 20, bstun: 15, push: 5, spark: "s", stop: 9, tint: C.coin, sfx: "coin" }),
          draw: drawDoge,
          onDie: (p, bb) => {
            burst(bb, p, C.coin, 8);
            bb.fx.debris(p.x, p.y, 6, { shape: "coin", speed: 5, up: 4, life: 40 });
          },
        });
        b.sfx("coin");
      }
    },
  },
  "6S": {
    name: "보링 컴퍼니 드릴",
    desc: "땅속으로 파고들어 이동한 뒤 드릴 어퍼로 튀어나온다. 이동 중 무적.",
    kind: "special",
    frames: 60,
    startup: 34,
    invuln: [8, 34],
    noLimb: true,
    anim: keyframes([
      [0, P.stance],
      [8, { hip: [10, -46], lean: 70, head: 20, hF: [80, -40], hB: [70, -50], fF: [10, 0], fB: [-50, -20], face: "angry" }],
      [33, { ...P.crouch, face: "angry" }],
      [37, { hip: [10, -104], lean: -10, head: -12, hF: [44, -250], hB: [0, -140], fF: [24, 0], fB: [-20, -16], face: "angry" }, ease.outQuad],
      [46, { hip: [10, -104], lean: -8, head: -10, hF: [42, -246], hB: [0, -140], fF: [24, 0], fB: [-20, -16], face: "angry" }],
      [60, P.stance],
    ]),
    move: (t) => (t >= 10 && t < 32 ? { vx: 9.5 } : { vx: 0 }),
    hits: [hit({ at: [34, 42], box: [-10, 0, 100, 230], dmg: 95, chip: 10, launch: [3, 16], kd: true, spark: "h", stop: 13, sfx: "hit_h", bstun: 16 })],
    update(t, f, b) {
      f.hidden = t >= 10 && t < 33;
      if (t === 8) {
        b.sfx("drill");
        b.fx.dust(f.x, 0, 10, "#a07850");
      }
      if (f.hidden && t % 3 === 0) b.fx.debris(f.x, 6, 2, { color: ["#7a5a3a", "#a07850"], angle: Math.PI / 2, spread: 1.2, speed: 6, size: 7, life: 30 });
      if (t === 33) {
        b.fx.debris(f.x, 10, 16, { color: ["#7a5a3a", "#a07850", "#5a4030"], angle: Math.PI / 2, spread: 1.4, speed: 10, size: 9, life: 40 });
        b.sfx("explosion");
        b.shake(5);
      }
    },
  },
  "2S": {
    name: "팰컨 착륙",
    desc: "상대 위치로 날아올라 내리꽂는 중단 공격. 착지 충격파는 하단.",
    kind: "special",
    frames: 90,
    startup: 6,
    landLag: 18,
    anim: (t, f) => {
      if (t < 6) return { ...P.crouch, face: "angry" };
      if (f && f.vy > 2) return { ...P.jumpUp, hF: [30, -200], hB: [-30, -200], face: "angry" };
      return { hip: [0, -100], lean: 4, head: 6, hF: [50, -170], hB: [-40, -170], fF: [10, -6], fB: [-10, -10], face: "angry" };
    },
    move(t, f) {
      if (t === 6) {
        const dx = clamp(f.opp.x - f.x, -420, 420);
        return { vx: (dx / 44) * f.facing, vy: 21, raw: true };
      }
      return undefined;
    },
    hits: [hit({ at: [18, 90], box: [-44, -24, 120, 80], dmg: 85, chip: 10, level: "high", launch: [4, 9], kd: true, spark: "h", stop: 13, sfx: "hit_h", bstun: 18, when: (f) => f.vy < 0 })],
    update(t, f, b) {
      if (t === 6) b.sfx("boost");
      if (t > 6 && f.y > 0 && t % 2 === 0) {
        b.fx.add({ type: "dust", x: f.x + (b.rng() - 0.5) * 20, y: f.y - 4, vx: 0, vy: -3, r: 8, grow: 0.8, life: 16, color: "#ffb84a" }, true);
      }
    },
    onLand(f, b) {
      b.shake(7);
      b.sfx("slam");
      b.fx.dust(f.x, 0, 14);
      b.spawn({ owner: f, x: f.x, y: 18, vx: 0, w: 230, h: 36, life: 8, clash: false, homable: false, hit: hit({ dmg: 40, level: "low", launch: [3, 7], kd: false, spark: "h", stop: 8, bstun: 10 }), draw: drawShock });
    },
  },
  X: {
    name: "스타십 발사",
    desc: "등 뒤에서 스타십이 발사되어 화면을 가로지른다.",
    kind: "super",
    frames: 72,
    startup: 16,
    line: "다음 정거장은 화성입니다.",
    anim: keyframes([[0, P.stance], [12, rocketPoint, ease.outQuad], [60, rocketPoint], [72, P.stance]]),
    hits: [],
    update(t, f, b) {
      if (t === 16) {
        const final = hit({ dmg: 70, chip: 10, launch: [9, 14], kd: true, spark: "super", stop: 16, bstun: 18 });
        b.spawn({
          owner: f,
          x: f.x - f.facing * 140,
          y: 110,
          vx: f.facing * 13.5,
          w: 260,
          h: 110,
          life: 150,
          hits: 7,
          every: 5,
          super: true,
          strength: 99,
          homable: false,
          hit: hit({ dmg: 40, chip: 7, stun: 26, bstun: 18, push: 2.5, spark: "h", stop: 5 }),
          onHit(p) {
            if (p.hitsLeft === 1) p.hit = final;
          },
          update(p, bb) {
            if (p.age % 2 === 0) bb.fx.add({ type: "dust", x: p.x - Math.sign(p.vx) * 150, y: p.y + (bb.rng() - 0.5) * 40, vx: -p.vx * 0.1, vy: 0.5, r: 14, grow: 1.4, life: 30, color: "#d8d8e0" }, false);
          },
          draw: drawRocket,
        });
        b.sfx("rocket");
        b.shake(8);
      }
    },
  },
};

export default {
  id: "musk",
  name: "일론 머스크",
  short: "MUSK",
  en: "ELON MUSK",
  title: "화성에서 온 파괴자",
  faction: "capital",
  color: C.blue,
  colorB: "#132542",
  quote: "불가능? 그건 다음 분기 목표죠.",
  bio: "밈과 로켓으로 판을 뒤집는 혁신가. 땅을 파고, 하늘에서 떨어지고, 결국 스타십으로 상대를 궤도 밖으로 날려 보낸다.",
  winQuotes: ["이 승리, 바로 트윗합니다.", "다음 라운드는 화성에서 하죠.", "가능성이 낮아도, 중요하면 합니다.", "실패는 옵션입니다. 이번엔 아니었지만."],
  stats: { power: 4, speed: 3, range: 4, tech: 4 },
  health: 1000,
  walk: 4.0,
  back: 3.3,
  jump: 20,
  scale: 1.04,
  passive: { name: "하이프 머신", desc: "무엇을 하든 화제가 된다. 필살기 게이지 획득량 +25%." },
  style,
  hooks: { meterMult: () => 1.25 },
  drawHidden: drawMound,
  moves,
  ai: { zoner: false, projectile: "S", antiAir: "2H", rush: "6S", range: 300 },
};
