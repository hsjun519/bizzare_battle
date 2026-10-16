// Move helpers and the shared set of normal attacks every fighter gets.
import { NORMAL_ANIMS } from "../render/poses.js";

// Default hit properties. Boxes are [x forward, y up from feet, w, h].
export function hit(o) {
  return {
    dmg: 50,
    chip: 0,
    stun: 18,
    bstun: 14,
    push: 6,
    level: "mid",
    spark: "l",
    stop: 8,
    sfx: null,
    ...o,
  };
}

export const NORMAL_DATA = {
  L: {
    name: "약공격",
    kind: "normal",
    frames: 15,
    startup: 4,
    anim: NORMAL_ANIMS.jab,
    hits: [hit({ at: [4, 7], box: [18, 126, 96, 44], dmg: 32, stun: 14, bstun: 10, push: 4.5, stop: 7 })],
    cancel: { chain: ["L", "H", "6H", "2L", "2H"], special: true, super: true },
    whiff: "whiff_l",
  },
  H: {
    name: "강공격",
    kind: "normal",
    frames: 27,
    startup: 9,
    anim: NORMAL_ANIMS.kick,
    hits: [hit({ at: [9, 13], box: [26, 86, 94, 52], dmg: 70, stun: 20, bstun: 15, push: 7.5, spark: "h", stop: 11, sfx: "hit_h" })],
    cancel: { special: true, super: true },
    whiff: "whiff_h",
  },
  "6H": {
    name: "중단 내려찍기",
    kind: "normal",
    frames: 36,
    startup: 16,
    anim: NORMAL_ANIMS.overhead,
    move: (t) => (t >= 4 && t < 16 ? { vx: 2.4 } : t < 20 ? { vx: 0.6 } : { vx: 0 }),
    hits: [hit({ at: [16, 20], box: [30, 64, 96, 130], dmg: 72, level: "high", stun: 19, bstun: 13, push: 6, spark: "h", stop: 11, sfx: "hit_h" })],
    cancel: { special: true, super: true, onHitOnly: true },
    whiff: "whiff_h",
  },
  "2L": {
    name: "하단 발차기",
    kind: "normal",
    frames: 16,
    startup: 5,
    crouch: true,
    anim: NORMAL_ANIMS.lowKick,
    hits: [hit({ at: [5, 8], box: [26, 0, 92, 36], dmg: 28, level: "low", stun: 14, bstun: 10, push: 4.5, stop: 7 })],
    cancel: { chain: ["2L", "L", "2H", "H"], special: true, super: true },
    whiff: "whiff_l",
  },
  "2H": {
    name: "띄우기 어퍼",
    kind: "normal",
    frames: 32,
    startup: 8,
    crouch: true,
    anim: NORMAL_ANIMS.uppercut,
    airInvuln: [1, 11],
    hits: [hit({ at: [8, 13], box: [6, 104, 72, 150], dmg: 60, launch: [2.4, 17.5], stun: 0, bstun: 15, push: 5, spark: "h", stop: 11, sfx: "hit_h", jug: 1 })],
    cancel: { jump: true, special: true, super: true },
    whiff: "whiff_h",
  },
  jL: {
    name: "공중 무릎",
    kind: "normal",
    air: true,
    frames: 26,
    startup: 4,
    anim: NORMAL_ANIMS.airJab,
    hits: [hit({ at: [4, 14], box: [8, 20, 66, 66], dmg: 34, level: "high", stun: 15, bstun: 10, push: 4, stop: 7, airLaunch: [2.5, 6] })],
    cancel: { chain: ["jH"], special: true, super: true },
    whiff: "whiff_l",
  },
  jH: {
    name: "공중 발차기",
    kind: "normal",
    air: true,
    frames: 32,
    startup: 9,
    anim: NORMAL_ANIMS.airKick,
    hits: [hit({ at: [9, 20], box: [18, -6, 94, 64], dmg: 62, level: "high", stun: 19, bstun: 13, push: 6, spark: "h", stop: 10, sfx: "hit_h", airLaunch: [5, 4], kd: false })],
    cancel: { special: true, super: true },
    whiff: "whiff_h",
  },
  throw: {
    name: "잡기",
    kind: "throw",
    frames: 30,
    startup: 3,
    anim: NORMAL_ANIMS.throwTry,
    hits: [hit({ at: [3, 6], box: [10, 30, 84, 160], grab: "throw", dmg: 0 })],
    whiff: "whiff_l",
  },
};

// Per-character tweaks: { L: { dmg: 36, box: [...] } } patch the first hit,
// anything under `move` patches the move itself.
export function buildNormals(char) {
  const out = {};
  for (const [id, base] of Object.entries(NORMAL_DATA)) {
    const patch = (char.normals && char.normals[id]) || {};
    const { move: movePatch, ...hitPatch } = patch;
    const m = { ...base, ...(movePatch || {}), id };
    m.hits = base.hits.map((h, i) => (i === 0 ? { ...h, ...hitPatch } : { ...h }));
    out[id] = m;
  }
  return out;
}

export function finalizeMoves(char) {
  const moves = { ...buildNormals(char), ...(char.moves || {}) };
  for (const [id, m] of Object.entries(moves)) {
    m.id = id;
    m.owner = char;
    m.hits = m.hits || [];
    m.cancel = m.cancel || {};
    if (m.startup === undefined) m.startup = m.hits.length ? m.hits[0].at[0] : m.frames;
  }
  return moves;
}

// Input notation used in the move list.
export const INPUT_LABEL = {
  L: "약",
  H: "강",
  "6H": "→ + 강",
  "2L": "↓ + 약",
  "2H": "↓ + 강",
  jL: "점프 중 약",
  jH: "점프 중 강",
  throw: "약 + 강 (또는 잡기)",
  S: "기술",
  "6S": "→ + 기술",
  "2S": "↓ + 기술",
  "4S": "← + 기술",
  jS: "점프 중 기술",
  X: "필살기 (게이지 MAX)",
};
