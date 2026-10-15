// Dev tool: CPU-vs-CPU round robin with stats. `node scripts/balance.mjs [level] [repeats]`
import { Battle } from "../src/game/battle.js";
import { AIController } from "../src/game/ai.js";
import { ROSTER } from "../src/chars/index.js";
import { mulberry32 } from "../src/core/util.js";

const level = process.argv[2] || "hard";
const repeats = Number(process.argv[3] || 2);
const wins = Object.fromEntries(ROSTER.map((c) => [c.id, 0]));
const games = Object.fromEntries(ROSTER.map((c) => [c.id, 0]));
const moveUse = {};
let total = 0;
let frames = 0;
let kos = 0;
let timeouts = 0;
let steals = 0;
let justs = 0;
let maxCombo = 0;
let seed = 1;
for (let r = 0; r < repeats; r++) {
  for (const a of ROSTER) {
    for (const b of ROSTER) {
      if (a === b) continue;
      const battle = new Battle({ p1: a, p2: b, mode: "cpu", seed, rounds: 2, timer: 99 });
      const ais = [new AIController(level, mulberry32(seed * 3 + 1)), new AIController(level, mulberry32(seed * 5 + 2))];
      seed++;
      let f = 0;
      while (battle.phase !== "matchEnd" && f < 60 * 60 * 8) {
        const [f0, f1] = battle.fighters;
        battle.step([ais[0].think(battle, f0, f1), ais[1].think(battle, f1, f0)]);
        for (const e of battle.drain()) {
          if (e.type === "move") {
            const k = battle.fighters[e.side].char.id + ":" + e.id;
            moveUse[k] = (moveUse[k] || 0) + 1;
          }
          if (e.type === "ko") kos++;
          if (e.type === "steal") steals++;
          if (e.type === "justGuard") justs++;
          if (e.type === "announce" && e.text === "TIME OVER") timeouts++;
          if (e.type === "hit") maxCombo = Math.max(maxCombo, e.combo);
        }
        f++;
      }
      frames += f;
      total++;
      games[a.id]++;
      games[b.id]++;
      if (battle.matchWinner !== null) wins[battle.fighters[battle.matchWinner].char.id]++;
    }
  }
}
console.log(`level=${level} matches=${total} avgMatchSec=${(frames / total / 60).toFixed(1)} KOs=${kos} timeouts=${timeouts} steals=${steals} justGuards=${justs} maxCombo=${maxCombo}`);
for (const c of ROSTER) console.log(`${c.id.padEnd(10)} win% ${((wins[c.id] / games[c.id]) * 100).toFixed(1)}`);
const top = Object.entries(moveUse).sort((a, b) => b[1] - a[1]);
console.log(top.map(([k, v]) => `${k}=${v}`).join("  "));
