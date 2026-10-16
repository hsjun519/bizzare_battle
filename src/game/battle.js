// The match simulation: rounds, timer, collisions, projectiles, throws,
// camera and the event stream the presentation layer reacts to.
import { STAGE_W, WALL, MAX_SEP, PUSH_HALF, SUPER_COST, MAX_METER, BUFFER } from "./constants.js";
import { Fighter } from "./fighter.js";
import { FX } from "../render/fx.js";
import { clamp, mulberry32, rectsOverlap } from "../core/util.js";
import { PARADIGMS } from "./paradigms.js";

const JUST_WINDOW = 9;

const inRange = (t, r) => r && t >= r[0] && t < r[1];

export class Battle {
  constructor({ p1, p2, stage = "agora", mode = "cpu", rounds = 2, timer = 99, seed = 1, training = null, paradigm = true, forceRule = null } = {}) {
    this.mode = mode;
    this.stage = stage;
    this.roundsToWin = rounds;
    this.timerSec = timer;
    this.rng = mulberry32(seed);
    this.fx = new FX();
    this.events = [];
    this.frame = 0;
    this.realFrame = 0;
    this.round = 1;
    this.fighters = [new Fighter(this, p1, 0), new Fighter(this, p2, 1)];
    this.projectiles = [];
    this.training = training;
    this.camera = { x: STAGE_W / 2, y: 0, zoom: 1.1, sx: 0, sy: 0 };
    this.shakeAmt = 0;
    this.screenFlash = null;
    this.superInfo = null;
    this.matchWinner = null;
    this.paradigm = paradigm;
    this.forceRule = forceRule;
    this.usedRules = [];
    this.rule = null;
    this.ruleCard = null;
    this.startRound(true);
  }

  // ----------------------------------------------------------- utilities
  emit(e) {
    this.events.push(e);
  }
  drain() {
    const e = this.events;
    this.events = [];
    return e;
  }
  sfx(name) {
    this.emit({ type: "sfx", name });
  }
  shake(n) {
    this.shakeAmt = Math.max(this.shakeAmt, n);
  }
  flashScreen(color = "#ffffff", life = 8, alpha = 0.7) {
    this.screenFlash = { color, life, max: life, alpha };
  }
  get canAct() {
    return this.phase === "fight";
  }

  startRound(first = false) {
    const cx = STAGE_W / 2;
    this.fighters[0].resetRound(cx - 230, 1);
    this.fighters[1].resetRound(cx + 230, -1);
    this.projectiles = [];
    this.grab = null;
    this.hitstop = 0;
    this.freeze = 0;
    this.slowmo = 0;
    this.superInfo = null;
    this.timer = this.timerSec === Infinity ? Infinity : this.timerSec * 60;
    this.phase = "intro";
    this.phaseT = 0;
    this.introLen = first && this.mode !== "training" ? 170 : 110;
    if (this.mode === "training") this.introLen = 40;
    this.roundWinner = null;
    this.koSide = null;
    this.rule = null;
    this.ruleCard = null;
    this.fightT = 0;
    this.posHistory = [];
    this.recurT = 0;
    for (const f of this.fighters) {
      f.state = first && this.mode !== "training" ? "intro" : "idle";
      f.t = 0;
    }
    this.camera.x = cx;
    this.emit({ type: "roundStart", round: this.round, first });
  }

  // ----------------------------------------------------------- main step
  step(controls = [{}, {}]) {
    this.realFrame++;
    const slow = this.slowmo > 0 && this.phase === "ko";
    this.fx.update(this.hitstop > 0 || this.freeze > 0 ? 0.35 : slow ? 0.4 : 1);
    if (this.screenFlash && --this.screenFlash.life <= 0) this.screenFlash = null;
    this.shakeAmt *= 0.86;
    if (this.shakeAmt < 0.3) this.shakeAmt = 0;
    this.updateCamera();
    if (this.phase !== "fight") this.phaseT++;

    if (this.ruleCard && this.ruleCard.t < 400) this.ruleCard.t++;
    if (this.freeze > 0) {
      this.freeze--;
      if (this.superInfo) this.superInfo.t++;
      this.bufferOnly(controls);
      return;
    }
    if (this.superInfo) this.superInfo.t++;
    if (this.hitstop > 0) {
      this.hitstop--;
      this.bufferOnly(controls);
      return;
    }
    if (slow) {
      this.slowmo--;
      if (this.slowmo % 3 !== 0) return;
    }
    this.frame++;
    this.phaseLogic();
    if (this.phase === "matchEnd") return;

    const [a, b] = this.fighters;
    const prev = [a.x, b.x];
    a.update(controls[0] || {});
    b.update(controls[1] || {});
    if (this.grab) this.updateGrab();
    this.updateProjectiles();
    this.constrain(prev);
    this.checkHits();
    this.checkProjectileHits();

    if (this.phase === "fight") this.paradigmUpdate();
    if (this.phase === "fight" && this.timer !== Infinity) {
      this.timer--;
      if (this.timer % 60 === 0 && this.timer <= 600 && this.timer > 0) this.sfx("tick");
      if (this.timer <= 0) this.timeOver();
    }
    if (this.mode === "training") this.trainingUpdate();
  }

