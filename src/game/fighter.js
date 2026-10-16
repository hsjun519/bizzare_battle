// A single combatant: input interpretation, state machine and physics.
// Hits between fighters are resolved by Battle; this class only moves itself.
import { GRAVITY, BUFFER, DASH_WINDOW, BODY_H, CROUCH_H, SUPER_COST, MAX_METER, DEFAULT_HEALTH } from "./constants.js";
import { finalizeMoves } from "./moves.js";
import { ANIM, P, NORMAL_ANIMS } from "../render/poses.js";
import { lerpPose } from "../render/rig.js";

const ACTIONABLE = new Set(["idle", "walk", "crouch"]);
const BUTTONS = ["L", "H", "S", "X", "G"];
const inRange = (t, r) => r && t >= r[0] && t < r[1];

function buttonOf(id) {
  if (id === "throw") return "G";
  const c = id[id.length - 1];
  return BUTTONS.includes(c) ? c : null;
}

export class Fighter {
  constructor(battle, char, side) {
    this.b = battle;
    this.char = char;
    this.side = side;
    this.moves = finalizeMoves(char);
    this.maxHealth = char.health || DEFAULT_HEALTH;
    this.meter = 0;
    this.wins = 0;
    this.stats = { dmg: 0, hits: 0, maxCombo: 0, blocks: 0, specials: 0, supers: 0, throws: 0, perfect: 0 };
    this.in = { fwd: false, back: false, up: false, down: false, held: {}, pressed: {} };
    this.resetRound(0, 1);
  }

  resetRound(x, facing) {
    this.x = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.health = this.maxHealth;
    this.displayHealth = this.maxHealth;
    this.state = "idle";
    this.t = 0;
    this.move = null;
    this.moveId = null;
    this.mt = 0;
    this.stun = 0;
    this.stunTotal = 1;
    this.hurtKind = "high";
    this.blockLow = false;
    this.buf = { L: 0, H: 0, S: 0, X: 0, G: 0 };
    this.tapF = -99;
    this.tapB = -99;
    this.dashReq = null;
    this.grabReq = false;
    this.combo = 0;
    this.comboDmg = 0;
    this.juggle = 0;
    this.invuln = 0;
    this.flash = 0;
    this.kd = false;
    this.guard = false;
    this.airUsed = false;
    this.jumpDir = 0;
    this.superJump = false;
    this.chainCount = 0;
    this.connected = false;
    this.hitConnected = false;
    this.hitLog = [];
    this.vars = {};
    this.buff = null;
    this.trail = 0;
    this.hidden = false;
    this.alpha = 1;
    this.shake = 0;
    this.lastHitBy = null;
    this.passive = {};
    this.backTap = -99;
    this.stolen = null;
    this.locked = {};
    this.stolenAura = 0;
    this.lockedPing = 0;
    this.char.hooks?.roundStart?.(this, this.b);
  }

  get opp() {
    return this.b.fighters[1 - this.side];
  }
  get grounded() {
    return this.y <= 0 && this.vy <= 0;
  }
  get actionable() {
    return ACTIONABLE.has(this.state);
  }

  // ---------------------------------------------------------------- input
  readInput(ctrl) {
    const held = ctrl.held || {};
    const pressed = ctrl.pressed || {};
    const fwdKey = this.facing > 0 ? "right" : "left";
    const backKey = this.facing > 0 ? "left" : "right";
    this.in = {
      fwd: Boolean(held[fwdKey] && !held[backKey]),
      back: Boolean(held[backKey] && !held[fwdKey]),
      up: Boolean(held.up),
      down: Boolean(held.down),
      held,
      pressed,
    };
    for (const k of BUTTONS) this.buf[k] = pressed[k] ? BUFFER : Math.max(0, this.buf[k] - 1);
    const f = this.b.frame;
    this.dashReq = null;
    if (pressed[fwdKey] && !held.down) {
      if (f - this.tapF <= DASH_WINDOW) {
        this.dashReq = "f";
        this.tapF = -99;
      } else this.tapF = f;
    }
    if (pressed[backKey]) this.backTap = f;
    if (pressed[backKey] && !held.down) {
      if (f - this.tapB <= DASH_WINDOW) {
        this.dashReq = "b";
        this.tapB = -99;
      } else this.tapB = f;
    }
    this.grabReq =
      pressed.G || (this.buf.L >= BUFFER - 3 && this.buf.H >= BUFFER - 3 && Boolean(pressed.L || pressed.H));
  }

