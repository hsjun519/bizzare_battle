// CPU opponent. It perceives the opponent with a human-like delay, then
// runs short "plans" (hit-confirmed combos, jump-ins, zoning) that feed the
// same virtual buttons a player would press.
import { DIFFICULTY, SUPER_COST } from "./constants.js";

const JUST_CHANCE = { easy: 0, normal: 0.04, hard: 0.12, insane: 0.28 };

function moveInput(id) {
  switch (id) {
    case "L":
      return { press: ["L"], hold: [] };
    case "2L":
      return { press: ["L"], hold: ["down"] };
    case "H":
      return { press: ["H"], hold: [] };
    case "6H":
      return { press: ["H"], hold: ["fwd"] };
    case "2H":
      return { press: ["H"], hold: ["down"] };
    case "S":
      return { press: ["S"], hold: [] };
    case "6S":
      return { press: ["S"], hold: ["fwd"] };
    case "2S":
      return { press: ["S"], hold: ["down"] };
    case "X":
      return { press: ["X"], hold: [] };
    case "throw":
      return { press: ["L", "H"], hold: [] };
    case "stolen":
      return { press: ["S"], hold: ["up"] };
    case "jL":
      return { press: ["L"], hold: [] };
    case "jH":
      return { press: ["H"], hold: [] };
    default:
      return { press: [], hold: [] };
  }
}

export class AIController {
  constructor(level = "normal", rng = Math.random) {
    this.level = level;
    this.cfg = DIFFICULTY[level] || DIFFICULTY.normal;
    this.rng = rng;
    this.plan = [];
    this.stepT = 0;
    this.hist = [];
    this.wait = 0;
    this.blockT = 0;
    this.blockLow = false;
    this.walk = 0;
    this.walkT = 0;
    this.projCd = 0;
    this.lastHeld = {};
    this.justTry = null;
  }

  reset() {
    this.plan = [];
    this.hist = [];
    this.wait = 0;
    this.blockT = 0;
  }

  snapshot(o) {
    const m = o.state === "attack" ? o.move : null;
    return {
      state: o.state,
      kind: m ? m.kind : null,
      id: o.moveId,
      mt: o.mt,
      startup: m ? m.startup : 0,
      frames: m ? m.frames : 0,
      level: m && m.hits[0] ? m.hits[0].level : "mid",
      x: o.x,
      y: o.y,
      vy: o.vy,
      vx: o.vx,
    };
  }

  // Convert relative holds and presses into a control frame.
  emit(me, hold = [], press = []) {
    const held = {};
    const pressed = {};
    for (const h of hold) {
      if (h === "fwd") held[me.facing > 0 ? "right" : "left"] = true;
      else if (h === "back") held[me.facing > 0 ? "left" : "right"] = true;
      else held[h] = true;
    }
    for (const p of press) {
      held[p] = true;
      pressed[p] = true;
    }
    for (const k of ["left", "right", "up", "down"]) if (held[k] && !this.lastHeld[k]) pressed[k] = true;
    this.lastHeld = held;
    return { held, pressed };
  }

  queue(steps) {
    this.plan = steps.map((s) => ({ timeout: 26, ...s }));
    this.stepT = 0;
  }

  doMove(id, extra = {}) {
    const mi = moveInput(id);
    return { press: mi.press, hold: mi.hold, ...extra };
  }