  bufferOnly(controls) {
    this.fighters.forEach((f, i) => {
      const p = (controls[i] && controls[i].pressed) || {};
      if (p[f.facing > 0 ? "left" : "right"]) f.backTap = this.frame;
      for (const k of ["L", "H", "S", "X", "G"]) if (p[k]) f.buf[k] = BUFFER;
      if (p.L || p.H || p.G) {
        if (p.G || (f.buf.L === BUFFER && f.buf.H === BUFFER)) f.grabReq = true;
      }
      const held = (controls[i] && controls[i].held) || {};
      f.in.held = held;
      f.in.up = Boolean(held.up);
      f.in.down = Boolean(held.down);
    });
  }

  phaseLogic() {
    const [a, b] = this.fighters;
    switch (this.phase) {
      case "intro": {
        const L = this.introLen;
        if (this.phaseT === L - 75) this.emit({ type: "announce", text: this.roundLabel(), kind: "round" });
        if (this.phaseT === L - 20) {
          for (const f of this.fighters) if (f.state === "intro") f.setState("idle");
        }
        if (this.phaseT === L - 22) this.emit({ type: "announce", text: "FIGHT!", kind: "fight" });
        if (this.phaseT >= L) {
          this.phase = "fight";
          this.phaseT = 0;
          for (const f of this.fighters) if (f.state === "intro") f.setState("idle");
        }
        break;
      }
      case "ko": {
        const loser = this.fighters[this.koSide];
        const winner = this.fighters[1 - this.koSide];
        if (this.phaseT > 110 && winner.state !== "win" && (winner.actionable || winner.state === "land") && winner.y <= 0 && !this.doubleKO) {
          winner.state = "win";
          winner.t = 0;
          winner.facing = loser.x > winner.x ? 1 : -1;
        }
        if (this.phaseT > 230 && loser.y <= 0) this.endRound(this.doubleKO ? null : winner.side);
        break;
      }
      case "timeover": {
        if (this.phaseT === 80) {
          const ra = a.health / a.maxHealth;
          const rb = b.health / b.maxHealth;
          const w = Math.abs(ra - rb) < 0.0001 ? null : ra > rb ? 0 : 1;
          this.timeWinner = w;
          if (w !== null) {
            const f = this.fighters[w];
            f.state = "win";
            f.t = 0;
          }
          this.emit({ type: "announce", text: w === null ? "DRAW" : `${this.fighters[w].char.short} WINS`, kind: "small" });
        }
        if (this.phaseT > 200) this.endRound(this.timeWinner);
        break;
      }
      case "roundEnd": {
        if (this.phaseT > 40) {
          if (this.fighters.some((f) => f.wins >= this.roundsToWin) || this.round >= 9) {
            this.phase = "matchEnd";
            this.matchWinner = a.wins === b.wins ? (a.stats.dmg >= b.stats.dmg ? 0 : 1) : a.wins > b.wins ? 0 : 1;
            this.emit({ type: "matchEnd", winner: this.matchWinner });
          } else {
            this.round++;
            this.startRound(false);
          }
        }
        break;
      }
    }
  }

  roundLabel() {
    const [a, b] = this.fighters;
    if (a.wins === this.roundsToWin - 1 && b.wins === this.roundsToWin - 1 && this.roundsToWin > 1) return "FINAL ROUND";
    return `ROUND ${this.round}`;
  }

  timeOver() {
    this.phase = "timeover";
    this.phaseT = 0;
    this.projectiles = [];
    this.emit({ type: "announce", text: "TIME OVER", kind: "ko" });
    this.sfx("announce");
  }

  endRound(winner) {
    this.phase = "roundEnd";
    this.phaseT = 0;
    this.roundWinner = winner;
    if (winner !== null && winner !== undefined) {
      const f = this.fighters[winner];
      f.wins++;
      if (f.health >= f.maxHealth) {
        f.stats.perfect++;
      }
    }
    this.emit({ type: "roundEnd", winner });
  }

  onKO(att, def) {
    if (this.mode === "training") return;
    if (this.phase === "ko") {
      if (def.side !== this.koSide) this.doubleKO = true;
      return;
    }
    this.phase = "ko";
    this.phaseT = 0;
    this.koSide = def.side;
    this.doubleKO = att.health <= 0;
    this.slowmo = 54;
    this.hitstop = Math.max(this.hitstop, 22);
    this.shake(16);
    this.flashScreen("#ffffff", 10, 0.85);
    this.sfx("ko");
    const perfect = att.health >= att.maxHealth;
    this.emit({ type: "announce", text: "K.O.", kind: "ko" });
    if (perfect) this.emit({ type: "announce", text: "PERFECT", kind: "perfect", delay: 70 });
    this.emit({ type: "ko", side: def.side, perfect });
  }