  holdingAwayFrom(x) {
    const h = this.in.held;
    if (x > this.x) return Boolean(h.left && !h.right);
    if (x < this.x) return Boolean(h.right && !h.left);
    return Boolean(this.in.back);
  }

  // ------------------------------------------------------------- stats
  walkSpeed() {
    return (this.char.walk || 4.1) * this.speedMult();
  }
  backSpeed() {
    return (this.char.back || 3.3) * this.speedMult();
  }
  speedMult() {
    let m = this.char.hooks?.speedMult?.(this) ?? 1;
    if (this.buff) m *= this.buff.speed || 1;
    return m;
  }
  damageMult() {
    let m = this.char.hooks?.dmgMult?.(this) ?? 1;
    if (this.buff) m *= this.buff.dmg || 1;
    return m;
  }
  gainMeter(n) {
    if (this.buff && this.buff.noMeter) return;
    const before = this.meter;
    const mult = (this.char.hooks?.meterMult?.(this) ?? 1) * (this.b.rule?.meter ?? 1);
    this.meter = Math.min(MAX_METER, this.meter + n * mult);
    if (before < SUPER_COST && this.meter >= SUPER_COST) this.b.emit({ type: "meterFull", side: this.side });
  }

  // ------------------------------------------------------------- moves
  wantMove(air) {
    const i = this.in;
    const b = this.buf;
    const M = this.moves;
    if (b.X && this.meter >= SUPER_COST) {
      if (!air && M.X) return "X";
      if (air && M.jX) return "jX";
    }
    if (!air && this.grabReq) return "throw";
    if (b.S) {
      if (!air && i.up && this.stolen) return "stolen";
      let id;
      if (air) id = M.jS ? "jS" : null;
      else if (i.down && M["2S"]) id = "2S";
      else if (i.fwd && M["6S"]) id = "6S";
      else if (i.back && M["4S"]) id = "4S";
      else id = M.S ? "S" : null;
      if (id && this.locked[id] > 0) {
        if (this.lockedPing <= 0) {
          this.b.emit({ type: "locked", side: this.side, id });
          this.lockedPing = 30;
        }
        this.buf.S = 0;
        return null;
      }
      return id;
    }
    if (b.H) return air ? "jH" : i.down ? "2H" : i.fwd ? "6H" : "H";
    if (b.L) return air ? "jL" : i.down ? "2L" : "L";
    return null;
  }

  consume(id) {
    if (id === "stolen") {
      this.buf.S = 0;
      return;
    }
    const btn = buttonOf(id);
    if (btn) this.buf[btn] = 0;
    if (id === "throw") {
      this.buf.L = 0;
      this.buf.H = 0;
      this.buf.G = 0;
    }
  }

  startMove(idOrMove) {
    let id = idOrMove;
    let m;
    if (typeof idOrMove === "object") {
      m = idOrMove;
      id = m.id;
    } else m = id === "stolen" ? this.stolen?.move : this.moves[id];
    if (!m) return false;
    if (m.kind === "super") {
      if (this.meter < SUPER_COST) return false;
      this.meter -= SUPER_COST;
    }
    if (m.canUse && !m.canUse(this, this.b)) return false;
    this.consume(id);
    if (id === this.moveId && this.state === "attack") this.chainCount++;
    else if (this.state !== "attack") this.chainCount = 0;
    this.move = m;
    this.moveId = id;
    this.mt = 0;
    this.state = "attack";
    this.t = 0;
    this.connected = false;
    this.hitConnected = false;
    this.hitLog = m.hits.map(() => ({ n: 0, last: -999 }));
    this.armorLeft = m.armorHits ?? 1;
    this.vars = {};
    this.guard = false;
    this.hidden = false;
    this.altDraw = null;
    this.hurtH = null;
    this.alpha = 1;
    if (!m.air && !m.keepMomentum) this.vx = 0;
    if (m.air) this.airUsed = true;
    if (m.kind === "special") {
      this.stats.specials++;
      this.gainMeter(3);
    }
    if (m.kind === "super") {
      this.stats.supers++;
      this.b.superFlash(this, m);
    }
    if (m.sfx) this.b.sfx(m.sfx);
    if (id === "stolen") {
      const st = this.stolen;
      this.opp.locked[st.id] = 0;
      this.stolen = null;
      this.stolenAura = Math.max(m.frames, 40);
      this.stolenFrom = st.char;
      this.b.fx.text(this.x, this.y + 270, `인수한 기술 · ${m.name}`, st.char.color, 26, 50);
      this.b.sfx("power");
      this.b.emit({ type: "stolenUse", side: this.side, name: m.name });
    }
    m.onStart?.(this, this.b);
    this.b.emit({ type: "move", side: this.side, id, kind: m.kind });
    return true;
  }