  think(b, me, opp) {
    if (b.phase !== "fight") {
      this.reset();
      return this.emit(me);
    }
    this.hist.push(this.snapshot(opp));
    if (this.hist.length > 40) this.hist.shift();
    const delay = Math.min(this.hist.length - 1, this.cfg.reaction);
    const seen = this.hist[this.hist.length - 1 - delay];
    if (this.projCd > 0) this.projCd--;
    const dist = Math.abs(opp.x - me.x);

    // ---------------------------------------------------- running plan
    if (this.plan.length) {
      const step = this.plan[0];
      if (step.isHold) {
        step.hold2--;
        if (step.hold2 <= 0) this.plan.shift();
        return this.emit(me, step.hold || []);
      }
      this.stepT++;
      if (this.ready(step.when, me, opp, dist)) {
        this.plan.shift();
        this.stepT = 0;
        const holdFrames = step.holdFrames || 0;
        if (holdFrames > 1) this.plan.unshift({ hold: step.hold, hold2: holdFrames - 1, isHold: true });
        return this.emit(me, step.hold || [], step.press || []);
      }
      if (this.stepT > step.timeout) {
        this.plan = [];
        this.stepT = 0;
      }
      return this.emit(me, step.waitHold || []);
    }

    // ---------------------------------------------------- defense
    if (this.blockT > 0) {
      this.blockT--;
      // late re-tap for a just guard
      if (this.justTry !== null) {
        const remain = this.justTry - b.frame;
        if (remain <= 4 && remain >= 0) {
          this.justTry = null;
          this.lastHeld = {};
          return this.emit(me, this.blockLow ? ["back", "down"] : ["back"]);
        }
        if (remain <= 7 && remain > 4) return this.emit(me, this.blockLow ? ["down"] : []);
      }
      return this.emit(me, this.blockLow ? ["back", "down"] : ["back"]);
    }
    if (!me.actionable && me.state !== "air" && me.state !== "blockstun") return this.emit(me);

    if (me.state === "blockstun") {
      // hold guard while pressured
      const low = seen.level === "low";
      return this.emit(me, low ? ["back", "down"] : ["back"]);
    }
    if (me.state === "air") return this.airThink(b, me, opp, dist);

    const r = this.rng;
    const c = this.cfg;
    const hint = me.char.ai || {};

    // incoming strike
    if (seen.state === "attack" && seen.kind !== "throw" && seen.mt < seen.startup + 2 && dist < 360) {
      if (r() < c.block) {
        this.blockT = 16;
        this.blockLow = seen.level === "low" || (seen.id && seen.id.startsWith("2") && seen.id !== "2S");
        if (seen.level === "high") this.blockLow = false;
        if (opp.state === "attack" && opp.move.kind === "special" && r() < JUST_CHANCE[this.level]) {
          this.justTry = b.frame + Math.max(0, opp.move.startup - opp.mt);
        } else this.justTry = null;
        return this.emit(me, this.blockLow ? ["back", "down"] : ["back"]);
      }
    }
    // incoming projectile
    for (const p of b.projectiles) {
      if (p.owner !== opp || p.hitsLeft <= 0) continue;
      const toward = Math.sign(me.x - p.x) === Math.sign(p.vx);
      const pd = Math.abs(p.x - me.x);
      if (toward && pd < 300 && pd > 60) {
        if (me.char.hooks?.projImmune && r() < 0.6) {
          this.blockT = 14;
          this.blockLow = true;
          return this.emit(me, ["down"]);
        }
        if (r() < c.block * 0.8) {
          this.blockT = 18;
          this.blockLow = p.hit?.level === "low";
          this.justTry = r() < JUST_CHANCE[this.level] ? b.frame + Math.floor(pd / Math.max(1, Math.abs(p.vx))) : null;
          return this.emit(me, this.blockLow ? ["back", "down"] : ["back"]);
        }
        if (r() < c.aggression * 0.25 && pd > 160) {
          this.queue([{ when: "now", hold: ["up", "fwd"], holdFrames: 4 }, { when: "airDesc", press: ["H"], timeout: 60 }]);
          return this.emit(me, ["up", "fwd"]);
        }
      }
    }
    // anti-air
    if (seen.state === "air" && opp.state === "air" && dist < 300 && opp.vy < 4 && opp.y > 40) {
      if (r() < c.antiAir) {
        const aa = hint.antiAir || "2H";
        if (dist < (aa === "2H" ? 120 : 170)) {
          this.queue([this.doMove(aa, { when: "now" })]);
          return this.emit(me);
        }
      }
    }
    // punish whiffed recovery
    if (opp.state === "attack" && opp.mt > opp.move.startup + 6 && opp.move.frames - opp.mt > 10 && dist < 170 && r() < c.punish * 0.25) {
      this.comboPlan(me, hint, true);
      return this.emit(me);
    }
    // knocked-down opponent: walk up
    if (opp.state === "knockdown" || opp.state === "getup") {
      if (dist > 140) return this.emit(me, ["fwd"]);
      if (r() < 0.04) {
        this.blockT = 10;
        return this.emit(me, ["back"]);
      }
      return this.emit(me);
    }

    if (this.wait > 0) {
      this.wait--;
      return this.emit(me, this.walk > 0 ? ["fwd"] : this.walk < 0 ? ["back"] : []);
    }
    if (r() < c.mistakes * 0.05) {
      this.wait = 20;
      this.walk = 0;
      return this.emit(me);
    }

    // super usage
    if (me.meter >= SUPER_COST && r() < 0.02 + (opp.state === "hitstun" ? 0.4 : 0)) {
      const sm = me.moves.X;
      const ranged = sm && !sm.hits.some((h) => h.grab) && (sm.hits.length === 0 || sm.hits[0].box?.[2] > 400);
      if (ranged || dist < 160) {
        this.queue([this.doMove("X", { when: "now" })]);
        return this.emit(me);
      }
    }
    // stolen move!
    if (me.stolen && r() < 0.03) {
      this.queue([this.doMove("stolen", { when: "now" })]);
      return this.emit(me);
    }

    const prefer = hint.range || 300;
    // ---------------------------------------------------- neutral by range
    if (dist > 480) {
      if (hint.projectile && this.projCd <= 0 && r() < 0.035 * (hint.zoner ? 2 : 1)) {
        this.projCd = 70;
        this.queue([this.doMove(hint.projectile, { when: "now" })]);
        return this.emit(me);
      }
      if (r() < c.aggression * 0.03) {
        this.lastHeld = {};
        this.queue([{ when: "now", hold: ["fwd"], holdFrames: 1 }, { when: "now", hold: [], timeout: 2 }, { when: "now", hold: ["fwd"], holdFrames: 2 }]);
        return this.emit(me);
      }
      this.wait = 10 + Math.floor(r() * 20);
      this.walk = hint.zoner && r() < 0.35 ? 0 : 1;
      return this.emit(me, this.walk ? ["fwd"] : []);
    }
    if (dist > 190) {
      if (hint.projectile && this.projCd <= 0 && r() < (hint.zoner ? 0.05 : 0.02)) {
        this.projCd = 80;
        this.queue([this.doMove(hint.projectile, { when: "now" })]);
        return this.emit(me);
      }
      if (hint.grab && dist > 200 && dist < 320 && r() < 0.02) {
        this.queue([this.doMove(hint.grab, { when: "now" })]);
        return this.emit(me);
      }
      if (hint.teleport && r() < 0.008) {
        this.queue([this.doMove(hint.teleport, { when: "now" })]);
        return this.emit(me);
      }
      if (hint.rush && r() < (hint.zoner ? 0.012 : 0.03) * c.aggression * 2 && dist < 340) {
        this.queue([this.doMove(hint.rush, { when: "now" })]);
        return this.emit(me);
      }
      if (r() < c.aggression * 0.02) {
        this.queue([{ when: "now", hold: ["up", "fwd"], holdFrames: 4 }, { when: "airDesc", press: [r() < 0.5 ? "H" : "L"], timeout: 60 }, { when: "hit", press: ["L"], timeout: 30 }, { when: "hit", press: ["H"] }]);
        return this.emit(me, ["up", "fwd"]);
      }
      this.wait = 8 + Math.floor(r() * 16);
      this.walk = dist > prefer ? 1 : r() < 0.4 ? -1 : r() < 0.5 ? 1 : 0;
      return this.emit(me, this.walk > 0 ? ["fwd"] : this.walk < 0 ? ["back"] : []);
    }
    // close range pressure / mixups
    const roll = r();
    if (roll < 0.06 * c.aggression) {
      this.comboPlan(me, hint, false);
      return this.emit(me);
    }
    if (roll < 0.085 * c.aggression && dist < 110) {
      this.queue([this.doMove("throw", { when: "now" })]);
      return this.emit(me);
    }
    if (roll < 0.1 * c.aggression) {
      this.queue([this.doMove("6H", { when: "now" }), { when: "hit", ...this.doMove(hint.rush || "S") }]);
      return this.emit(me);
    }
    if (roll < 0.12 * c.aggression) {
      this.queue([this.doMove("2L", { when: "now" }), { when: "conn", ...this.doMove("2L") }, { when: "hit", ...this.doMove("2H") }, { when: "hit", hold: ["up"], press: [], holdFrames: 6 }, { when: "airNear", press: ["L"], timeout: 40 }, { when: "hit", press: ["H"] }]);
      return this.emit(me);
    }
    if (roll < 0.14) {
      this.blockT = 12;
      this.blockLow = r() < 0.5;
      return this.emit(me, ["back"]);
    }
    if (roll < 0.15 && me.state === "idle") {
      this.lastHeld = {};
      this.queue([{ when: "now", hold: ["back"], holdFrames: 1 }, { when: "now", hold: [], timeout: 2 }, { when: "now", hold: ["back"], holdFrames: 2 }]);
      return this.emit(me);
    }
    this.wait = 4 + Math.floor(r() * 8);
    this.walk = dist > 120 ? 1 : 0;
    return this.emit(me, this.walk ? ["fwd"] : []);
  }