  // ----------------------------------------------------------- spatial
  constrain(prev) {
    const [a, b] = this.fighters;
    if (!this.grab) {
      // pushboxes
      const ah = a.y;
      const bh = b.y;
      const solid = (f) => !f.hidden && f.state !== "knockdown" && f.state !== "ko" && f.state !== "getup";
      if (solid(a) && solid(b) && Math.abs(ah - bh) < 120) {
        const dx = b.x - a.x;
        const overlap = PUSH_HALF * 2 - Math.abs(dx);
        if (overlap > 0) {
          const dir = dx === 0 ? (a.facing > 0 ? 1 : -1) : Math.sign(dx);
          const aAir = a.y > 0;
          const bAir = b.y > 0;
          const ka = aAir && !bAir ? 0.9 : !aAir && bAir ? 0.1 : 0.5;
          a.x -= dir * overlap * ka;
          b.x += dir * overlap * (1 - ka);
        }
      }
      // keep both on screen
      const sep = Math.abs(a.x - b.x);
      if (sep > MAX_SEP) {
        const ex = sep - MAX_SEP;
        const dirA = Math.sign(a.x - b.x);
        const awayA = Math.max(0, (a.x - prev[0]) * dirA);
        const awayB = Math.max(0, (b.x - prev[1]) * -dirA);
        const tot = awayA + awayB || 2;
        const fa = awayA + awayB ? awayA / tot : 0.5;
        a.x -= dirA * ex * fa;
        b.x += dirA * ex * (1 - fa);
      }
    }
    for (const f of this.fighters) {
      if (f.x < WALL) {
        f.x = WALL;
        if (f.vx < 0 && (f.state === "airhit" || f.state === "hitstun")) f.vx = 0;
      }
      if (f.x > STAGE_W - WALL) {
        f.x = STAGE_W - WALL;
        if (f.vx > 0 && (f.state === "airhit" || f.state === "hitstun")) f.vx = 0;
      }
    }
    // pushing someone into the wall moves you instead
    if (!this.grab && Math.abs(a.y - b.y) < 120) {
      const dx = b.x - a.x;
      const overlap = PUSH_HALF * 2 - Math.abs(dx);
      if (overlap > 0 && a.state !== "knockdown" && b.state !== "knockdown") {
        const dir = Math.sign(dx) || 1;
        if (b.x >= STAGE_W - WALL - 0.5 || b.x <= WALL + 0.5) a.x -= dir * overlap;
        else if (a.x >= STAGE_W - WALL - 0.5 || a.x <= WALL + 0.5) b.x += dir * overlap;
      }
    }
  }

  atWall(f, dir) {
    return dir > 0 ? f.x >= STAGE_W - WALL - 6 : f.x <= WALL + 6;
  }

  isThreatened(f) {
    const o = f.opp;
    const d = Math.abs(o.x - f.x);
    if (o.state === "attack" && d < 420 && o.mt < o.move.frames && o.move.kind !== "throw") return true;
    if (o.state === "air" && d < 260) return true;
    for (const p of this.projectiles) {
      if (p.owner === o && !p.dead && p.hitsLeft > 0) {
        const toward = Math.sign(f.x - p.x) === Math.sign(p.vx || f.x - p.x);
        if (Math.abs(p.x - f.x) < 460 && toward) return true;
      }
    }
    return false;
  }

  // ----------------------------------------------------------- hits
  checkHits() {
    const results = [];
    for (const att of this.fighters) {
      if (att.state !== "attack") continue;
      const def = att.opp;
      const m = att.move;
      for (let i = 0; i < m.hits.length; i++) {
        const h = m.hits[i];
        if (h.proj || !h.box) continue;
        if (!inRange(att.mt, h.at)) continue;
        const log = att.hitLog[i];
        const maxHits = h.max || 1;
        if (log.n >= maxHits) continue;
        if (log.n > 0 && att.mt - log.last < (h.every || 999)) continue;
        if (h.groundOnly && def.y > 0) continue;
        if (h.when && !h.when(att, this)) continue;
        if (h.airOnly && def.y <= 0) continue;
        let hb = att.worldBox(h.box);
        if (this.rule?.reach) {
          const k = this.rule.reach;
          hb = { x: hb.x - (hb.w * (k - 1)) / 2, y: hb.y - (hb.h * (k - 1)) / 2, w: hb.w * k, h: hb.h * k };
        }
        let point = null;
        for (const hu of def.hurtboxes()) {
          if (rectsOverlap(hb, hu)) {
            const x0 = Math.max(hb.x, hu.x);
            const x1 = Math.min(hb.x + hb.w, hu.x + hu.w);
            const y0 = Math.max(hb.y, hu.y);
            const y1 = Math.min(hb.y + hb.h, hu.y + hu.h);
            point = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
            break;
          }
        }
        if (!point) continue;
        results.push({ att, def, h, i, point });
        break;
      }
    }
    // Resolve after detection so simultaneous hits trade.
    for (const r of results) {
      const log = r.att.hitLog[r.i];
      const res = this.resolveHit(r.att, r.def, r.h, { point: r.point, move: r.att.move });
      if (res !== "whiff") {
        log.n++;
        log.last = r.att.mt;
      }
    }
  }

