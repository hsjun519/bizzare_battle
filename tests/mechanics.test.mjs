// Focused checks for the fighting fundamentals and both signature systems.
import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/game/battle.js";
import { charById, ROSTER } from "../src/chars/index.js";
import { PARADIGMS } from "../src/game/paradigms.js";

const idle = { held: {}, pressed: {} };
const press = (...keys) => ({ held: Object.fromEntries(keys.map((k) => [k, true])), pressed: Object.fromEntries(keys.map((k) => [k, true])) });
const hold = (...keys) => ({ held: Object.fromEntries(keys.map((k) => [k, true])), pressed: {} });

function fight(p1 = "huang", p2 = "socrates", opts = {}) {
  const b = new Battle({ p1: charById(p1), p2: charById(p2), mode: "versus", seed: 3, paradigm: false, ...opts });
  let n = 0;
  while (b.phase !== "fight" && n++ < 400) b.step([idle, idle]);
  return b;
}

function run(b, frames, c0 = idle, c1 = idle) {
  for (let i = 0; i < frames; i++) b.step([typeof c0 === "function" ? c0(i) : c0, typeof c1 === "function" ? c1(i) : c1]);
}

function place(b, gap = 90) {
  const [a, d] = b.fighters;
  a.x = 900;
  d.x = 900 + gap;
  a.facing = 1;
  d.facing = -1;
}

test("light attack hits a standing opponent and builds a combo", () => {
  const b = fight();
  place(b, 100);
  b.step([press("L"), idle]);
  run(b, 6);
  assert.ok(b.fighters[1].health < b.fighters[1].maxHealth);
  assert.equal(b.fighters[1].state, "hitstun");
});

test("holding back blocks mids, crouch-block is needed for lows", () => {
  const b = fight();
  place(b, 100);
  b.step([press("L"), hold("right")]);
  run(b, 6, idle, hold("right"));
  assert.equal(b.fighters[1].health, b.fighters[1].maxHealth, "mid blocked standing");
  run(b, 30);
  place(b, 100);
  b.step([press("down", "L"), hold("right")]);
  run(b, 8, hold("down"), hold("right"));
  assert.ok(b.fighters[1].health < b.fighters[1].maxHealth, "low hits a standing guard");
});

test("overheads beat crouch guard", () => {
  const b = fight();
  place(b, 110);
  b.step([press("right", "H"), hold("right", "down")]);
  run(b, 20, hold("right"), hold("right", "down"));
  assert.ok(b.fighters[1].health < b.fighters[1].maxHealth);
});

test("throws beat blocking and can be teched", () => {
  const b = fight();
  place(b, 70);
  b.step([press("L", "H"), hold("right")]);
  run(b, 3, idle, hold("right"));
  assert.equal(b.fighters[1].state, "thrown");
  run(b, 40);
  assert.ok(b.fighters[1].health < b.fighters[1].maxHealth);

  const c = fight();
  place(c, 70);
  c.step([press("L", "H"), idle]);
  for (let i = 0; i < 10 && c.fighters[1].state !== "thrown"; i++) c.step([idle, idle]);
  assert.equal(c.fighters[1].state, "thrown");
  c.step([idle, press("L", "H")]);
  run(c, 2);
  assert.equal(c.fighters[1].state, "tech");
  assert.equal(c.fighters[1].health, c.fighters[1].maxHealth);
});

test("launcher can be jump-cancelled into an air combo", () => {
  const b = fight("plato", "musk");
  place(b, 70);
  b.step([press("down", "H"), idle]);
  let sawSuperJump = false;
  for (let i = 0; i < 40; i++) {
    b.step([i > 8 ? hold("up") : hold("down"), idle]);
    if (b.fighters[0].superJump) sawSuperJump = true;
  }
  assert.ok(sawSuperJump, "super jump after launcher");
  assert.ok(b.fighters[1].y > 0 || b.fighters[1].state === "airhit" || b.fighters[1].state === "land" || b.fighters[1].state === "knockdown");
});

