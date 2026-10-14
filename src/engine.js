import { fighterById } from './roster.js';

export const WIDTH = 960;
export const FLOOR = 410;
const ROUND_SECONDS = 60;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const EMPTY_INPUT = Object.freeze({});

function makePlayer(id, x, facing) {
  return { fighter: fighterById(id), x, y: 0, vy: 0, facing, health: 100, meter: 100, wins: 0, attack: null, cooldown: 0, stun: 0, blocking: false, crouching: false, moving: false, specialQueue: [], jumpHeld: false, trail: 0 };
}

export class Battle {
  constructor({ player = 'huang', opponent = 'musk', mode = 'cpu', difficulty = 'normal', random = Math.random } = {}) {
    this.players = [makePlayer(player, 260, 1), makePlayer(opponent, 700, -1)];
    this.mode = mode;
    this.difficulty = difficulty;
    this.random = random;
    this.phase = 'intro';
    this.phaseTime = 2.3;
    this.round = 1;
    this.time = ROUND_SECONDS;
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
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { const events = this.events; this.events = []; return events; }
  pause(value = !this.paused) { if (this.phase !== 'finished') this.paused = value; }

  resetRound() {
    this.players = this.players.map((p, i) => ({ ...makePlayer(p.fighter.id, i ? 700 : 260, i ? -1 : 1), wins: p.wins }));
    this.time = ROUND_SECONDS;
    this.projectiles = [];
    this.roundWinner = null;
    this.phase = 'intro';
    this.phaseTime = 2.3;
    this.aiInput = {};
    this.aiTimer = 0;
  }

  update(dt, inputs = [EMPTY_INPUT, EMPTY_INPUT]) {
    if (this.paused || this.phase === 'finished') return;
    dt = clamp(dt, 0, 0.05);
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 28);
    this.particles = this.particles.filter(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 210 * dt; return p.life > 0; });
    if (this.phase !== 'fight') {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        if (this.phase === 'intro') { this.phase = 'fight'; this.emit('fight'); }
        else if (this.players.some(p => p.wins >= 2)) {
          this.phase = 'finished';
          this.winner = this.players[0].wins >= 2 ? 0 : 1;
          this.emit('matchEnd', { winner: this.winner });
        } else { this.round += 1; this.resetRound(); this.emit('roundStart', { round: this.round }); }
      }
      return;
    }

    this.time = Math.max(0, this.time - dt);
    const controls = [inputs[0] || EMPTY_INPUT, this.mode === 'cpu' ? this.cpuInput(dt) : inputs[1] || EMPTY_INPUT];
    this.players.forEach((p, i) => this.updatePlayer(p, this.players[1 - i], controls[i], dt, i));
    this.separatePlayers();
    this.players.forEach((p, i) => this.resolveAttack(p, this.players[1 - i], i));
    this.updateProjectiles(dt);
    if (this.players.some(p => p.health <= 0) || this.time <= 0) this.endRound();
  }

  updatePlayer(p, enemy, input, dt, index) {
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.trail = Math.max(0, p.trail - dt);
    p.meter = Math.min(100, p.meter + dt * 3.8);
    p.facing = enemy.x >= p.x ? 1 : -1;
    p.moving = false;
    if (p.y > 0 || p.vy > 0) { p.y = Math.max(0, p.y + p.vy * dt); p.vy -= 1300 * dt; if (p.y <= 0) p.vy = 0; }
    p.blocking = Boolean(input.block && p.y === 0 && !p.attack && p.stun === 0);
    p.crouching = Boolean(input.crouch && p.y === 0 && !p.attack && p.stun === 0);
    if (p.stun === 0 && !p.attack) {
      const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (!p.blocking && direction) {
        p.x += direction * (145 + p.fighter.speed * 19) * (p.crouching ? 0.36 : 1) * dt;
        p.moving = true;
      }
      if (input.jump && !p.jumpHeld && p.y === 0 && !p.blocking) { p.vy = 575; p.y = 0.1; this.emit('jump'); }
      if (p.cooldown === 0 && !p.blocking) {
        if (input.special && p.meter >= 100) this.startAttack(p, 'special', index);
        else if (input.kick) this.startAttack(p, 'kick', index);
        else if (input.punch) this.startAttack(p, 'punch', index);
      }
    }
    p.jumpHeld = Boolean(input.jump);
    if (p.attack) {
      p.attack.time += dt;
      if (p.attack.type === 'special' && p.fighter.projectile === 'dash') {
        if (p.attack.time < 0.4) { p.x += p.attack.facing * 720 * dt; p.trail = 0.25; }
      }
      if (p.attack.time >= p.attack.duration) p.attack = null;
    }
    for (const shot of p.specialQueue) shot.delay -= dt;
    const ready = p.specialQueue.filter(s => s.delay <= 0);
    p.specialQueue = p.specialQueue.filter(s => s.delay > 0);
    for (const shot of ready) this.spawnProjectile(p, index, shot.facing);
    p.x = clamp(p.x, 55, WIDTH - 55);
  }

  startAttack(p, type, index) {
    const special = type === 'special';
    p.attack = { type, time: 0, hit: false, duration: special ? 0.62 : type === 'kick' ? 0.42 : 0.3, facing: p.facing };
    p.cooldown = special ? 0.95 : type === 'kick' ? 0.59 : 0.39;
    p.crouching = false;
    this.emit(type, { player: index, fighter: p.fighter.id });
    if (special) {
      p.meter = 0;
      if (p.fighter.projectile !== 'dash') {
        const count = p.fighter.projectile === 'chip' ? 3 : p.fighter.projectile === 'crystal' ? 2 : 1;
        for (let i = 0; i < count; i++) p.specialQueue.push({ delay: 0.13 + i * 0.15, facing: p.facing });
      }
    }
  }

  separatePlayers() {
    const [a, b] = this.players;
    const distance = Math.abs(a.x - b.x);
    if (distance < 62 && Math.abs(a.y - b.y) < 85) {
      const direction = a.x <= b.x ? -1 : 1;
      const push = (62 - distance) / 2;
      a.x = clamp(a.x + direction * push, 55, WIDTH - 55);
      b.x = clamp(b.x - direction * push, 55, WIDTH - 55);
    }
  }

  resolveAttack(p, target, owner) {
    const a = p.attack;
    if (!a || a.hit || a.time < 0.09 || a.time > (a.type === 'special' ? 0.45 : 0.25)) return;
    if (a.type === 'special' && p.fighter.projectile !== 'dash') return;
    const reach = a.type === 'special' ? 115 : (a.type === 'kick' ? 106 : 81) + p.fighter.reach * 3;
    const distance = (target.x - p.x) * a.facing;
    if (distance > 0 && distance < reach && Math.abs(p.y - target.y) < 95) {
      const damage = a.type === 'special' ? p.fighter.damage : (a.type === 'kick' ? 10 : 6) + p.fighter.power;
      a.hit = true;
      this.hit(target, p, damage, owner, a.facing, a.type === 'special');
    }
  }

  spawnProjectile(p, owner, facing) {
    this.projectiles.push({ owner, x: p.x + facing * 45, y: FLOOR - p.y - 85, direction: facing, velocity: p.fighter.velocity, damage: p.fighter.damage, type: p.fighter.projectile, color: p.fighter.color, radius: p.fighter.projectile === 'rocket' ? 23 : p.fighter.projectile === 'question' ? 32 : 17, life: 3 });
  }

  updateProjectiles(dt) {
    for (const shot of this.projectiles) {
      shot.x += shot.direction * shot.velocity * dt;
      shot.life -= dt;
      const target = this.players[1 - shot.owner];
      const bodyTop = FLOOR - target.y - (target.crouching ? 84 : 153);
      if (Math.abs(shot.x - target.x) < 32 + shot.radius && shot.y > bodyTop - shot.radius && shot.y < FLOOR - target.y + shot.radius) {
        shot.life = 0;
        this.hit(target, this.players[shot.owner], shot.damage, shot.owner, shot.direction, true);
      }
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0 && p.x > -60 && p.x < WIDTH + 60);
  }

  hit(target, attacker, damage, owner, direction, special = false) {
    const blocked = target.blocking && target.facing === -direction;
    const actual = blocked ? Math.ceil(damage * 0.18) : damage;
    target.health = Math.max(0, target.health - actual);
    target.stun = blocked ? 0.07 : special ? 0.29 : 0.16;
    if (!blocked) target.attack = null;
    target.x = clamp(target.x + direction * (blocked ? 5 : special ? 32 : 14), 55, WIDTH - 55);
    target.meter = Math.min(100, target.meter + actual * 1.1);
    attacker.meter = Math.min(100, attacker.meter + (special ? 2 : actual * 1.5));
    this.shake = blocked ? 2 : special ? 9 : 4;
    const color = blocked ? '#eff6df' : attacker.fighter.color;
    for (let i = 0; i < (special ? 16 : 9); i++) this.particles.push({ x: target.x - direction * 20, y: FLOOR - target.y - 90, vx: (this.random() - 0.5) * 390, vy: (this.random() - 0.65) * 320, life: 0.2 + this.random() * 0.3, color, size: 3 + Math.floor(this.random() * 5) });
    this.emit(blocked ? 'block' : 'hit', { player: owner, damage: actual, special });
  }

  cpuInput(dt) {
    this.aiTimer -= dt;
    if (this.aiTimer > 0) return this.aiInput;
    const [target, cpu] = this.players;
    const tune = { easy: { reaction: 0.42, offense: 0.42, defense: 0.13 }, normal: { reaction: 0.22, offense: 0.7, defense: 0.35 }, hard: { reaction: 0.1, offense: 0.92, defense: 0.62 } }[this.difficulty] || { reaction: 0.22, offense: 0.7, defense: 0.35 };
    this.aiTimer = tune.reaction;
    const distance = Math.abs(cpu.x - target.x);
    const input = {};
    const threat = (target.attack && distance < 145) || this.projectiles.some(p => p.owner === 0 && Math.abs(p.x - cpu.x) < 230);
    if (threat && this.random() < tune.defense) input.block = true;
    else {
      if (distance > 87) input[cpu.x > target.x ? 'left' : 'right'] = true;
      if (distance < 116 && this.random() < tune.offense) input[this.random() < 0.55 ? 'punch' : 'kick'] = true;
      if (distance < 570 && cpu.meter >= 100 && this.random() < tune.offense * 0.35 && (cpu.fighter.projectile !== 'dash' || distance < 300)) input.special = true;
      if (this.random() < 0.055 && !input.block) input.jump = true;
    }
    this.aiInput = input;
    return input;
  }

  endRound() {
    const [a, b] = this.players;
    this.roundWinner = a.health === b.health ? null : a.health > b.health ? 0 : 1;
    if (this.roundWinner !== null) this.players[this.roundWinner].wins += 1;
    this.phase = 'roundEnd';
    this.phaseTime = 2.4;
    this.projectiles = [];
    this.players.forEach(p => { p.attack = null; p.specialQueue = []; p.moving = false; });
    this.emit('roundEnd', { winner: this.roundWinner, knockout: this.players.some(p => p.health <= 0) });
  }
}