  resolveHit(att, def, h, src = {}) {
    const isProj = Boolean(src.proj);
    const kind = h.grab ? "grab" : isProj ? "proj" : att.y > 0 ? "air" : "strike";
    if (def.moveInvuln(kind) || (kind !== "grab" && def.moveInvuln("strike"))) return "whiff";
    if (isProj && def.char.hooks?.projImmune?.(def, src.proj, this)) {
      this.fx.spark(src.proj.x, src.proj.y, "block", Math.sign(src.proj.vx) || 1);
      this.fx.text(def.x, def.y + 170, "통 방어!", "#ffd45a", 26, 34);
      this.sfx("block");
      return "immune";
    }
    if (h.grab) {
      if (!def.isThrowable() || def.state === "hitstun" || def.state === "blockstun") return "whiff";
      if (h.grab === "throw") this.startThrow(att, def);
      else this.startGrab(att, def, h.grab, h);
      return "grab";
    }
    // counter stances
    if (def.state === "attack" && def.move.counter && inRange(def.mt, def.move.counter.at)) {
      const c = def.move.counter;
      if (!isProj || c.proj !== false) {
        c.on(def, att, h, this, src);
        return "countered";
      }
    }
    // blocking
    const fromX = isProj ? src.proj.x - (src.proj.vx || 0) * 4 : att.x;
    if (!h.unblockable && def.canBlock() && def.holdingAwayFrom(fromX)) {
      const crouching = def.in.down;
      const ok = h.level === "low" ? crouching : h.level === "high" ? !crouching : true;
      if (ok) {
        if (this.frame - def.backTap <= JUST_WINDOW && !h.noJust) {
          this.justGuard(att, def, h, src, crouching, fromX);
          return "block";
        }
        this.applyBlock(att, def, h, src, crouching, fromX);
        return "block";
      }
    }
    // armour
    if (def.state === "attack" && inRange(def.mt, def.move.armor) && def.armorLeft > 0) {
      def.armorLeft--;
      const dmg = Math.round(h.dmg * 0.5 * att.damageMult());
      def.health = Math.max(1, def.health - dmg);
      def.flash = 4;
      this.hitstop = Math.max(this.hitstop, 9);
      const p = src.point || { x: def.x, y: def.y + 140 };
      this.fx.spark(p.x, p.y, "armor", att.facing);
      this.sfx("armor");
      this.markConnect(att, src, false);
      return "armor";
    }
    this.applyHit(att, def, h, src);
    return "hit";
  }

  markConnect(att, src, hit) {
    if (src.proj) return;
    att.connected = true;
    if (hit) att.hitConnected = true;
  }

  applyBlock(att, def, h, src, crouching, fromX) {
    def.state = "blockstun";
    def.t = 0;
    def.move = null;
    def.stun = h.bstun;
    def.stunTotal = h.bstun;
    def.blockLow = crouching;
    def.guard = true;
    const isSuper = src.move?.kind === "super" || src.proj?.super;
    const chip = Math.round((h.chip || 0) * att.damageMult());
    if (chip > 0) {
      def.health = Math.max(isSuper ? 0 : 1, def.health - chip);
      att.stats.dmg += chip;
    }
    const dir = Math.sign(def.x - fromX) || -att.facing;
    def.vx = dir * (h.push * 0.85 + 1.5);
    if (!src.proj && this.atWall(def, dir)) att.vx = -dir * h.push * 0.7;
    this.hitstop = Math.max(this.hitstop, Math.round((h.stop || 8) * 0.7));
    def.shake = this.hitstop;
    att.gainMeter(h.dmg * 0.04);
    def.gainMeter(h.dmg * 0.03);
    const p = src.point || (src.proj ? { x: src.proj.x, y: src.proj.y } : { x: def.x, y: def.y + 120 });
    this.fx.spark(p.x, p.y, "block", -dir);
    this.sfx("block");
    def.stats.blocks++;
    this.markConnect(att, src, false);
    h.onBlock?.(att, def, this, src);
    this.emit({ type: "block", side: def.side });
    if (def.health <= 0) this.onKO(att, def);
  }

  scaleFor(n, att, isSuper) {
    const floor = att.char.hooks?.scaleFloor ?? 0.3;
    const step = att.char.hooks?.scaleStep ?? 0.1;
    const s = n <= 2 ? 1 : Math.max(floor, 1 - step * (n - 2));
    return isSuper ? Math.max(0.5, s) : s;
  }