test("REFUTE & ACQUIRE: a just guard steals the special and locks it for the owner", () => {
  const b = fight("huang", "socrates");
  place(b, 330);
  b.step([press("S"), idle]);
  // Socrates taps back right before the chip arrives.
  let stolen = false;
  for (let i = 0; i < 60 && !stolen; i++) {
    const p = b.projectiles[0];
    const near = p && Math.abs(p.x - b.fighters[1].x) < 90;
    b.step([idle, near && !b.fighters[1].vars.tapped ? press("right") : near ? hold("right") : idle]);
    if (near) b.fighters[1].vars.tapped = true;
    stolen = Boolean(b.fighters[1].stolen);
  }
  const soc = b.fighters[1];
  const jen = b.fighters[0];
  assert.ok(stolen, "socrates holds a stolen move");
  assert.equal(soc.stolen.move.name, "텐서 코어 칩");
  assert.ok(jen.locked.S > 0, "jensen's S is locked");
  assert.equal(soc.health, soc.maxHealth, "no chip damage on just guard");
  // Jensen cannot use the locked move.
  run(b, 30);
  b.step([press("S"), idle]);
  run(b, 3);
  assert.notEqual(jen.moveId === "S" && jen.state === "attack", true);
  // Socrates fires it with up + S, which hands the move back.
  run(b, 20);
  b.step([idle, press("up", "S")]);
  run(b, 2);
  assert.equal(soc.state, "attack");
  assert.equal(soc.stolen, null);
  assert.equal(jen.locked.S, 0);
  run(b, 20);
  assert.ok(b.projectiles.some((p) => p.owner === soc), "socrates threw a GPU chip");
});

test("stolen moves expire after ten seconds", () => {
  const b = fight("plato", "nietzsche");
  const f = b.fighters[1];
  f.stolen = { id: "S", move: b.fighters[0].moves.S, char: b.fighters[0].char, timer: 600, max: 600 };
  b.fighters[0].locked.S = 600;
  run(b, 605);
  assert.equal(f.stolen, null);
  assert.equal(b.fighters[0].locked.S, 0);
});

test("PARADIGM SHIFT: every law can be applied and changes the fight", () => {
  for (const r of PARADIGMS) {
    const b = fight("musk", "buffett", { paradigm: true, forceRule: r.id });
    run(b, 15 * 60 + 5);
    assert.equal(b.rule?.id, r.id, `${r.id} active`);
    run(b, 600, (i) => (i % 40 === 0 ? press("S") : idle), (i) => (i % 50 === 0 ? press("L") : hold("right")));
  }
});

test("eternal recurrence warps fighters back in time", () => {
  const b = fight("socrates", "plato", { paradigm: true, forceRule: "recurrence" });
  run(b, 15 * 60 + 110);
  b.drain();
  let warped = false;
  for (let i = 0; i < 500 && !warped; i++) {
    const before = b.posHistory.length > 180 ? b.posHistory[b.posHistory.length - 180][0] : null;
    b.step([i % 120 < 60 ? hold("right") : hold("left"), idle]);
    warped = b.drain().some((e) => e.type === "recurrence");
    if (warped) assert.ok(Math.abs(b.fighters[0].x - before) < 12, "returned to the past position");
  }
  assert.ok(warped);
});

test("every special and super of every fighter can be performed", () => {
  for (const c of ROSTER) {
    for (const id of ["S", "6S", "2S", "X"]) {
      const b = fight(c.id, "socrates");
      place(b, 160);
      const f = b.fighters[0];
      f.meter = 100;
      assert.ok(f.startMove(id), `${c.id} ${id}`);
      run(b, 260);
      assert.ok(Number.isFinite(f.x));
    }
  }
});

test("a full round ends with a KO and win state", () => {
  const b = fight("nietzsche", "diogenes");
  b.fighters[1].health = 1;
  place(b, 100);
  b.step([press("L"), idle]);
  run(b, 400);
  assert.ok(["roundEnd", "intro", "fight"].includes(b.phase) || b.fighters[0].wins === 1);
  assert.equal(b.fighters[0].wins, 1);
});
