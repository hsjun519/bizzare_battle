// Scene routing for every mode, including the arcade ladder.
import { TitleScene } from "./title.js";
import { SelectScene } from "./select.js";
import { VersusScene } from "./versus.js";
import { FightScene } from "./fight.js";
import { ResultScene } from "./results.js";
import { EndingScene } from "./ending.js";
import { GuideScene } from "./guide.js";
import { OptionsScene } from "./options.js";
import { ROSTER, charById } from "../chars/index.js";
import { STAGES } from "../render/stages.js";
import { shuffle } from "../core/util.js";

export const RIVALS = {
  socrates: "huang",
  plato: "smith",
  nietzsche: "musk",
  diogenes: "buffett",
  huang: "socrates",
  smith: "plato",
  musk: "nietzsche",
  buffett: "diogenes",
};

const LADDER_LEVELS = ["easy", "normal", "normal", "hard", "hard", "insane"];

export const Flow = {
  title(app, opts = {}) {
    app.go(new TitleScene(app, opts));
  },
  select(app, mode) {
    app.go(new SelectScene(app, mode));
  },
  guide(app) {
    app.go(new GuideScene(app));
  },
  options(app) {
    app.go(new OptionsScene(app));
  },

  // setup: { mode, p1, p2, stage, difficulty, arcade? }
  versus(app, setup) {
    app.go(new VersusScene(app, setup, () => Flow.fight(app, setup)));
  },

  fight(app, setup) {
    app.go(
      new FightScene(app, {
        ...setup,
        onEnd: (battle) => Flow.after(app, setup, battle),
        onRestart: () => Flow.fight(app, setup),
        onSelect: () => Flow.select(app, setup.mode),
        onTitle: () => Flow.title(app),
      }),
    );
  },

  after(app, setup, battle) {
    if (setup.mode === "arcade") {
      const ar = setup.arcade;
      const won = battle.matchWinner === 0;
      const f = battle.fighters[0];
      if (won) {
        const timeBonus = Math.round((battle.timer === Infinity ? 0 : battle.timer / 60) * 100);
        const lifeBonus = Math.round((f.health / f.maxHealth) * 20000);
        const gained = 10000 * (ar.index + 1) + lifeBonus + timeBonus + f.stats.maxCombo * 500 + (f.stats.perfect || 0) * 30000;
        ar.score += gained;
        ar.lastGain = gained;
      }
      app.go(new ResultScene(app, setup, battle, {
        onNext: () => {
          if (won) {
            ar.index++;
            if (ar.index >= ar.ladder.length) {
              const rec = app.save.records;
              rec.clears[setup.p1] = (rec.clears[setup.p1] || 0) + 1;
              rec.best = Math.max(rec.best || 0, ar.score);
              app.saveNow();
              app.go(new EndingScene(app, charById(setup.p1), ar.score, () => Flow.title(app)));
              return;
            }
            Flow.versus(app, Flow.arcadeSetup(setup.p1, ar));
          } else {
            ar.score = Math.floor(ar.score / 2);
            ar.continues++;
            Flow.versus(app, Flow.arcadeSetup(setup.p1, ar));
          }
        },
        onSelect: () => Flow.select(app, "arcade"),
        onTitle: () => Flow.title(app),
      }));
      return;
    }
    app.go(new ResultScene(app, setup, battle, {
      onNext: () => Flow.versus(app, setup),
      onSelect: () => Flow.select(app, setup.mode),
      onTitle: () => Flow.title(app),
    }));
  },

  startArcade(app, p1) {
    const rival = RIVALS[p1];
    const pool = shuffle(ROSTER.map((c) => c.id).filter((id) => id !== p1 && id !== rival));
    const ladder = [...pool.slice(0, 5), rival];
    const ar = { ladder, index: 0, score: 0, continues: 0, stages: shuffle(STAGES.map((s) => s.id)) };
    Flow.versus(app, Flow.arcadeSetup(p1, ar));
  },

  arcadeSetup(p1, ar) {
    const p2 = ar.ladder[ar.index];
    const rival = ar.index === ar.ladder.length - 1;
    return {
      mode: "arcade",
      p1,
      p2,
      stage: ar.stages[ar.index % ar.stages.length],
      difficulty: LADDER_LEVELS[Math.min(ar.index, LADDER_LEVELS.length - 1)],
      arcade: ar,
      rival,
    };
  },
};