  applyHit(att, def, h, src = {}) {
    const isSuper = src.move?.kind === "super" || src.proj?.super || h.super;
    const counter = def.state === "attack" && def.mt < def.move.startup + 2 && def.move.kind !== "throw" && !src.grab;
    def.combo++;
    const sc = h.noScale ? 1 : this.scaleFor(def.combo, att, isSuper);
    let dmg = Math.round(h.dmg * sc * att.damageMult() * (counter ? 1.2 : 1) * (src.proj?.dmgMult ?? 1) * (this.rule?.dmg ?? 1));
    if (this.training?.invincible && def.side === 1) dmg = Math.min(dmg, def.health - 1);
    dmg = Math.max(1, dmg);
    def.health = Math.max(0, def.health - dmg);
    def.comboDmg += dmg;
    if (this.rule?.lifesteal && att.health > 0) att.health = Math.min(att.maxHealth, att.health + Math.round(dmg * this.rule.lifesteal));
    att.stats.dmg += dmg;
    att.stats.hits++;
    att.stats.maxCombo = Math.max(att.stats.maxCombo, def.combo);
    def.lastHitBy = att.side;
    def.move = null;
    def.guard = false;
    def.flash = 3;
    def.char.hooks?.onHurt?.(def, dmg, this);

    const fromX = src.proj ? src.proj.x - (src.proj.vx || 0) * 3 : att.x;
    const dir = Math.sign(def.x - fromX) || att.facing;
    const airborne = def.y > 0 || def.state === "airhit" || def.state === "thrown";
    let launch = h.launch || (airborne ? h.airLaunch || [3, 7] : null);
    if (!launch && h.kd) launch = [2.5, 6];
    if (def.health <= 0) launch = [Math.max(6, launch ? launch[0] : 6), Math.max(13, launch ? launch[1] : 13)];
    if (launch) {
      def.state = "airhit";
      def.t = 0;
      // later juggle hits pop the victim less so loops die out
      const decay = Math.max(0.55, 1 - def.juggle * 0.08);
      def.vx = dir * launch[0];
      def.vy = launch[1] * (airborne ? decay : 1);
      def.y = Math.max(def.y, 1);
      def.kd = Boolean(h.kd) || def.health <= 0;
      def.juggle += h.jug ?? 1;
    } else {
      def.state = "hitstun";
      def.t = 0;
      const decay = Math.floor(Math.max(0, def.combo - 4) / 2) * 2;
      def.stun = Math.max(8, h.stun + (counter ? 6 : 0) - decay);
      def.stunTotal = def.stun;
      def.hurtKind = h.level === "low" || def.isCrouching() ? "low" : h.box && h.box[1] < 90 ? "gut" : "high";
      def.vx = dir * h.push;
      if (!src.proj && this.atWall(def, dir)) att.vx = -dir * h.push * 0.8;
    }
    const stop = (h.stop ?? 8) + (counter ? 4 : 0);
    this.hitstop = Math.max(this.hitstop, stop);
    def.shake = stop;
    att.shake = 0;
    const p = src.point || (src.proj ? { x: src.proj.x, y: src.proj.y } : { x: def.x - dir * 20, y: def.y + 140 });
    const sparkKind = counter ? "counter" : isSuper ? "super" : h.spark || "l";
    this.fx.spark(p.x, p.y, sparkKind, -dir, h.tint || null);
    if (sparkKind !== "l") this.shake(sparkKind === "super" ? 9 : sparkKind === "s" ? 6 : 4);
    if (counter) {
      this.fx.text(p.x, p.y + 60, "COUNTER!", "#ff5c5c", 34, 44);
      this.sfx("counter");
    }
    this.sfx(h.sfx || (sparkKind === "h" || sparkKind === "counter" ? "hit_h" : sparkKind === "s" ? "hit_special" : sparkKind === "super" ? "hit_super" : "hit_l"));
    if (!isSuper) att.gainMeter(dmg * 0.1);
    def.gainMeter(dmg * 0.065);
    this.markConnect(att, src, true);
    h.onHit?.(att, def, this, src);
    this.emit({ type: "hit", side: att.side, dmg, combo: def.combo, counter, comboDmg: def.comboDmg });
    if (def.health <= 0) this.onKO(att, def);
  }

  // ----------------------------------------------------------- throws
  startThrow(att, def) {
    const back = att.in.back;
    this.grab = { att, def, t: 0, kind: "throw", back, techable: true, victimRot: 0 };
    att.state = "throwing";
    att.t = 0;
    att.move = null;
    att.vx = 0;
    def.state = "thrown";
    def.t = 0;
    def.move = null;
    def.vx = def.vy = 0;
    def.y = 0;
    att.stats.throws++;
    this.sfx("grab");
    this.emit({ type: "throw", side: att.side });
  }

