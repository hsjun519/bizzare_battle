import { fighterById } from "./roster.js";
import { ArenaWorld } from "./world.js";
export const WIDTH = 960,
  FLOOR = 410;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function makePlayer(id, x, facing) {
  return {
    fighter: fighterById(id),
    x,
    y: 0,
    vy: 0,
    facing,
    health: 100,
    shield: id === "huang" ? 22 : 0,
    jacketLost: false,
    coatTorn: false,
    boosters: 2,
    capital: 80,
    holdings: { NVDA: 3, TSLA: 3, "BRK.B": 3 },
    meter: 100,
    wins: 0,
    attack: null,
    cooldown: 0,
    stun: 0,
    blocking: false,
    crouching: false,
    moving: false,
    skillCooldowns: { skill1: 0, skill2: 0 },
    specialQueue: [],
    jumpHeld: false,
    interactHeld: false,
    trail: 0,
    ruleIndex: 0,
    questionCd: 0,
    slip: 0,
    slipCd: 0,
    standing: null,
    stats: {
      damage: 0,
      blocked: 0,
      absorbed: 0,
      hits: 0,
      misses: 0,
      skills: 0,
      claims: 0,
      trades: 0,
      counters: 0,
    },
  };
}
export class Battle {
  constructor({
    player = "huang",
    opponent = "musk",
    mode = "cpu",
    difficulty = "normal",
    random = Math.random,
    stage = "agora",
  } = {}) {
    this.players = [makePlayer(player, 260, 1), makePlayer(opponent, 700, -1)];
    this.mode = mode;
    this.difficulty = difficulty;
    this.random = random;
    this.stage = stage;
    this.phase = "intro";
    this.phaseTime = 2.3;
    this.round = 1;
    this.time = 60;
    this.elapsed = 0;
    this.projectiles = [];
    this.particles = [];
    this.events = [];
    this.roundWinner = null;
    this.winner = null;
    this.paused = false;
    this.shake = 0;
    this.aiTimer = 0;
    this.aiInput = {};
    this.world = new ArenaWorld(this);
  }
  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }
  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
  pause(value = !this.paused) {
    if (this.phase !== "finished") this.paused = value;
  }
  resetRound() {
    const discoveries = this.world.discoveries;
    this.players = this.players.map((p, i) => ({
      ...makePlayer(p.fighter.id, i ? 700 : 260, i ? -1 : 1),
      wins: p.wins,
      stats: { ...p.stats },
    }));
    this.time = 60;
    this.projectiles = [];
    this.particles = [];
    this.roundWinner = null;
    this.phase = "intro";
    this.phaseTime = 2.3;
    this.aiInput = {};
    this.aiTimer = 0;
    this.world = new ArenaWorld(this);
    this.world.discoveries = new Set(discoveries);
  }
  update(dt, inputs = [{}, {}]) {
    if (this.paused || this.phase === "finished") return;
    dt = clamp(dt, 0, 0.05);
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 28);
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 210 * dt;
      return p.life > 0;
    });
    if (this.phase !== "fight") {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        if (this.phase === "intro") {
          this.phase = "fight";
          this.emit("fight");
        } else if (this.players.some((p) => p.wins >= 2)) {
          this.phase = "finished";
          this.winner = this.players[0].wins >= 2 ? 0 : 1;
          this.emit("matchEnd", { winner: this.winner });
        } else {
          this.round++;
          this.resetRound();
          this.emit("roundStart", { round: this.round });
        }
      }
      return;
    }
    this.time = Math.max(0, this.time - dt);
    this.world.update(dt);
    const controls = [
      inputs[0] || {},
      this.mode === "cpu"
        ? this.cpuInput(dt)
        : this.mode === "training"
          ? {}
          : inputs[1] || {},
    ];
    this.players.forEach((p, i) =>
      this.updatePlayer(p, this.players[1 - i], controls[i], dt, i),
    );
    this.separatePlayers();
    this.players.forEach((p, i) =>
      this.resolveAttack(p, this.players[1 - i], i),
    );
    this.updateProjectiles(dt);
    if (this.players.some((p) => p.health <= 0) || this.time <= 0) {
      if (this.mode === "training") {
        this.resetRound();
        this.phase = "fight";
        this.emit("notice", { text: "훈련 리셋 · 체력과 장비 복원" });
      } else this.endRound();
    }
  }
  updatePlayer(p, enemy, input, dt, index) {
    for (const k of [
      "cooldown",
      "stun",
      "trail",
      "questionCd",
      "slip",
      "slipCd",
    ])
      p[k] = Math.max(0, p[k] - dt);
    for (const k of Object.keys(p.skillCooldowns))
      p.skillCooldowns[k] = Math.max(0, p.skillCooldowns[k] - dt);
    p.meter = Math.min(100, p.meter + dt * (this.mode === "training" ? 18 : 4));
    p.capital = Math.min(
      150,
      p.capital + dt * (p.fighter.id === "buffett" ? 4 : 2),
    );
    p.facing = p.attack
      ? p.attack.facing
      : (input.aim ?? this.world.hurtbox(enemy).x) >= p.x
        ? 1
        : -1;
    p.moving = false;
    const oldY = p.y;
    p.standing = null;
    if (p.y > 0 || p.vy > 0) {
      p.y = Math.max(0, p.y + p.vy * dt);
      p.vy -= 1300 * dt;
    }
    if (p.vy <= 0) {
      const land = this.world.platformAt(p, oldY);
      if (land.standing) {
        p.y = land.top;
        p.vy = 0;
        p.standing = land.standing.id;
      } else if (p.y === 0) p.vy = 0;
    }
    const grounded = p.y === 0 || p.standing !== null;
    p.blocking = Boolean(input.block && grounded && !p.attack && p.stun === 0);
    p.crouching = Boolean(
      input.crouch && grounded && !p.attack && p.stun === 0,
    );
    if (p.slip > 0) p.x += p.facing * 240 * dt;
    if (p.stun === 0 && !p.attack) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (!p.blocking && dir) {
        const oldX = p.x;
        p.x +=
          dir *
          (145 + p.fighter.speed * 19) *
          (p.jacketLost ? 1.18 : 1) *
          (p.crouching ? 0.36 : 1) *
          dt;
        p.moving = true;
        if (input.aim === undefined) p.facing = dir;
        for (const o of this.world.objects) {
          if (
            !o.platform ||
            o.disabled ||
            o.kind === "starship" ||
            o.kind === "train"
          )
            continue;
          if (
            p.y < o.y + o.h - 2 &&
            p.y + 140 > o.y &&
            Math.abs(p.x - o.x) < o.w / 2 + 21 &&
            Math.abs(oldX - o.x) >= o.w / 2 + 20
          )
            p.x = o.x - Math.sign(o.x - oldX) * (o.w / 2 + 21);
        }
      }
      if (input.jump && !p.jumpHeld && !p.blocking) {
        if (this.world.has("projectileJump")) {
          for (const s of this.projectiles.filter((s) => s.owner === index))
            s.vy = -410;
          this.world.notice("발사체 점프 · 새 정의 적용", index);
        } else if (grounded) {
          p.vy = 575;
          p.y += 0.1;
          this.emit("jump");
        }
      }
      if (input.interact && !p.interactHeld)
        this.world.interact(index, Boolean(input.crouch));
      if (p.cooldown === 0 && !p.blocking) {
        if (input.special && p.meter >= 100)
          this.useSkill(index, "special", input);
        else if (input.skill2 && p.skillCooldowns.skill2 === 0)
          this.useSkill(index, "skill2", input);
        else if (input.skill1 && p.skillCooldowns.skill1 === 0)
          this.useSkill(index, "skill1", input);
        else if (input.kick) this.startAttack(p, "kick", index);
        else if (input.punch) this.startAttack(p, "punch", index);
      }
    }
    p.jumpHeld = Boolean(input.jump);
    p.interactHeld = Boolean(input.interact);
    if (p.attack) {
      p.attack.time += dt;
      if (p.attack.type === "dash" && p.attack.time < 0.35) {
        p.x += p.attack.facing * 680 * dt;
        p.trail = 0.25;
      }
      if (p.attack.time >= p.attack.duration) {
        if (!p.attack.hit && !["cast", "special"].includes(p.attack.type))
          p.stats.misses++;
        p.attack = null;
      }
    }
    for (const s of p.specialQueue) s.delay -= dt;
    const ready = p.specialQueue.filter((s) => s.delay <= 0);
    p.specialQueue = p.specialQueue.filter((s) => s.delay > 0);
    for (const s of ready)
      this.makeBullet(index, {
        type: s.type,
        damage: s.damage,
        direction: s.facing,
      });
    if (this.world.has("wrap")) {
      if (p.x < 28) p.x = 932;
      if (p.x > 932) p.x = 28;
    } else p.x = clamp(p.x, 45, 915);
  }
  useSkill(owner, slot, input = {}) {
    const p = this.players[owner],
      eventCount = this.events.length;
    if (!this.world.cast(owner, slot, input)) {
      p.cooldown = 0.4;
      return false;
    }
    if (slot === "special") {
      p.meter = 0;
      this.emit("special", { player: owner, fighter: p.fighter.id });
    } else {
      p.skillCooldowns[slot] = slot === "skill1" ? 4.5 : 7;
      this.emit("skill", { player: owner, slot });
      p.meter = Math.min(100, p.meter + 5);
    }
    if (!p.attack)
      p.attack = {
        type: slot === "special" ? "special" : "cast",
        time: 0,
        duration: 0.35,
        hit: true,
        facing: p.facing,
      };
    p.cooldown = 0.65;
    if (!this.events.slice(eventCount).some((e) => e.type === "notice"))
      this.world.notice(
        `${p.fighter.name} · ${slot === "special" ? p.fighter.special : p.fighter.skills[slot === "skill1" ? 0 : 1][0]}`,
        owner,
      );
    p.stats.skills++;
    return true;
  }
  startAttack(p, type, owner) {
    p.attack = {
      type,
      time: 0,
      hit: false,
      duration: type === "kick" ? 0.42 : 0.3,
      facing: p.facing,
    };
    p.cooldown = type === "kick" ? 0.59 : 0.39;
    p.crouching = false;
    this.emit(type, { player: owner });
    this.world.record("melee", owner, {
      x: p.x,
      y: p.y,
      facing: p.facing,
      reach: (type === "kick" ? 106 : 81) + p.fighter.reach * 3,
      damage: (type === "kick" ? 10 : 6) + p.fighter.power,
    });
  }
  separatePlayers() {
    const [a, b] = this.players,
      d = Math.abs(a.x - b.x);
    if (d < 62 && Math.abs(a.y - b.y) < 85) {
      const dir = a.x <= b.x ? -1 : 1,
        push = (62 - d) / 2;
      a.x = clamp(a.x + dir * push, 28, 932);
      b.x = clamp(b.x - dir * push, 28, 932);
    }
  }
  resolveAttack(p, target, owner) {
    const a = p.attack;
    if (
      !a ||
      ["cast", "special"].includes(a.type) ||
      a.time < 0.09 ||
      a.time > 0.28
    )
      return;
    this.world.strikeObjects(p, a, owner);
    if (a.hit) return;
    const reach =
        a.type === "dash"
          ? 145
          : (a.type === "kick" ? 106 : 81) + p.fighter.reach * 3,
      box = this.world.hurtbox(target),
      d = (box.x - p.x) * a.facing;
    if (d > 0 && d < reach && Math.abs(p.y - box.y) < 95) {
      a.hit = true;
      this.hit(
        target,
        p,
        a.type === "dash" ? 18 : (a.type === "kick" ? 10 : 6) + p.fighter.power,
        owner,
        a.facing,
        a.type === "dash",
      );
    }
  }
  makeBullet(owner, extra = {}) {
    const p = this.players[owner],
      type = extra.type || p.fighter.projectile;
    const s = {
      owner,
      x: p.x + p.facing * 45,
      y: FLOOR - p.y - 85,
      direction: p.facing,
      velocity: type === "rocket" ? 355 : p.fighter.velocity,
      damage: 12,
      type,
      color: p.fighter.color,
      radius: type === "rocket" ? 23 : type === "question" ? 25 : 16,
      life: 3.6,
      vy: 0,
      bounces: 0,
      ...extra,
    };
    s.owner = owner;
    delete s.record;
    this.projectiles.push(s);
    if (extra.record !== false)
      this.world.record("projectile", owner, { ...s });
    return s;
  }
  spawnProjectile(p, owner, facing) {
    return this.makeBullet(owner, {
      direction: facing,
      type: p.fighter.projectile,
      damage: p.fighter.damage,
    });
  }
  updateProjectiles(dt) {
    for (const s of this.projectiles) {
      if (s.life <= 0) continue;
      s.x += s.direction * s.velocity * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (this.world.has("gravity")) s.vy += 220 * dt;
      if (s.y > 414 && this.world.has("gravity")) {
        s.y = 410;
        s.vy = -Math.abs(s.vy) * 0.55;
      }
      if (s.x < 15 || s.x > 945) {
        if (this.world.has("wallMemory")) {
          this.world.add("wallShot", s.owner, s.x < 15 ? 18 : 942, {
            y: Math.max(0, FLOOR - s.y),
            w: 20,
            h: 24,
            hp: Infinity,
            life: 8,
            payload: { ...s },
          });
          s.life = 0;
        } else if (this.world.has("bounce") && s.bounces < 2) {
          s.direction *= -1;
          s.x = clamp(s.x, 16, 944);
          s.bounces++;
          s.hostileAll = true;
        }
      }
      for (const [i, t] of this.players.entries()) {
        if (i === s.owner && !s.hostileAll) continue;
        const box = this.world.hurtbox(t),
          top = FLOOR - box.y - (t.crouching ? 84 : 153);
        if (
          s.life > 0 &&
          Math.abs(s.x - box.x) < 32 + s.radius &&
          s.y > top - s.radius &&
          s.y < FLOOR - box.y + s.radius
        ) {
          s.life = 0;
          this.hit(
            t,
            this.players[s.owner],
            s.damage,
            s.owner,
            s.direction,
            true,
          );
          if (i === s.owner) this.world.discover("self-echo");
        }
      }
      if (s.life > 0)
        for (const o of this.world.objects) {
          if (
            o.owner === s.owner ||
            ![
              "candle",
              "chip",
              "crystal",
              "program",
              "pad",
              "lamp",
              "question",
            ].includes(o.kind) ||
            o.disabled
          )
            continue;
          if (
            Math.abs(s.x - o.x) < o.w / 2 + s.radius &&
            s.y >= FLOOR - o.y - o.h - s.radius &&
            s.y <= FLOOR - o.y + s.radius
          ) {
            o.hp -= s.damage;
            this.world.moveObject(o, s.direction * 12);
            s.life = 0;
            if (o.hp <= 0) this.world.destroy(o, s.owner);
            break;
          }
        }
    }
    this.projectiles = this.projectiles
      .filter(
        (p) => p.life > 0 && p.x > -70 && p.x < 1030 && p.y > -100 && p.y < 560,
      )
      .slice(-50);
  }
  hit(target, attacker, damage, owner, direction, special = false) {
    const index = this.players.indexOf(target),
      blocked = target.blocking && target.facing === -direction,
      actual = blocked ? Math.ceil(damage * 0.18) : damage,
      absorbed = Math.min(target.shield, actual);
    target.shield -= absorbed;
    target.stats.absorbed += absorbed;
    target.health = Math.max(0, target.health - (actual - absorbed));
    target.stun = blocked ? 0.07 : special ? 0.29 : 0.16;
    if (!blocked) target.attack = null;
    target.x = clamp(
      target.x + direction * (blocked ? 5 : special ? 26 : 12),
      28,
      932,
    );
    target.meter = Math.min(100, target.meter + actual * 1.1);
    target.capital = Math.min(150, target.capital + (blocked ? 4 : 0));
    if (index !== owner) {
      attacker.meter = Math.min(
        100,
        attacker.meter + (special ? 2 : actual * 1.5),
      );
      attacker.stats.damage += actual - absorbed;
      attacker.stats.hits++;
      if (target.cooldown > 0.1) attacker.stats.counters++;
    }
    if (blocked) target.stats.blocked += damage - actual;
    this.shake = blocked ? 2 : special ? 7 : 4;
    const color = blocked ? "#eff6df" : attacker.fighter.color;
    for (let i = 0; i < (special ? 14 : 8); i++)
      this.particles.push({
        x: target.x - direction * 20,
        y: FLOOR - target.y - 90,
        vx: (this.random() - 0.5) * 390,
        vy: (this.random() - 0.65) * 320,
        life: 0.2 + this.random() * 0.3,
        color,
        size: 3 + Math.floor(this.random() * 5),
      });
    this.particles = this.particles.slice(-140);
    this.emit(blocked ? "block" : "hit", {
      player: owner,
      damage: actual,
      special,
    });
    this.world.afterHit(target, index, actual, blocked);
    if (blocked && target.fighter.id === "socrates")
      target.meter = Math.min(100, target.meter + 7);
  }
  cpuInput(dt) {
    this.aiTimer -= dt;
    if (this.aiTimer > 0) return this.aiInput;
    const [t, p] = this.players,
      tune = {
        easy: { reaction: 0.42, offense: 0.42, defense: 0.13 },
        normal: { reaction: 0.22, offense: 0.7, defense: 0.35 },
        hard: { reaction: 0.1, offense: 0.92, defense: 0.62 },
      }[this.difficulty] || { reaction: 0.22, offense: 0.7, defense: 0.35 };
    this.aiTimer = tune.reaction;
    const box = this.world.hurtbox(t),
      d = Math.abs(p.x - box.x),
      input = {};
    let goal = box.x;
    const item = this.world.objects.find(
      (o) =>
        o.life > 0 &&
        ((o.kind === "booster" &&
          p.fighter.id === "musk" &&
          p.boosters === 0) ||
          (o.kind === "bag" &&
            o.owner === 1 &&
            !o.held &&
            !this.world.bagAvailable(1))),
    );
    const objective = this.world.objects.find(
      (o) =>
        o.owner === 0 &&
        o.life > 0 &&
        (o.switchRule || o.original) &&
        Math.abs(o.x - p.x) < 350,
    );
    if (item) goal = item.x;
    else if (objective && d > 150) goal = objective.x;
    if (item || (objective && d > 150)) input.aim = goal;
    const threat =
      (t.attack && d < 145) ||
      this.projectiles.some((s) => s.owner === 0 && Math.abs(s.x - p.x) < 210);
    if (threat && this.random() < tune.defense) input.block = true;
    else {
      if (Math.abs(p.x - goal) > 78)
        input[p.x > goal ? "left" : "right"] = true;
      if (item && Math.abs(p.x - item.x) < 82) input.interact = !p.interactHeld;
      if (
        Math.min(d, objective ? Math.abs(p.x - objective.x) : Infinity) < 126 &&
        this.random() < tune.offense
      )
        input[this.random() < 0.55 ? "punch" : "kick"] = true;
      if (
        d < 600 &&
        p.skillCooldowns.skill1 === 0 &&
        this.random() < tune.offense * 0.3
      )
        input.skill1 = true;
      if (p.skillCooldowns.skill2 === 0 && this.random() < tune.offense * 0.15)
        input.skill2 = true;
      if (d < 600 && p.meter >= 100 && this.random() < tune.offense * 0.17)
        input.special = true;
      if (
        this.world.objects.some(
          (o) => o.platform && Math.abs(o.x - p.x) < 95 && o.y + o.h > p.y + 4,
        ) ||
        this.random() < 0.045
      )
        input.jump = !p.jumpHeld;
      if (
        p.fighter.id === "musk" &&
        this.world.objects.some((o) => o.kind === "pad" && o.owner === 1) &&
        this.random() < 0.3
      )
        input.interact = !p.interactHeld;
      if (
        this.world.objects.some(
          (o) =>
            ["proof", "auction"].includes(o.kind) && Math.abs(o.x - p.x) < 75,
        ) &&
        this.random() < 0.4
      )
        input.interact = !p.interactHeld;
    }
    this.aiInput = input;
    return input;
  }
  endRound() {
    const [a, b] = this.players;
    this.roundWinner =
      a.health === b.health ? null : a.health > b.health ? 0 : 1;
    if (this.roundWinner !== null) this.players[this.roundWinner].wins++;
    this.phase = "roundEnd";
    this.phaseTime = 2.4;
    this.projectiles = [];
    this.world.echoes = [];
    this.players.forEach((p) => {
      p.attack = null;
      p.specialQueue = [];
      p.moving = false;
    });
    this.emit("roundEnd", {
      winner: this.roundWinner,
      knockout: this.players.some((p) => p.health <= 0),
    });
  }
}
