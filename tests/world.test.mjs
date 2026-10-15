import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/engine.js";
import { FIGHTERS } from "../src/roster.js";

test("nested and cyclic idea links move each asset once", () => {
  const b = active("plato", "plato");
  const a = b.world.add("lamp", 0, 300, { original: true }),
    c = b.world.add("crystal", 0, 400, { source: a.id }),
    d = b.world.add("chip", 1, 500, { source: c.id });
  a.source = d.id;
  b.world.moveObject(a, 20);
  assert.deepEqual([a.x, c.x, d.x], [320, 420, 520]);
});

test("NVDA terrain requires actual purchase capital", () => {
  const b = active();
  b.players[0].capital = 0;
  assert.equal(b.useSkill(0, "skill1"), false);
  assert.equal(
    b.world.objects.some((o) => o.kind === "candle"),
    false,
  );
});
test("sell modifier trades TSLA near an enemy pad instead of acquiring it", () => {
  const b = active("huang", "musk");
  b.useSkill(1, "skill1");
  const pad = b.world.objects.find((o) => o.kind === "pad");
  b.players[0].x = pad.x;
  const price = b.world.market.TSLA;
  b.world.interact(0, true);
  assert.equal(b.world.market.TSLA, price - 6);
  assert.equal(pad.stakes[0], 0);
});
function tick(b, t, inputs = [{}, {}]) {
  for (let i = 0; i < Math.ceil(t * 60); i++) b.update(1 / 60, inputs);
}
function active(player = "huang", opponent = "musk") {
  const b = new Battle({ player, opponent, mode: "local", random: () => 0.5 });
  tick(b, 2.4);
  return b;
}