  startGrab(att, def, script, h) {
    this.grab = { att, def, t: 0, kind: "cmd", script, h, victimRot: 0, vars: {} };
    att.state = "throwing";
    att.t = 0;
    att.move = null;
    att.vx = 0;
    def.state = "thrown";
    def.t = 0;
    def.move = null;
    def.vx = def.vy = 0;
    this.sfx(script.sfx || "grab");
    script.onStart?.(this.grab, this);
  }

  updateGrab() {
    const g = this.grab;
    const { att, def } = g;
    g.t++;
    if (g.kind === "throw") {
      if (g.techable && g.t <= 7 && def.grabReq) {
        this.grab = null;
        for (const f of [att, def]) {
          f.state = "tech";
          f.t = 0;
          f.vx = -Math.sign(f.opp.x - f.x || f.facing) * 8;
        }
        this.fx.text((att.x + def.x) / 2, 200, "TECH!", "#7ad7ff", 34, 40);
        this.fx.spark((att.x + def.x) / 2, 130, "block", 1);
        this.sfx("tech");
        return;
      }
      const fwd = g.back ? -1 : 1;
      let hx;
      let hy;
      let rot;
      if (g.t < 14) {
        const u = g.t / 14;
        hx = 76 - u * 34;
        hy = 6 + u * 130;
        rot = -u * 110;
      } else {
        const u = Math.min(1, (g.t - 14) / 8);
        hx = 42 + (fwd > 0 ? u * 76 : -u * 150);
        hy = 136 - u * 70 + (fwd < 0 ? Math.sin(u * Math.PI) * 50 : 0);
        rot = -110 - u * 100 * fwd;
      }
      def.x = att.x + att.facing * hx;
      def.y = hy;
      g.victimRot = rot;
      if (g.t === 22) {
        const dir = att.facing * fwd;
        def.x = att.x + att.facing * hx;
        this.applyHit(att, def, { dmg: att.char.throwDmg || 110, launch: [6.5, 9], kd: true, stop: 10, spark: "h", sfx: "throw", level: "mid", push: 0 }, { grab: true, point: { x: def.x, y: def.y + 40 } });
        def.vx = dir * 6.5;
        this.shake(6);
      }
      if (g.t >= 22) {
        att.state = "throwing";
        if (g.t >= 38) {
          this.grab = null;
          att.state = "idle";
          att.t = 0;
        }
      }
      return;
    }
    // command grab with a scripted sequence
    const s = g.script;
    const hold = s.hold ? s.hold(g.t, g, this) : { x: 70, y: 20, rot: 0 };
    if (hold && g.t < s.release.at) {
      def.x = att.x + att.facing * hold.x;
      def.y = Math.max(0, hold.y);
      g.victimRot = hold.rot || 0;
    }
    s.events?.(g.t, g, this);
    if (g.t === s.release.at) {
      const r = s.release;
      this.applyHit(att, def, { dmg: r.dmg, launch: r.launch, kd: r.kd ?? true, stop: r.stop ?? 14, spark: r.spark || "s", sfx: r.sfx, super: r.super, noScale: true, level: "mid", push: 0, tint: r.tint }, { grab: true, point: { x: def.x, y: def.y + 120 }, move: r.super ? { kind: "super" } : null });
    }
    if (g.t >= s.frames) {
      this.grab = null;
      att.state = "idle";
      att.t = 0;
      att.faceOpponent();
    }
  }

  // Damage applied during a grab sequence without changing states.
  grabTick(att, def, dmg, text = null, color = "#ffffff") {
    const d = Math.max(1, Math.round(dmg * att.damageMult()));
    def.health = Math.max(1, def.health - d);
    att.stats.dmg += d;
    def.combo++;
    def.comboDmg += d;
    def.flash = 3;
    this.hitstop = Math.max(this.hitstop, 5);
    this.fx.spark(def.x, def.y + 120, "l", att.facing);
    this.sfx("hit_l");
    if (text) this.fx.text(def.x + (def.combo % 2 ? -60 : 60), def.y + 230 + (def.combo % 3) * 34, text, color, 28, 40);
    this.emit({ type: "hit", side: att.side, dmg: d, combo: def.combo, comboDmg: def.comboDmg });
  }

  // ----------------------------------------------------------- projectiles
  spawn(spec) {
    const p = {
      x: 0,
      y: 120,
      vx: 0,
      vy: 0,
      w: 40,
      h: 40,
      life: 180,
      age: 0,
      hitsLeft: spec.hits ?? 1,
      every: 10,
      lastHit: -999,
      gravity: 0,
      strength: 1,
      clash: true,
      dead: false,
      ...spec,
    };
    p.side = p.owner.side;
    if (p.srcMoveId === undefined) {
      p.srcMoveId = p.owner.state === "attack" ? p.owner.moveId : null;
      p.srcMove = p.owner.state === "attack" ? p.owner.move : null;
    }
    this.projectiles.push(p);
    return p;
  }