  comboPlan(me, hint, punish) {
    const r = this.rng();
    const ender = hint.rush || hint.projectile || "S";
    const canSuper = me.meter >= SUPER_COST && this.rng() < 0.6;
    const steps = [this.doMove("L", { when: "now" }), { when: "hit", ...this.doMove("L") }, { when: "hit", ...this.doMove("H") }];
    if (this.rng() < this.cfg.combo) steps.push({ when: "hit", ...this.doMove(ender) });
    if (canSuper) steps.push({ when: "hit", ...this.doMove("X") });
    if (punish && r < 0.4) {
      this.queue([this.doMove("H", { when: "now" }), { when: "hit", ...this.doMove(ender) }]);
      return;
    }
    if (r < 0.3) {
      this.queue([this.doMove("2L", { when: "now" }), { when: "hit", ...this.doMove("L") }, { when: "hit", ...this.doMove("H") }, { when: "hit", ...this.doMove(ender) }]);
      return;
    }
    this.queue(steps);
  }

  airThink(b, me, opp, dist) {
    if (!me.airUsed && me.vy < 4 && dist < 170 && Math.abs(opp.y - me.y) < 160) {
      return this.emit(me, [], [this.rng() < 0.5 ? "H" : "L"]);
    }
    return this.emit(me);
  }

  ready(when, me, opp, dist) {
    switch (when) {
      case "now":
      case undefined:
        return me.actionable || me.state === "dash";
      case "free":
        return me.actionable;
      case "hit":
        return me.state === "attack" && me.hitConnected;
      case "conn":
        return me.state === "attack" && me.connected;
      case "airDesc":
        return me.state === "air" && me.vy < 3 && dist < 190;
      case "airNear":
        return me.state === "air" && me.y > 60 && Math.abs(opp.y - me.y) < 120 && dist < 160;
      default:
        return true;
    }
  }
}

// Training dummy behaviours.
export function dummyControls(kind, me, b) {
  const held = {};
  const pressed = {};
  const back = me.facing > 0 ? "left" : "right";
  if (kind === "crouch") held.down = true;
  if (kind === "block") {
    held[back] = true;
    const o = me.opp;
    if (o.state === "attack" && o.move.hits[0]?.level === "low") held.down = true;
  }
  if (kind === "crouchblock") {
    held[back] = true;
    held.down = true;
  }
  if (kind === "jump") {
    held.up = true;
    if (me.state !== "air") pressed.up = true;
  }
  return { held, pressed };
}