  tryCancel() {
    const m = this.move;
    const c = m.cancel || {};
    if (c.onHitOnly && !this.hitConnected) return false;
    const air = this.y > 0;
    if (c.super && this.buf.X && this.meter >= SUPER_COST && this.moves[air ? "jX" : "X"]) return this.startMove(air ? "jX" : "X");
    if (c.special && this.buf.S) {
      const id = this.wantMove(air);
      if (id === "stolen") return this.startMove(id);
      if (id && id !== this.moveId && this.moves[id] && this.moves[id].kind !== "normal") return this.startMove(id);
    }
    if (c.jump && this.hitConnected && this.in.up && !air) {
      this.move = null;
      this.state = "air";
      this.t = 0;
      this.vy = (this.char.jump || 19.5) * 1.1;
      this.vx = this.facing * 2.6;
      this.y = 0.1;
      this.airUsed = false;
      this.jumpDir = 1;
      this.superJump = true;
      this.b.sfx("jump");
      this.b.fx.dust(this.x, 0, 6);
      return true;
    }
    if (c.chain && (this.buf.L || this.buf.H)) {
      const id = this.wantMove(air);
      if (id && c.chain.includes(id) && (id !== this.moveId || this.chainCount < 2)) return this.startMove(id);
    }
    return false;
  }

  endMove() {
    this.move = null;
    this.hidden = false;
    this.altDraw = null;
    this.hurtH = null;
    this.alpha = 1;
    if (this.y > 0) {
      this.state = "air";
      this.airUsed = true;
      this.t = 0;
    } else {
      this.state = this.in.down ? "crouch" : "idle";
      this.t = 0;
      this.vx = 0;
    }
  }

  // ------------------------------------------------------------- update
  setState(s) {
    if (this.state !== s) {
      this.state = s;
      this.t = 0;
    }
  }

  faceOpponent() {
    const o = this.opp;
    if (Math.abs(o.x - this.x) > 4) this.facing = o.x > this.x ? 1 : -1;
  }

  update(ctrl) {
    this.readInput(ctrl);
    this.t++;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    if (this.trail > 0) this.trail--;
    if (this.stolenAura > 0) this.stolenAura--;
    if (this.lockedPing > 0) this.lockedPing--;
    for (const k in this.locked) if (this.locked[k] > 0) this.locked[k]--;
    if (this.stolen && --this.stolen.timer <= 0) {
      this.opp.locked[this.stolen.id] = 0;
      this.b.emit({ type: "stolenExpire", side: this.side, name: this.stolen.move.name });
      this.stolen = null;
    }
    if (this.buff) {
      this.buff.frames--;
      if (this.buff.frames <= 0) {
        this.buff = null;
        this.b.emit({ type: "buffEnd", side: this.side });
      }
    }
    if (ACTIONABLE.has(this.state) || this.state === "air" || this.state === "attack" || this.state === "dash") {
      if (this.combo > 0) {
        this.combo = 0;
        this.comboDmg = 0;
      }
      this.juggle = 0;
    }
    this.char.hooks?.update?.(this, this.b);
    const handler = this[`st_${this.state}`];
    if (handler) handler.call(this);
    this.physics();
  }

  st_intro() {
    this.vx = 0;
  }
  st_idle() {
    this.neutral();
  }
  st_walk() {
    this.neutral();
  }
  st_crouch() {
    this.neutral();
  }