test("jacket absorbs damage, breaks once, drops an interactive object and changes movement", () => {
  const b = active(),
    p = b.players[0],
    enemy = b.players[1];
  b.hit(p, enemy, 12, 1, -1);
  assert.equal(p.health, 100);
  assert.equal(p.shield, 10);
  b.hit(p, enemy, 15, 1, -1);
  assert.equal(p.health, 95);
  assert.equal(p.shield, 0);
  assert.ok(p.jacketLost);
  assert.equal(b.world.objects.filter((o) => o.kind === "jacket").length, 1);
  b.hit(p, enemy, 1, 1, -1);
  assert.equal(b.world.objects.filter((o) => o.kind === "jacket").length, 1);
  p.x = 500;
  p.stun = 0;
  const x = p.x;
  tick(b, 0.3, [{ right: true }, {}]);
  assert.ok(p.x - x > 80, "shirt movement is faster");
});
test("both players can slip on a dropped jacket", () => {
  const b = active();
  b.world.add("jacket", 0, 700, { hp: Infinity, life: 5, w: 48, h: 9 });
  b.players[1].moving = true;
  b.world.update(0.016);
  assert.ok(b.players[1].slip > 0);
  assert.ok(b.world.discoveries.has("jacket-slip"));
});
test("NVDA trading creates solid candles, selling lowers them, split makes usable chips", () => {
  const b = active();
  b.useSkill(0, "skill1");
  const c = b.world.objects.find((o) => o.kind === "candle");
  assert.ok(c?.platform);
  assert.ok(b.world.market.NVDA > 108);
  const old = c.h;
  tick(b, 0.7);
  b.useSkill(0, "skill1", { crouch: true });
  assert.ok(c.h < old);
  tick(b, 0.7);
  b.useSkill(0, "special");
  assert.equal(b.players[0].meter, 0);
  assert.equal(b.world.objects.filter((o) => o.kind === "chip").length, 4);
  const chip = b.world.objects.find((o) => o.kind === "chip");
  b.players[1].x = chip.x;
  b.players[1].y = chip.y + chip.h + 2;
  b.players[1].vy = -100;
  tick(b, 0.05);
  assert.equal(b.players[1].standing, chip.id);
});
test("GPU program is editable by enemy attacks and runs under patched physics", () => {
  const b = active();
  b.useSkill(0, "skill2");
  const o = b.world.objects.find((o) => o.kind === "program"),
    old = o.direction;
  const p = b.players[1];
  p.x = o.x + 60;
  p.y = 0;
  b.world.strikeObjects(p, { type: "kick", facing: -1, time: 0.12 }, 1);
  assert.equal(o.direction, -old);
  b.world.rule("gravity", 1, 5, 0);
  tick(b, 1.4);
  assert.ok(b.world.discoveries.has("parallel-patch"));
  assert.ok(b.projectiles.some((s) => s.type === "chip"));
});
test("TSLA buy and sell alter a reserved launch, and the pad eventually fires", () => {
  const b = active("musk", "huang");
  b.useSkill(0, "skill1");
  const pad = b.world.objects.find((o) => o.kind === "pad");
  assert.equal(b.players[0].boosters, 1);
  b.players[1].x = 900;
  b.world.interact(1, true);
  assert.ok(
    b.world.market.TSLA < 240,
    "opponent sells TSLA when a launch exists",
  );
  tick(b, 0.8);
  assert.ok(b.world.objects.includes(pad));
  b.world.trade(1, false, "TSLA");
  b.world.trade(1, false, "TSLA");
  b.world.trade(1, false, "TSLA");
  tick(b, 0.02);
  assert.equal(pad.life, 0);
  assert.ok(b.projectiles.some((s) => s.type === "rocket"));
});
test("empty boosters block a rocket skill without spending ultimate meter; recoverable by R", () => {
  const b = active("musk");
  b.players[0].boosters = 0;
  assert.equal(b.useSkill(0, "special"), false);
  assert.equal(b.players[0].meter, 100);
  const item = b.world.add("booster", 0, b.players[0].x, {
    hp: Infinity,
    life: Infinity,
  });
  b.world.interact(0);
  assert.equal(b.players[0].boosters, 1);
  assert.equal(item.life, 0);
  assert.ok(b.useSkill(0, "special"));
});
test("starship carries a standing opponent and records the discovery", () => {
  const b = active("musk");
  b.useSkill(0, "special");
  const ship = b.world.objects.find((o) => o.kind === "starship"),
    p = b.players[1];
  p.x = ship.x;
  p.y = ship.y + ship.h;
  const old = p.x;
  b.world.update(0.1);
  assert.ok(p.x > old);
  assert.ok(b.world.discoveries.has("rocket-rider"));
});
test("Socrates leaves questions on strong hits and a question switch cancels a definition", () => {
  const b = active("socrates");
  b.hit(b.players[0], b.players[1], 15, 1, -1);
  assert.ok(b.world.objects.some((o) => o.kind === "question"));
  b.players[0].stun = 0;
  b.useSkill(0, "special");
  tick(b, 0.8);
  assert.ok(b.world.has("projectileJump"));
  const q = b.world.objects.find((o) => o.switchRule);
  b.world.destroy(q, 1);
  assert.equal(b.world.has("projectileJump"), false);
  assert.ok(b.world.discoveries.has("question-switch"));
});
test("jump definition changes projectile trajectory instead of the character", () => {
  const b = active("socrates");
  b.world.rule("projectileJump", 0, 5, 0);
  const shot = b.makeBullet(0, { type: "question", velocity: 20 });
  const y = shot.y;
  tick(b, 0.05, [{ jump: true }, {}]);
  assert.equal(b.players[0].y, 0);
  assert.ok(shot.y < y);
  assert.ok(shot.vy < 0);
});
test("wall definition stores an attack that a wall punch can release", () => {
  const b = active("socrates");
  b.world.rule("wallMemory", 0, 5, 0);
  b.makeBullet(0, { x: 943, y: 320, velocity: 300 });
  tick(b, 0.05);
  const saved = b.world.objects.find((o) => o.kind === "wallShot");
  assert.ok(saved);
  b.players[1].x = 900;
  b.world.strikeObjects(
    b.players[1],
    { type: "punch", facing: 1, time: 0.12 },
    1,
  );
  assert.equal(saved.life, 0);
  assert.ok(b.projectiles.some((s) => s.owner === 1 && s.direction === -1));
});
test("premise extraction exposes the launch target as a manipulable object", () => {
  const b = active("socrates", "musk");
  b.useSkill(1, "skill1");
  b.useSkill(0, "skill2");
  const proof = b.world.objects.find((o) => o.kind === "proof"),
    pad = b.world.objects.find((o) => o.kind === "pad");
  const old = pad.target;
  b.players[0].x = proof.x;
  b.world.interact(0);
  assert.equal(pad.target, old - 6);
  assert.equal(proof.life, 0);
});
test("Plato copies move with their original and lose solidity if it breaks", () => {
  const b = active("plato");
  b.useSkill(0, "skill2");
  const original = b.world.objects.find((o) => o.original),
    copy = b.world.objects.find((o) => o.source === original.id);
  const gap = copy.x - original.x;
  b.world.moveObject(original, 15);
  assert.equal(copy.x - original.x, gap);
  b.world.destroy(original, 1);
  assert.ok(copy.disabled);
  assert.equal(b.world.platformAt({ x: copy.x, y: 0 }, 200).standing, null);
});
test("cave mode uses projected shadows for real hit detection and rotation moves them", () => {
  const b = active("plato");
  b.useSkill(0, "special");
  tick(b, 0.8);
  const p = b.players[1];
  p.x = 650;
  p.health = 100;
  b.projectiles = [];
  b.makeBullet(0, { x: 650, y: 325, velocity: 0 });
  tick(b, 0.02);
  assert.equal(p.health, 100, "body is no longer the hurtbox");
  const box = b.world.hurtbox(p);
  b.makeBullet(0, { x: box.x, y: 325, velocity: 0 });
  tick(b, 0.02);
  assert.ok(p.health < 100);
  const lamp = b.world.objects.find((o) => o.kind === "lamp");
  b.players[0].x = lamp.x;
  const old = b.world.hurtbox(p).x;
  b.world.interact(0);
  assert.notEqual(b.world.hurtbox(p).x, old);
});
test("definition can make shadows into actual shared platforms", () => {
  const b = active("socrates", "plato");
  b.world.rule("solidShadows", 0, 5, 0);
  tick(b, 0.05);
  assert.equal(b.world.objects.filter((o) => o.kind === "shadow").length, 2);
  assert.ok(
    b.world.objects.filter((o) => o.kind === "shadow").every((o) => o.platform),
  );
  assert.ok(b.world.discoveries.has("solid-shadow"));
});
test("Nietzsche history is replayed as attacks that can hurt its own author", () => {
  const b = active("nietzsche");
  b.world.record("melee", 0, {
    x: 300,
    y: 0,
    facing: 1,
    reach: 100,
    damage: 12,
  });
  b.players[0].x = 350;
  b.useSkill(0, "skill2");
  tick(b, 1.1);
  assert.ok(b.players[0].health < 100);
  assert.ok(b.world.discoveries.has("self-echo"));
});
test("torn coat focuses recurrence on the last attack without restoring health", () => {
  const b = active("nietzsche");
  b.hit(b.players[0], b.players[1], 55, 1, -1);
  assert.ok(b.players[0].coatTorn);
  const hp = b.players[0].health;
  b.world.record("melee", 1, {
    x: 500,
    y: 0,
    facing: -1,
    reach: 100,
    damage: 10,
  });
  b.world.recur(0);
  assert.equal(b.world.echoes.length, 3);
  assert.ok(b.world.echoes.every((e) => e.entry.owner === 1));
  assert.equal(b.players[0].health, hp);
});
test("amor fati blocks selling and voluntary destruction but enemy counterplay remains", () => {
  const b = active("nietzsche", "huang");
  b.world.rule("vow", 0, 5, 0);
  assert.equal(b.world.trade(1, true, "NVDA"), false);
  const c = b.world.add("candle", 1, 500);
  b.players[1].x = 560;
  b.world.strikeObjects(
    b.players[1],
    { type: "kick", facing: -1, time: 0.12 },
    1,
  );
  assert.equal(c.hp, 24);
  b.players[0].x = 440;
  b.world.strikeObjects(
    b.players[0],
    { type: "kick", facing: 1, time: 0.12 },
    0,
  );
  assert.equal(c.hp, 8);
});
test("Berkshire takes control at majority ownership and can be bought back", () => {
  const b = active("buffett", "musk");
  b.useSkill(1, "skill1");
  const pad = b.world.objects.find((o) => o.kind === "pad");
  b.world.buyAsset(0, pad);
  assert.equal(pad.owner, 1);
  b.world.buyAsset(0, pad);
  assert.equal(pad.owner, 0);
  assert.equal(b.players[0].stats.claims, 1);
  b.world.buyAsset(1, pad);
  assert.equal(pad.owner, 1);
});
test("briefcase can be dropped, pushed, recovered and gates facility orders", () => {
  const b = active("buffett");
  const bag = b.world.objects.find((o) => o.kind === "bag");
  b.world.interact(0);
  assert.equal(bag.held, false);
  b.players[0].x = 800;
  assert.equal(b.useSkill(0, "skill1"), false);
  b.players[0].x = bag.x;
  b.world.interact(0);
  assert.equal(bag.held, true);
  assert.ok(b.useSkill(0, "skill1"));
});
test("auction gives the projectile to the final bidder, preserving its usable lifetime", () => {
  const b = active("buffett", "musk");
  b.makeBullet(1, { type: "rocket", x: 480, y: 325, velocity: 200 });
  b.world.auction(0);
  const a = b.world.objects.find((o) => o.kind === "auction");
  b.players[1].x = a.x;
  b.world.interact(1);
  assert.equal(a.bidder, 1);
  b.players[1].x = 800;
  tick(b, 3.42);
  assert.ok(
    b.projectiles.some(
      (s) => s.owner === 1 && s.type === "rocket" && s.life > 3,
    ),
  );
});
test("train moves a portfolio and linked assets preserve their spacing", () => {
  const b = active("buffett", "plato");
  b.world.interact(0);
  const bag = b.world.objects.find((o) => o.kind === "bag");
  bag.x = 400;
  b.world.add("train", 0, 400, {
    vx: 100,
    w: 205,
    h: 30,
    life: 4,
    hp: Infinity,
  });
  const old = bag.x;
  b.world.update(0.1);
  assert.equal(bag.x, old + 10);
  assert.ok(b.world.discoveries.has("moving-portfolio"));
});
test("recurrence can reopen an auction as an ownership dispute", () => {
  const b = active("nietzsche", "buffett");
  b.world.auction(1);
  b.world.recur(0);
  tick(b, 1);
  assert.ok(b.world.discoveries.has("ownership-dispute"));
});
test("round reset restores equipment but preserves receipt statistics and discoveries", () => {
  const b = active();
  b.hit(b.players[0], b.players[1], 30, 1, -1);
  b.world.discover("jacket-slip");
  b.resetRound();
  assert.equal(b.players[0].shield, 22);
  assert.equal(b.players[0].jacketLost, false);
  assert.equal(b.players[0].stats.absorbed, 22);
  assert.ok(b.world.discoveries.has("jacket-slip"));
  assert.equal(b.world.objects.length, 0);
});
test("all roster matchups keep physics and object budgets valid under mixed commands", () => {
  for (const a of FIGHTERS)
    for (const c of FIGHTERS) {
      const b = active(a.id, c.id);
      let seed = 19;
      const rng = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      let input = [{}, {}];
      for (let frame = 0; frame < 750; frame++) {
        if (frame % 13 === 0)
          input = b.players.map(() => ({
            right: rng() > 0.5,
            left: rng() > 0.5,
            jump: rng() > 0.6,
            punch: rng() > 0.5,
            kick: rng() > 0.6,
            skill1: rng() > 0.5,
            skill2: rng() > 0.7,
            special: rng() > 0.8,
            interact: rng() > 0.65,
            crouch: rng() > 0.85,
          }));
        b.update(1 / 60, input);
        for (const p of b.players) {
          assert.ok(
            Number.isFinite(p.x) &&
              Number.isFinite(p.y) &&
              Number.isFinite(p.health),
            a.id + " / " + c.id,
          );
          assert.ok(p.health >= 0 && p.health <= 100);
          assert.ok(p.capital >= 0 && p.capital <= 150);
        }
        assert.ok(b.world.objects.length <= 30);
        assert.ok(b.projectiles.length <= 50);
        assert.ok(b.world.rules.length <= 3);
      }
    }
});
