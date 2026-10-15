// Shared animation library. Every pose is facing right, feet at the origin.
import { pose, keyframes, lerpPose, shiftPose } from "./rig.js";
import { ease } from "../core/util.js";

export const P = {
  stance: pose({}),
  crouch: pose({ hip: [-2, -54], lean: 22, hF: [44, -104], hB: [28, -96], fF: [32, 0], fB: [-30, 0] }),
  jumpUp: pose({ hip: [0, -96], lean: 0, hF: [36, -166], hB: [-18, -176], fF: [22, -34], fB: [-16, -44] }),
  jumpDown: pose({ hip: [0, -94], lean: 4, hF: [40, -150], hB: [-8, -150], fF: [26, -8], fB: [-18, -16] }),
  flip: pose({ hip: [0, -110], lean: 40, hF: [30, -120], hB: [10, -114], fF: [18, -76], fB: [0, -70] }),
  blockHigh: pose({ hip: [-6, -84], lean: -4, hF: [26, -172], hB: [26, -150], fF: [22, 0], fB: [-32, 0], face: "block" }),
  blockLow: pose({ hip: [-6, -52], lean: 12, hF: [38, -122], hB: [32, -104], fF: [30, 0], fB: [-32, 0], face: "block" }),
  hurtHigh: pose({ hip: [-10, -84], lean: -20, head: -16, hF: [8, -116], hB: [-28, -118], fF: [24, 0], fB: [-32, 0], face: "hurt" }),
  hurtGut: pose({ hip: [-12, -78], lean: 30, head: 14, hF: [20, -98], hB: [4, -92], fF: [20, 0], fB: [-34, 0], face: "hurt" }),
  hurtLow: pose({ hip: [-8, -52], lean: 4, head: -10, hF: [16, -96], hB: [-10, -98], fF: [26, 0], fB: [-34, 0], face: "hurt" }),
  air: pose({ hip: [0, -100], lean: -36, head: -14, hF: [44, -200], hB: [-36, -186], fF: [30, -12], fB: [-20, -36], face: "hurt" }),
  lying: pose({ hip: [-6, -22], lean: -86, head: -6, hF: [-76, -30], hB: [-96, -14], fF: [70, -10], fB: [58, -20], eF: -1, eB: -1, face: "ko" }),
  lyingHurt: pose({ hip: [-6, -22], lean: -86, head: -6, hF: [-76, -30], hB: [-96, -14], fF: [70, -10], fB: [58, -20], eF: -1, eB: -1, face: "hurt" }),
  kneel: pose({ hip: [-10, -50], lean: 30, head: 8, hF: [40, -40], hB: [10, -40], fF: [30, 0], fB: [-36, -2], face: "hurt" }),
  dashF: pose({ hip: [10, -80], lean: 30, hF: [56, -128], hB: [-30, -118], fF: [44, -10], fB: [-40, -4] }),
  dashB: pose({ hip: [-8, -88], lean: -14, hF: [36, -150], hB: [10, -146], fF: [10, -14], fB: [-30, 0] }),
  throwReach: pose({ hip: [8, -84], lean: 18, hF: [86, -144], hB: [76, -132], fF: [34, 0], fB: [-26, 0], face: "angry" }),
  win: pose({ hip: [0, -88], lean: -6, head: -8, hF: [26, -244], hB: [10, -120], fF: [22, 0], fB: [-26, 0], face: "happy" }),
  taunt: pose({ hip: [0, -88], lean: -4, head: -10, hF: [64, -170], hB: [-24, -110], fF: [26, 0], fB: [-26, 0], face: "happy" }),
  cast: pose({ hip: [12, -84], lean: 16, hF: [100, -150], hB: [86, -140], fF: [40, 0], fB: [-30, 0], face: "angry" }),
  castWind: pose({ hip: [-6, -86], lean: -8, hF: [-20, -150], hB: [-34, -140], fF: [26, 0], fB: [-30, 0], face: "angry" }),
};

const bob = (t, amp = 2.5, speed = 0.09) => Math.sin(t * speed) * amp;