  neutral() {
    const i = this.in;
    this.faceOpponent();
    if (!this.b.canAct) {
      this.vx = 0;
      this.guard = false;
      this.setState(i.down ? "crouch" : "idle");
      return;
    }
    const id = this.wantMove(false);
    if (id && this.startMove(id)) return;
    if (this.dashReq) {
      this.state = "dash";
      this.t = 0;
      this.dashDir = this.dashReq === "f" ? 1 : -1;
      this.b.sfx("dash");
      this.b.fx.dust(this.x - this.facing * this.dashDir * 20, 0, 5);
      return;
    }
    if (i.up) {
      this.state = "jumpsquat";
      this.t = 0;
      this.jumpDir = i.fwd ? 1 : i.back ? -1 : 0;
      this.vx = 0;
      return;
    }
    this.guard = i.back && this.b.isThreatened(this);
    if (i.down) {
      this.setState("crouch");
      this.vx = 0;
      return;
    }
    if (this.guard) {
      this.setState("idle");
      this.vx = 0;
      return;
    }
    if (i.fwd) {
      this.setState("walk");
      this.walkDir = 1;
      this.vx = this.facing * this.walkSpeed();
    } else if (i.back) {
      this.setState("walk");
      this.walkDir = -1;
      this.vx = -this.facing * this.backSpeed();
    } else {
      this.setState("idle");
      this.vx = 0;
    }
  }

  st_dash() {
    const fwd = this.dashDir > 0;
    const dur = fwd ? 16 : 20;
    const sp = (fwd ? this.char.dash || 11.5 : 9.5) * this.speedMult();
    const u = Math.min(1, this.t / dur);
    this.vx = this.facing * this.dashDir * sp * (1 - u * u);
    if (!fwd && this.t <= 7) this.invuln = Math.max(this.invuln, 1);
    if (fwd && this.t % 4 === 0) this.b.fx.dust(this.x - this.facing * 24, 0, 1);
    if (fwd && this.t > 5) {
      const id = this.wantMove(false);
      if (id && this.startMove(id)) {
        this.vx = this.facing * sp * 0.4;
        return;
      }
    }
    if (this.t >= dur) {
      this.vx = 0;
      this.setState("idle");
    }
  }

  st_jumpsquat() {
    if (this.t <= 3 && this.stolen && this.buf.S && this.b.canAct) {
      if (this.startMove("stolen")) return;
    }
    if (this.t >= 4) {
      this.state = "air";
      this.t = 0;
      this.vy = this.char.jump || 19.5;
      this.vx = this.jumpDir * (this.char.jumpX || 5.4) * this.facing * this.speedMult();
      this.y = 0.1;
      this.airUsed = false;
      this.superJump = false;
      this.b.sfx("jump");
      this.b.fx.dust(this.x, 0, 4);
    }
  }

  st_air() {
    if (!this.airUsed && this.b.canAct) {
      const id = this.wantMove(true);
      if (id && this.startMove(id)) return;
    }
  }

  st_land() {
    this.vx *= 0.6;
    if (this.t >= (this.landLag || 3)) {
      this.faceOpponent();
      this.setState(this.in.down ? "crouch" : "idle");
    }
  }

  st_attack() {
    const m = this.move;
    this.mt++;
    const mv = m.move?.(this.mt, this, this.b);
    if (mv) {
      if (mv.vx !== undefined) this.vx = mv.vx * this.facing * (mv.raw ? 1 : this.speedMult());
      if (mv.vy !== undefined) this.vy = mv.vy;
    } else if (!m.air && this.y <= 0) this.vx *= 0.7;
    m.update?.(this.mt, this, this.b);
    if (this.state !== "attack" || this.move !== m) return;
    if (this.mt === m.startup && m.whiff) this.b.sfx(m.whiff);
    if (this.connected && this.tryCancel()) return;
    if (this.mt <= 3 && this.grabReq && this.y <= 0 && (this.moveId === "L" || this.moveId === "H")) {
      this.startMove("throw");
      return;
    }
    if (this.mt >= m.frames) {
      if (m.air && this.y > 0) {
        // keep falling in the recovery pose
        this.vars.done = true;
        return;
      }
      this.endMove();
    }
  }

  st_hitstun() {
    this.stun--;
    this.vx *= 0.86;
    if (this.stun <= 0) {
      this.setState(this.in.down ? "crouch" : "idle");
      this.vx = 0;
    }
  }

