// Headless CPU-vs-CPU simulations across every matchup and stage.
import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/game/battle.js";
import { AIController } from "../src/game/ai.js";
import { ROSTER } from "../src/chars/index.js";
import { mulberry32 } from "../src/core/util.js";

function runMatch(a, b, { seed = 1, level = "hard", maxFrames = 60 * 60 * 6, stage = "agora" } = {}) {
  const battle = new Battle({ p1: a, p2: b, stage, mode: "cpu", seed, rounds: 2, timer: 60 });
  const ais = [new AIController(level, mulberry32(seed * 7 + 1)), new AIController(level, mulberry32(seed * 13 + 5))];
  const seen = new Set();
  let frames = 0;
  while (battle.phase !== "matchEnd" && frames < maxFrames) {
    const [f0, f1] = battle.fighters;
    battle.step([ais[0].think(battle, f0, f1), ais[1].think(battle, f1, f0)]);
    for (const e of battle.drain()) seen.add(e.type);
    for (const f of battle.fighters) {
      assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y), `position finite for ${f.char.id}`);
      assert.ok(f.health >= 0 && f.health <= f.maxHealth, "health in range");
      assert.ok(f.meter >= 0 && f.meter <= 100, "meter in range");
    }
    frames++;
  }
  return { battle, frames, seen };
}

test("every matchup finishes without errors", () => {
  let seed = 1;
  for (const a of ROSTER) {
    for (const b of ROSTER) {
      const { battle, seen } = runMatch(a, b, { seed: seed++ });
      assert.equal(battle.phase, "matchEnd", `${a.id} vs ${b.id} should end`);
      assert.ok(seen.has("hit"), `${a.id} vs ${b.id} should land hits`);
    }
  }
});

test("paradigm shift triggers mid-round", () => {
  const { seen } = runMatch(ROSTER[0], ROSTER[4], { seed: 99 });
  assert.ok(seen.has("paradigm"));
});

test("simulation is deterministic for a seed", () => {
  const r1 = runMatch(ROSTER[2], ROSTER[5], { seed: 42 });
  const r2 = runMatch(ROSTER[2], ROSTER[5], { seed: 42 });
  assert.equal(r1.frames, r2.frames);
  assert.equal(r1.battle.fighters[0].health, r2.battle.fighters[0].health);
  assert.equal(r1.battle.matchWinner, r2.battle.matchWinner);
});