export const ANIM = {
  idle(t) {
    const b = bob(t);
    const p = shiftPose(P.stance, 0, 0);
    p.hip = [0, -86 + b];
    p.hF = [40, -140 + b * 1.2];
    p.hB = [24, -130 + b * 1.3];
    return p;
  },
  walk(t, dir = 1) {
    const ph = t * 0.16 * dir;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    return pose({
      hip: [2, -86 + Math.abs(c) * -3],
      lean: 8,
      hF: [40 + s * 4, -140],
      hB: [24 - s * 4, -130],
      fF: [12 + s * 24, -Math.max(0, c) * 14],
      fB: [-12 - s * 24, -Math.max(0, -c) * 14],
    });
  },
  crouch(t) {
    const b = bob(t, 1.5);
    const p = { ...P.crouch, hip: [-2, -54 + b] };
    return p;
  },
  jump(vy) {
    if (vy > 4) return P.jumpUp;
    if (vy < -4) return P.jumpDown;
    return lerpPose(P.jumpDown, P.jumpUp, (vy + 4) / 8);
  },
  flip(t) {
    // forward somersault while airborne
    return { ...P.flip, rot: (t * 22) % 360 };
  },
  land: keyframes([[0, { hip: [0, -60], lean: 14, fF: [30, 0], fB: [-30, 0], hF: [44, -110], hB: [26, -102] }], [5, P.stance]]),
  dashF(t) {
    return lerpPose(P.dashF, P.stance, Math.max(0, (t - 8) / 8));
  },
  dashB(t) {
    return lerpPose(P.dashB, P.stance, Math.max(0, (t - 10) / 8));
  },
  hurt(kind, t, total) {
    const base = kind === "low" ? P.hurtLow : kind === "gut" ? P.hurtGut : P.hurtHigh;
    const from = kind === "low" ? P.crouch : P.stance;
    const u = Math.min(1, t / 3);
    const back = Math.max(0, (t - total + 6) / 6);
    return lerpPose(lerpPose(from, base, u), kind === "low" ? P.crouch : P.stance, back);
  },
  airHurt(t, vy) {
    const p = { ...P.air };
    p.rot = Math.max(-60, Math.min(30, -vy * 3));
    return p;
  },
  knockdown(t) {
    return t < 5 ? lerpPose(P.air, P.lyingHurt, t / 5) : P.lyingHurt;
  },
  getup: keyframes([[0, P.lyingHurt], [8, P.kneel, ease.outQuad], [18, P.stance, ease.inOut]]),
  ko(t) {
    return t < 6 ? lerpPose(P.air, P.lying, t / 6) : P.lying;
  },
  win(t) {
    const p = { ...P.win };
    const b = Math.sin(t * 0.12) * 6;
    p.hF = [26, -244 + b];
    p.hip = [0, -88 + Math.abs(b) * 0.3];
    return p;
  },
  intro: keyframes([[0, P.taunt], [40, P.taunt], [60, P.stance]]),
};