  st_blockstun() {
    this.stun--;
    this.vx *= 0.86;
    if (this.stun <= 0) {
      this.setState(this.in.down ? "crouch" : "idle");
      this.vx = 0;
    }
  }

  st_airhit() {}

  st_knockdown() {
    this.vx *= 0.8;
    if (this.health <= 0) return;
    if (this.t >= 36 && this.b.phase !== "ko") {
      this.setState("getup");
      this.invuln = 20;
    }
  }

  st_getup() {
    this.vx = 0;
    if (this.t >= 18) {
      this.faceOpponent();
      this.setState("idle");
      this.invuln = 3;
    }
  }

  st_tech() {
    this.vx *= 0.85;
    if (this.t >= 16) this.setState("idle");
  }

  st_ko() {
    this.vx *= 0.9;
  }
  st_win() {
    this.vx = 0;
  }
  st_throwing() {}
  st_thrown() {}

  physics() {
    if (this.state === "thrown" || this.state === "throwing" || this.b.grab?.att === this) return;
    const airborne = this.y > 0 || this.vy > 0;
    if (airborne) {
      const g = this.state === "attack" && this.move.gravity !== undefined ? this.move.gravity : 1;
      this.vy -= GRAVITY * g * (this.b.rule?.gravity ?? 1);
      this.x += this.vx;
      this.y += this.vy;
      if (this.y <= 0) {
        this.y = 0;
        this.onLand();
      }
    } else {
      this.y = 0;
      this.x += this.vx;
      if (this.state === "knockdown" || this.state === "ko") this.vx *= 0.85;
    }
  }

  onLand() {
    const vyImpact = this.vy;
    this.vy = 0;
    switch (this.state) {
      case "air":
        this.state = "land";
        this.t = 0;
        this.landLag = 3;
        this.vx = 0;
        this.superJump = false;
        this.b.sfx("land");
        this.b.fx.dust(this.x, 0, 4);
        break;
      case "attack": {
        const m = this.move;
        m.onLand?.(this, this.b);
        if (this.state !== "attack" || this.move !== m) break;
        this.move = null;
        this.state = "land";
        this.t = 0;
        this.landLag = m.landLag ?? 4;
        this.vx = 0;
        this.b.sfx("land");
        this.b.fx.dust(this.x, 0, 4);
        break;
      }
      case "airhit":
        if (this.health <= 0) {
          this.state = "ko";
          this.t = 0;
          this.b.fx.dust(this.x, 0, 12);
          this.b.sfx("knockdown");
          this.b.shake(6);
        } else if (this.kd || vyImpact < -16) {
          this.state = "knockdown";
          this.t = 0;
          this.b.fx.dust(this.x, 0, 10);
          this.b.sfx("knockdown");
          this.b.shake(4);
        } else {
          this.state = "land";
          this.t = 0;
          this.landLag = 8;
          this.b.fx.dust(this.x, 0, 4);
        }
        break;
      case "ko":
        this.b.fx.dust(this.x, 0, 10);
        if (vyImpact < -6) {
          this.vy = -vyImpact * 0.3;
          this.y = 0.1;
          this.b.sfx("knockdown");
        }
        break;
      default:
        if (this.state === "knockdown" && vyImpact < -6) {
          this.vy = -vyImpact * 0.25;
          this.y = 0.1;
        }
    }
  }

  // ------------------------------------------------------------- queries
  isAirborne() {
    return this.y > 0 || this.state === "air" || this.state === "airhit";
  }

  isCrouching() {
    if (this.state === "crouch") return true;
    if (this.state === "attack") return Boolean(this.move.crouch);
    if (this.state === "blockstun") return this.blockLow;
    if (this.state === "hitstun") return this.hurtKind === "low";
    return false;
  }

  canBlock() {
    if (this.y > 0) return false;
    return this.state === "idle" || this.state === "walk" || this.state === "crouch" || this.state === "blockstun" || (this.state === "land" && this.landLag <= 3);
  }

  isThrowable() {
    if (this.y > 0 || this.invuln > 0) return false;
    return ["idle", "walk", "crouch", "attack", "land", "dash", "jumpsquat"].includes(this.state) && !(this.state === "attack" && this.move?.air);
  }