  updateProjectiles() {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.age++;
      p.update?.(p, this);
      if (p.dead) continue;
      if (this.rule?.homing && p.homable !== false && p.hitsLeft > 0) this.steer(p, this.rule.homing);
      p.vy -= p.gravity * (this.rule?.gravity ?? 1);
      p.x += p.vx;
      p.y += p.vy;
      if (p.ground !== undefined && p.y - p.h / 2 < p.ground) {
        if (p.onGround) p.onGround(p, this);
        else p.y = p.ground + p.h / 2;
      }
      if (--p.life <= 0 || p.x < -300 || p.x > STAGE_W + 300) this.killProjectile(p, false);
    }
    // clashes
    const ps = this.projectiles;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.dead || !a.clash) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        if (b.dead || !b.clash || b.side === a.side) continue;
        if (!rectsOverlap(projRect(a), projRect(b))) continue;
        const sa = a.strength;
        const sb = b.strength;
        a.strength -= sb;
        b.strength -= sa;
        this.fx.spark((a.x + b.x) / 2, (a.y + b.y) / 2, "h", 1);
        this.sfx("hit_l");
        if (a.strength <= 0) this.killProjectile(a, true);
        if (b.strength <= 0) this.killProjectile(b, true);
        if (a.dead) break;
      }
    }
    this.projectiles = ps.filter((p) => !p.dead);
  }

  killProjectile(p, burst = true) {
    if (p.dead) return;
    p.dead = true;
    p.onDie?.(p, this, burst);
    if (burst && !p.onDie) {
      this.fx.ring(p.x, p.y, "#ffffff", 5, 10, 4);
      this.fx.debris(p.x, p.y, 6, { color: p.color || "#ffffff", g: 0.2, life: 18, size: 5, floor: false });
    }
  }

  checkProjectileHits() {
    for (const p of this.projectiles) {
      if (p.dead || p.hitsLeft <= 0 || !p.hit) continue;
      if (p.age - p.lastHit < p.every) continue;
      const def = this.fighters[1 - p.side];
      const r = projRect(p);
      let point = null;
      for (const hu of def.hurtboxes()) {
        if (rectsOverlap(r, hu)) {
          point = { x: (Math.max(r.x, hu.x) + Math.min(r.x + r.w, hu.x + hu.w)) / 2, y: (Math.max(r.y, hu.y) + Math.min(r.y + r.h, hu.y + hu.h)) / 2 };
          break;
        }
      }
      if (!point) continue;
      const res = this.resolveHit(p.owner, def, p.hit, { proj: p, point });
      if (res === "whiff") continue;
      p.lastHit = p.age;
      p.hitsLeft--;
      p.onHit?.(p, this, res);
      if (p.hitsLeft <= 0 && !p.persist) this.killProjectile(p, true);
    }
  }

  // ----------------------------------------------------------- signature: REFUTE & ACQUIRE
  justGuard(att, def, h, src, crouching, fromX) {
    def.state = "blockstun";
    def.t = 0;
    def.move = null;
    def.stun = Math.max(3, Math.floor((h.bstun || 10) * 0.35));
    def.stunTotal = def.stun;
    def.blockLow = crouching;
    def.guard = true;
    def.vx = 0;
    def.flash = 5;
    def.backTap = -99;
    if (!src.proj) att.vx = -Math.sign(def.x - att.x) * 6;
    this.hitstop = Math.max(this.hitstop, (h.stop || 8) + 5);
    def.gainMeter(9);
    const p = src.point || (src.proj ? { x: src.proj.x, y: src.proj.y } : { x: def.x, y: def.y + 130 });
    const philo = def.char.faction === "philosophy";
    const col = philo ? "#9ad8ff" : "#ffd45a";
    this.fx.spark(p.x, p.y, "super", Math.sign(fromX - def.x) || 1, col);
    this.fx.ring(p.x, p.y, col, 10, 16, 7);
    this.fx.text(def.x, def.y + 250, philo ? "논파!" : "인수!", col, 44, 44);
    this.flashScreen(col, 6, 0.25);
    this.sfx("parry");
    def.stats.justGuards = (def.stats.justGuards || 0) + 1;
    this.markConnect(att, src, false);
    this.emit({ type: "justGuard", side: def.side });
    // Steal the special that was just refuted.
    const id = src.proj ? src.proj.srcMoveId : att.moveId;
    const m = src.proj ? src.proj.srcMove : att.move;
    if (!def.stolen && id && id !== "stolen" && m && m.kind === "special" && m.owner === att.char && !m.noSteal) {
      const frames = 600;
      def.stolen = { id, move: m, char: att.char, timer: frames, max: frames };
      att.locked[id] = frames;
      this.fx.text(def.x, def.y + 310, m.name + (philo ? " 논파 완료" : " 인수 완료"), "#ffffff", 28, 70);
      this.sfx("meter");
      this.emit({ type: "steal", side: def.side, name: m.name, from: att.char.name });
    }
  }

  // ----------------------------------------------------------- signature: PARADIGM SHIFT
  paradigmUpdate() {
    this.fightT++;
    if (this.paradigm && !this.rule && this.mode !== "training" && this.fightT === 15 * 60) this.shiftParadigm();
    if (this.rule?.recurrence) {
      const rc = this.rule.recurrence;
      this.posHistory.push(this.fighters.map((f) => f.x));
      if (this.posHistory.length > rc.back + 2) this.posHistory.shift();
      this.recurT++;
      if (this.recurT >= rc.every && !this.grab && this.posHistory.length > rc.back) {
        this.recurT = 0;
        const past = this.posHistory[this.posHistory.length - 1 - rc.back];
        this.fighters.forEach((f, i) => {
          this.fx.ring(f.x, f.y + 110, "#c48bff", 9, 18, 6);
          this.fx.dust(f.x, f.y, 6, "#c48bff");
          f.x = past[i];
          f.vx = 0;
          f.trail = 14;
          this.fx.ring(f.x, f.y + 110, "#ffffff", 6, 14, 4);
        });
        this.fx.text((past[0] + past[1]) / 2, 330, "영원회귀", "#c48bff", 40, 50);
        this.flashScreen("#c48bff", 8, 0.35);
        this.sfx("teleport");
        this.emit({ type: "recurrence" });
      }
    }
  }

  shiftParadigm(id = null) {
    const pool = PARADIGMS.filter((r) => !this.usedRules.includes(r.id));
    const list = pool.length ? pool : PARADIGMS;
    const rule = (id && PARADIGMS.find((r) => r.id === id)) || (this.forceRule && PARADIGMS.find((r) => r.id === this.forceRule)) || list[Math.floor(this.rng() * list.length)];
    this.rule = rule;
    this.usedRules.push(rule.id);
    this.ruleCard = { rule, t: 0 };
    this.freeze = Math.max(this.freeze, 100);
    this.posHistory = [];
    this.recurT = 0;
    this.sfx("announce");
    this.emit({ type: "paradigm", rule });
  }

  steer(p, k) {
    const def = this.fighters[1 - p.side];
    const sp = Math.hypot(p.vx, p.vy);
    if (sp < 1.5) return;
    const tx = def.x - p.x;
    const ty = def.y + 110 - p.y;
    const want = Math.atan2(ty, tx);
    let cur = Math.atan2(p.vy, p.vx);
    let d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    cur += Math.max(-k, Math.min(k, d));
    p.vx = Math.cos(cur) * sp;
    p.vy = Math.sin(cur) * sp;
  }

  // ----------------------------------------------------------- presentation
  superFlash(f, m) {
    this.freeze = 46;
    this.superInfo = { side: f.side, name: m.name, t: 0, char: f.char, line: m.line };
    this.sfx("super_flash");
    this.flashScreen(f.char.color, 6, 0.35);
    this.emit({ type: "super", side: f.side, name: m.name });
  }

  updateCamera() {
    const [a, b] = this.fighters;
    const cam = this.camera;
    let tx = (a.x + b.x) / 2;
    const sep = Math.abs(a.x - b.x);
    let tz = clamp(1280 / (sep + 420), 0.92, 1.12);
    if (this.phase === "ko" && this.phaseT < 90 && this.koSide !== null) {
      const l = this.fighters[this.koSide];
      tx = (l.x * 2 + tx) / 3;
      tz = 1.28;
    }
    if (this.freeze > 0 && this.superInfo) {
      const f = this.fighters[this.superInfo.side];
      tx = (f.x * 2 + tx) / 3;
      tz = 1.22;
    }
    const k = this.freeze > 0 || this.phase === "ko" ? 0.12 : 0.18;
    cam.x += (tx - cam.x) * k;
    cam.zoom += (tz - cam.zoom) * 0.08;
    const half = 640 / cam.zoom;
    cam.x = clamp(cam.x, half, STAGE_W - half);
    const top = Math.max(a.y, b.y);
    cam.y += (Math.max(0, top - 230) * 0.55 - cam.y) * 0.12;
    const s = this.shakeAmt;
    cam.sx = s ? (Math.random() - 0.5) * s * 2 : 0;
    cam.sy = s ? (Math.random() - 0.5) * s * 2 : 0;
  }

  // ----------------------------------------------------------- training
  trainingUpdate() {
    const opts = this.training || {};
    for (const f of this.fighters) {
      if (opts.meter) f.meter = MAX_METER;
      const idle = f.actionable || f.state === "air";
      if (idle) f.idleT = (f.idleT || 0) + 1;
      else f.idleT = 0;
      if (f.idleT > 50 && f.health < f.maxHealth) {
        f.health = Math.min(f.maxHealth, f.health + 40);
      }
      if (f.health <= 0) f.health = 1;
    }
  }
}

export function projRect(p) {
  return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
}
