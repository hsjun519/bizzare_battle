import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/engine.js";
import { FIGHTERS } from "../src/roster.js";

function tick(battle, seconds, inputs = [{}, {}]) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++)
    battle.update(1 / 60, inputs);
}
function active(options = {}) {
  const battle = new Battle({ mode: "local", random: () => 0.5, ...options });
  tick(battle, 2.4);
  assert.equal(battle.phase, "fight");
  return battle;
}

test("all six fighters have distinct, usable special moves", () => {
  assert.equal(new Set(FIGHTERS.map((f) => f.projectile)).size, 6);
  for (const fighter of FIGHTERS) {
    const battle = active({ player: fighter.id });
    battle.players[0].x = 300;
    battle.players[1].x = fighter.projectile === "dash" ? 470 : 560;
    tick(battle, 1.2, [{ special: true }, {}]);
    assert.ok(
      battle.players[1].health < 100,
      `${fighter.id} special should hit`,
    );
    assert.ok(
      battle.players[0].meter < 100,
      `${fighter.id} special should spend meter`,
    );
  }
});

test("punch and kick require range, apply once per strike, and respect cooldown", () => {
  const battle = active();
  tick(battle, 0.3, [{ punch: true }, {}]);
  assert.equal(battle.players[1].health, 100, "out of range");
  battle.players[0].x = 350;
  battle.players[1].x = 420;
  tick(battle, 0.3);
  tick(battle, 0.29, [{ punch: true }, {}]);
  assert.equal(battle.players[1].health, 91, "one Huang punch");
  tick(battle, 0.15, [{ punch: true }, {}]);
  assert.equal(
    battle.players[1].health,
    91,
    "second hit has not become active",
  );
});

test("facing a punch while blocking reduces damage", () => {
  const battle = active();
  battle.players[0].x = 350;
  battle.players[1].x = 420;
  tick(battle, 0.25, [{ punch: true }, { block: true }]);
  assert.equal(battle.players[1].health, 98);
  assert.ok(battle.drainEvents().some((e) => e.type === "block"));
});

test("jump can evade a projectile and returns to the ground", () => {
  const battle = active({ player: "musk" });
  battle.players[0].x = 300;
  battle.players[1].x = 500;
  battle.makeBullet(0, { type: "rocket", velocity: 355, damage: 19 });
  tick(battle, 0.4, [{}, { jump: true }]);
  assert.ok(battle.players[1].y > 80);
  tick(battle, 0.7);
  assert.equal(battle.players[1].health, 100, "rocket passed underneath");
  assert.equal(battle.players[1].y, 0);
});

test("paused match freezes clock, players, projectiles and intro countdown", () => {
  const battle = active();
  battle.pause(true);
  const time = battle.time,
    x = battle.players[0].x;
  tick(battle, 3, [{ right: true, special: true }, {}]);
  assert.equal(battle.time, time);
  assert.equal(battle.players[0].x, x);
  assert.equal(battle.projectiles.length, 0);
  battle.pause(false);
  tick(battle, 0.1, [{ right: true }, {}]);
  assert.ok(battle.time < time);
  assert.ok(battle.players[0].x > x);
  const intro = new Battle();
  intro.pause(true);
  tick(intro, 3);
  assert.equal(intro.phaseTime, 2.3);
});

test("timeout awards the healthier fighter, resets a round and ends at two wins", () => {
  const battle = active();
  battle.players[1].health = 80;
  battle.time = 0.01;
  tick(battle, 0.05);
  assert.equal(battle.phase, "roundEnd");
  assert.equal(battle.players[0].wins, 1);
  tick(battle, 2.5);
  assert.equal(battle.round, 2);
  assert.equal(battle.players[1].health, 100);
  assert.equal(battle.players[0].wins, 1);
  tick(battle, 2.4);
  battle.players[1].health = 0;
  tick(battle, 0.02);
  tick(battle, 2.5);
  assert.equal(battle.phase, "finished");
  assert.equal(battle.winner, 0);
  assert.equal(battle.players[0].wins, 2);
});

test("tied rounds award no wins and continue with a fresh clock", () => {
  const battle = active();
  battle.time = 0.01;
  tick(battle, 0.05);
  assert.equal(battle.roundWinner, null);
  assert.deepEqual(
    battle.players.map((p) => p.wins),
    [0, 0],
  );
  tick(battle, 2.5);
  assert.equal(battle.round, 2);
  assert.equal(battle.time, 60);
});

test("CPU approaches and damages a stationary opponent at every difficulty", () => {
  for (const difficulty of ["easy", "normal", "hard"]) {
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const battle = active({ mode: "cpu", difficulty, random });
    tick(battle, 12);
    assert.ok(
      battle.players[1].stats.damage > 0,
      `${difficulty} CPU should deal real damage`,
    );
  }
});

test("arena boundaries, crouch speed, and special meter limit remain enforced", () => {
  const battle = active();
  tick(battle, 4, [{ left: true }, {}]);
  assert.equal(battle.players[0].x, 45);
  const x = battle.players[0].x;
  tick(battle, 0.5, [{ right: true, crouch: true }, {}]);
  const crouched = battle.players[0].x - x;
  const next = battle.players[0].x;
  tick(battle, 0.5, [{ right: true }, {}]);
  assert.ok(battle.players[0].x - next > crouched * 2);
  battle.players[0].meter = 0;
  tick(battle, 0.3, [{ special: true }, {}]);
  assert.equal(battle.projectiles.length, 0);
  assert.equal(battle.players[0].attack, null);
});