  moveInvuln(kind) {
    if (this.state !== "attack") return false;
    const m = this.move;
    if (inRange(this.mt, m.invuln)) return true;
    if (kind === "proj" && inRange(this.mt, m.projInvuln)) return true;
    if (kind === "air" && inRange(this.mt, m.airInvuln)) return true;
    if (kind === "grab" && inRange(this.mt, m.grabInvuln)) return true;
    return false;
  }

  hurtboxes() {
    if (this.hidden || this.invuln > 0) return [];
    if (["knockdown", "getup", "thrown", "throwing", "tech", "ko", "win", "intro"].includes(this.state)) return [];
    if (this.state === "airhit" && this.juggle >= 7) return [];
    const air = this.y > 0;
    const crouch = !air && this.isCrouching();
    const h = this.hurtH ?? (crouch ? CROUCH_H : air ? 196 : BODY_H);
    const boxes = [{ x: this.x - 36, y: this.y + (air ? 16 : 0), w: 72, h }];
    if (this.state === "attack" && this.mt >= this.move.startup && !this.move.noLimb) {
      const hb = this.move.hits[0];
      if (hb && hb.box && !hb.grab && !hb.proj) {
        const wb = this.worldBox(hb.box);
        const sx = wb.w * 0.15;
        boxes.push({ x: wb.x + (this.facing > 0 ? 0 : sx * 2), y: wb.y + wb.h * 0.15, w: wb.w * 0.7, h: wb.h * 0.7 });
      }
    }
    return boxes;
  }

  worldBox(box) {
    const [bx, by, bw, bh] = box;
    const x = this.facing > 0 ? this.x + bx : this.x - bx - bw;
    return { x, y: this.y + by, w: bw, h: bh };
  }

  // ------------------------------------------------------------- render
  getPose() {
    const s = this.state;
    const t = this.t;
    const c = this.char;
    let p;
    switch (s) {
      case "idle":
        p = this.guard ? P.blockHigh : (c.anims?.idle || ANIM.idle)(this.b.frame + this.side * 30);
        break;
      case "walk":
        p = (c.anims?.walk || ANIM.walk)(t, this.walkDir || 1);
        if (this.guard) p = P.blockHigh;
        break;
      case "crouch":
        p = this.guard ? P.blockLow : ANIM.crouch(this.b.frame);
        break;
      case "dash":
        p = this.dashDir > 0 ? ANIM.dashF(t) : ANIM.dashB(t);
        break;
      case "jumpsquat":
        p = lerpPose(P.stance, P.crouch, Math.min(1, t / 3));
        break;
      case "air":
        if (this.jumpDir !== 0 && this.vy < 14 && this.vy > -12 && !this.superJump) p = { ...ANIM.flip(this.vy), rot: ((14 - this.vy) / 26) * 360 * this.jumpDir };
        else p = ANIM.jump(this.vy);
        break;
      case "land":
        p = ANIM.land(t);
        break;
      case "attack":
        p = this.move.anim ? this.move.anim(this.mt, this) : P.stance;
        break;
      case "hitstun":
        p = ANIM.hurt(this.hurtKind, t, this.stunTotal);
        break;
      case "blockstun":
        p = this.blockLow ? P.blockLow : P.blockHigh;
        break;
      case "airhit":
        p = ANIM.airHurt(t, this.vy);
        break;
      case "knockdown":
        p = ANIM.knockdown(t);
        break;
      case "getup":
        p = ANIM.getup(t);
        break;
      case "tech":
        p = NORMAL_ANIMS.tech(t);
        break;
      case "throwing":
        {
          const g = this.b.grab;
          const ap = g?.script?.attPose;
          p = ap ? ap(g.t, this) : NORMAL_ANIMS.throwing(g ? g.t : t);
        }
        break;
      case "thrown":
        p = this.b.grab?.script?.victimPose ? this.b.grab.script.victimPose(this.b.grab.t, this) : { ...P.air, rot: this.b.grab?.victimRot ?? 0 };
        break;
      case "ko":
        p = ANIM.ko(t);
        break;
      case "win":
        p = (c.anims?.win || ANIM.win)(t);
        break;
      case "intro":
        p = (c.anims?.intro || ANIM.intro)(t);
        break;
      default:
        p = P.stance;
    }
    return p;
  }
}