// -------------------------------------------------------- normal attacks
// Frame data lives with the move; these only describe the body.
export const NORMAL_ANIMS = {
  jab: keyframes([
    [0, P.stance],
    [2, { hip: [0, -86], lean: 4, hF: [26, -146], hB: [26, -132], fF: [28, 0], fB: [-26, 0], face: "angry" }],
    [4, { hip: [10, -86], lean: 16, hF: [108, -150], hB: [18, -136], fF: [36, 0], fB: [-24, 0], face: "angry", strike: "hF" }, ease.outQuad],
    [8, { hip: [10, -86], lean: 15, hF: [104, -150], hB: [18, -136], fF: [36, 0], fB: [-24, 0], face: "angry" }],
    [15, P.stance, ease.inOut],
  ]),
  kick: keyframes([
    [0, P.stance],
    [5, { hip: [-6, -92], lean: -8, hF: [26, -150], hB: [0, -140], fF: [26, -56], fB: [-20, 0], face: "angry" }, ease.outQuad],
    [9, { hip: [-12, -96], lean: -20, hF: [14, -154], hB: [-14, -142], fF: [106, -118], fB: [-22, 0], face: "angry", strike: "fF" }, ease.outQuad],
    [14, { hip: [-12, -96], lean: -18, hF: [14, -154], hB: [-14, -142], fF: [102, -114], fB: [-22, 0], face: "angry" }],
    [20, { hip: [-6, -92], lean: -6, fF: [30, -40], fB: [-22, 0] }],
    [27, P.stance, ease.inOut],
  ]),
  overhead: keyframes([
    [0, P.stance],
    [9, { hip: [-6, -94], lean: -14, head: -6, hF: [-10, -236], hB: [-30, -200], fF: [20, -6], fB: [-30, 0], face: "angry" }, ease.outQuad],
    [16, { hip: [18, -78], lean: 34, head: 10, hF: [104, -110], hB: [40, -110], fF: [50, 0], fB: [-26, 0], face: "angry", strike: "hF" }, ease.inQuad],
    [22, { hip: [18, -78], lean: 32, head: 8, hF: [100, -100], hB: [40, -108], fF: [50, 0], fB: [-26, 0], face: "angry" }],
    [36, P.stance, ease.inOut],
  ]),
  lowKick: keyframes([
    [0, P.crouch],
    [3, { ...P.crouch, fF: [50, -14], face: "angry" }],
    [5, { hip: [-8, -52], lean: 10, hF: [40, -112], hB: [20, -100], fF: [100, -10], fB: [-30, 0], face: "angry", strike: "fF" }, ease.outQuad],
    [9, { hip: [-8, -52], lean: 10, hF: [40, -112], hB: [20, -100], fF: [96, -10], fB: [-30, 0], face: "angry" }],
    [16, P.crouch, ease.inOut],
  ]),
  uppercut: keyframes([
    [0, P.crouch],
    [4, { hip: [0, -46], lean: 24, hF: [24, -64], hB: [30, -96], fF: [34, 0], fB: [-30, 0], face: "angry" }],
    [8, { hip: [12, -100], lean: -8, head: -12, hF: [46, -244], hB: [8, -140], fF: [26, 0], fB: [-20, -10], face: "angry", strike: "hF" }, ease.outQuad],
    [14, { hip: [12, -100], lean: -6, head: -10, hF: [44, -240], hB: [8, -140], fF: [26, 0], fB: [-20, -10], face: "angry" }],
    [32, P.stance, ease.inOut],
  ]),
  airJab: keyframes([
    [0, P.jumpUp],
    [4, { hip: [0, -96], lean: 14, hF: [40, -150], hB: [-12, -160], fF: [44, -64], fB: [-14, -30], face: "angry", strike: "fF" }, ease.outQuad],
    [14, { hip: [0, -96], lean: 12, hF: [40, -150], hB: [-12, -160], fF: [40, -60], fB: [-14, -30], face: "angry" }],
    [24, P.jumpDown],
  ]),
  airKick: keyframes([
    [0, P.jumpUp],
    [6, { hip: [-4, -100], lean: -22, hF: [30, -170], hB: [-24, -160], fF: [20, -60], fB: [-18, -50], face: "angry" }],
    [9, { hip: [-6, -100], lean: -30, hF: [20, -172], hB: [-30, -150], fF: [96, -26], fB: [-24, -56], face: "angry", strike: "fF" }, ease.outQuad],
    [20, { hip: [-6, -100], lean: -28, hF: [20, -172], hB: [-30, -150], fF: [92, -30], fB: [-24, -56], face: "angry" }],
    [30, P.jumpDown],
  ]),
  throwTry: keyframes([
    [0, P.stance],
    [3, P.throwReach, ease.outQuad],
    [8, P.throwReach],
    [28, P.stance],
  ]),
  // Thrower: hoist the victim then hurl them forward.
  throwing: keyframes([
    [0, P.throwReach],
    [14, { hip: [-6, -92], lean: -22, head: -10, hF: [30, -230], hB: [10, -226], fF: [26, 0], fB: [-30, 0], face: "angry" }, ease.outQuad],
    [22, { hip: [16, -80], lean: 36, hF: [110, -130], hB: [90, -120], fF: [46, 0], fB: [-28, 0], face: "angry" }, ease.inQuad],
    [40, P.stance],
  ]),
  tech: keyframes([[0, P.dashB], [14, P.stance]]),
};

// Where the victim's body is held during a throw (relative to thrower, facing right).
export function throwHold(t) {
  if (t < 14) {
    const u = t / 14;
    return { x: 76 - u * 30, y: 10 + u * 130, rot: -u * 120 };
  }
  if (t < 22) {
    const u = (t - 14) / 8;
    return { x: 46 + u * 70, y: 140 - u * 100, rot: -120 - u * 90 };
  }
  return null;
}
