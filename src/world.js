const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const PLATFORM = new Set([
  "candle",
  "chip",
  "question",
  "crystal",
  "starship",
  "train",
  "shadow",
]);
const ASSET = new Set([
  "candle",
  "chip",
  "program",
  "pad",
  "lamp",
  "crystal",
  "depot",
]);
export const RULES = {
  wrap: "지구는 둥글다 · 양 끝 연결",
  gravity: "화성 표준 · 발사체 중력",
  bounce: "재사용 가능 · 벽 반사",
  projectileJump: "점프의 정의 · W로 발사체 점프",
  wallMemory: "벽의 정의 · 공격을 저장",
  solidShadows: "실재의 정의 · 그림자도 물체",
  shadows: "동굴의 비유 · 그림자가 피격 대상",
  vow: "아모르 파티 · 매도·철거 금지",
};
export class ArenaWorld {
  constructor(b) {
    this.b = b;
    this.objects = [];
    this.rules = [];
    this.history = [];
    this.echoes = [];
    this.nextId = 1;
    this.market = { NVDA: 108, TSLA: 240, "BRK.B": 180 };
    this.marketHistory = { NVDA: [108], TSLA: [240], "BRK.B": [180] };
    this.marketClock = 0;
    this.originals = new Map();
    this.discoveries = new Set();
    this.feedback = [];
    b.players.forEach((p, i) => {
      if (p.fighter.id === "buffett")
        this.add("bag", i, p.x - 35 * p.facing, {
          held: true,
          hp: Infinity,
          life: Infinity,
          w: 30,
          h: 24,
        });
    });
  }
  notice(text, owner = 0) {
    this.b.emit("notice", { text, owner });
    this.feedback.push({ text, life: 3 });
    this.feedback = this.feedback.slice(-3);
  }
  discover(id) {
    if (!this.discoveries.has(id)) {
      this.discoveries.add(id);
      this.b.emit("discovery", { id });
    }
  }
  has(kind) {
    return this.rules.some(
      (r) => r.kind === kind && r.life > 0 && r.warning <= 0,
    );
  }
  rule(kind, owner, duration = 7, warning = 0.65) {
    this.rules = this.rules.filter((r) => r.kind !== kind);
    if (this.rules.length >= 3) this.rules.shift();
    this.rules.push({ kind, owner, life: duration + warning, warning });
    this.notice(RULES[kind], owner);
    if (kind === "solidShadows") this.discover("solid-shadow");
  }
  add(kind, owner, x, extra = {}) {
    if (this.objects.filter((o) => o.kind !== "bag").length >= 30) {
      const old = this.objects.find((o) => o.kind !== "bag");
      if (old) old.life = 0;
      this.cleanup();
    }
    const o = {
      id: this.nextId++,
      kind,
      owner,
      x: clamp(x, 30, 930),
      y: 0,
      w: 44,
      h: 36,
      hp: 24,
      life: 14,
      vx: 0,
      platform: PLATFORM.has(kind),
      stakes: [0, 0],
      age: 0,
      ...extra,
    };
    if (ASSET.has(kind)) o.stakes[owner] = 100;
    if (
      this.b.players[owner]?.fighter.id === "plato" &&
      ["lamp", "crystal"].includes(kind)
    ) {
      const key = owner + ":" + kind,
        original = this.objects.find(
          (a) => a.id === this.originals.get(key) && a.life > 0,
        );
      if (original) o.source = original.id;
      else {
        o.original = true;
        this.originals.set(key, o.id);
      }
    }
    this.objects.push(o);
    return o;
  }
  record(kind, owner, data) {
    this.history.push({ at: this.b.elapsed, kind, owner, data: { ...data } });
    this.history = this.history
      .filter((h) => this.b.elapsed - h.at < 7)
      .slice(-70);
  }
  hurtbox(p) {
    if (!this.has("shadows")) return { x: p.x, y: p.y };
    const lamp = this.objects.find((o) => o.kind === "lamp" && o.life > 0);
    return {
      x: clamp(p.x + (lamp?.direction || 1) * (65 + p.y * 0.28), 35, 925),
      y: p.y,
    };
  }
  platformAt(p, oldY) {
    let top = 0,
      standing = null;
    for (const o of this.objects) {
      const level = o.y + o.h;
      if (
        o.platform &&
        o.life > 0 &&
        !o.disabled &&
        Math.abs(p.x - o.x) < o.w / 2 + 17 &&
        oldY >= level - 1 &&
        p.y <= level &&
        level >= top
      ) {
        top = level;
        standing = o;
      }
    }
    return { top, standing };
  }
  moveObject(o, dx, moved = new Set()) {
    if (moved.has(o.id)) return;
    moved.add(o.id);
    const previous = o.x;
    o.x = clamp(o.x + dx, 30, 930);
    for (const child of this.objects.filter((a) => a.source === o.id)) {
      this.moveObject(child, o.x - previous, moved);
    }
  }
  bagAvailable(i) {
    const p = this.b.players[i],
      bag = this.objects.find((o) => o.kind === "bag" && o.owner === i);
    return Boolean(bag && (bag.held || Math.abs(bag.x - p.x) < 135));
  }
  cast(owner, slot, input = {}) {
    const p = this.b.players[owner],
      enemy = this.b.players[1 - owner],
      id = p.fighter.id;
    if (id === "buffett" && !this.bagAvailable(owner)) {
      this.notice("서류가방 근처에서 명령하세요 · R 회수", owner);
      return false;
    }
    if (id === "musk" && slot !== "skill2" && p.boosters <= 0) {
      this.notice("빈 부스터를 R로 회수하세요", owner);
      return false;
    }
    if (slot === "skill1") {
      if (id === "huang") {
        if (!this.trade(owner, Boolean(input.crouch), "NVDA")) return false;
        const candles = this.objects.filter(
          (o) => o.kind === "candle" && o.owner === owner,
        );
        if (input.crouch && candles.length && !this.has("vow")) {
          for (const c of candles) c.h = Math.max(18, c.h - 30);
          this.notice("NVDA 매도 · 발판 하강", owner);
        } else
          this.add("candle", owner, p.x + p.facing * 125, {
            w: 48,
            h: 48 + (Math.round(this.market.NVDA) % 35),
            label: "NVDA",
            hp: 34,
          });
        this.b.makeBullet(owner, { type: "chip", damage: 7 });
      } else if (id === "musk") {
        p.boosters--;
        this.add("booster", owner, p.x - p.facing * 25, {
          w: 24,
          h: 20,
          hp: Infinity,
          life: Infinity,
        });
        this.add("pad", owner, p.x + p.facing * 55, {
          target: this.market.TSLA + 8,
          armed: 0.7,
          deadline: 7,
          label: "TSLA → " + Math.round(this.market.TSLA + 8),
          w: 58,
          h: 24,
        });
        this.notice("TSLA 목표 +8 · R 매수 / S+R 매도", owner);
      } else if (id === "socrates") {
        this.b.makeBullet(owner, { type: "question", damage: 11 });
        this.question(owner, p.x - p.facing * 60);
      } else if (id === "plato") {
        this.add("lamp", owner, p.x + p.facing * 85, {
          w: 32,
          h: 90,
          direction: p.facing,
          hp: 25,
        });
        this.b.makeBullet(owner, { type: "crystal", damage: 10 });
      } else if (id === "nietzsche") {
        p.attack = {
          type: "dash",
          time: 0,
          duration: 0.4,
          hit: false,
          facing: p.facing,
        };
        p.trail = 0.4;
        this.record("melee", owner, {
          x: p.x,
          y: p.y,
          facing: p.facing,
          reach: 130,
          damage: 15,
        });
      } else {
        const asset = this.objects
          .filter((o) => ASSET.has(o.kind) && o.owner !== owner && o.life > 0)
          .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
        if (asset && Math.abs(asset.x - p.x) < 550) this.buyAsset(owner, asset);
        else
          this.add("depot", owner, p.x + p.facing * 110, {
            w: 52,
            h: 34,
            label: "BRK.B",
            hp: 32,
          });
        this.b.makeBullet(owner, { type: "coin", damage: 8 });
      }
    } else if (slot === "skill2") {
      if (id === "huang") {
        const actions = this.history
          .filter((h) => h.owner === owner && h.kind === "melee")
          .slice(-3)
          .map((h) => (h.data.reach > 100 ? "kick" : "punch"));
        this.add("program", owner, p.x + p.facing * 80, {
          commands: actions.length ? actions : ["punch", "kick"],
          direction: p.facing,
          clock: 1.1,
          index: 0,
          w: 36,
          h: 52,
          hp: 28,
        });
        this.notice("컴파일 완료 · 공격하면 이동 명령 반전", owner);
      } else if (id === "musk")
        this.rule(["wrap", "gravity", "bounce"][p.ruleIndex++ % 3], owner);
      else if (id === "socrates") {
        const a = this.objects
          .filter((o) => ASSET.has(o.kind) && o.owner !== owner)
          .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
        this.add("proof", owner, enemy.x - 70 * enemy.facing, {
          targetId: a?.id,
          label: a?.kind === "pad" ? "목표가?" : a ? "소유권?" : "너 자신?",
          h: 32,
          w: 36,
        });
        this.notice("전제 추출 · 논점 근처 R로 조건 변경", owner);
      } else if (id === "plato") {
        for (let i = 0; i < 3; i++)
          this.add("crystal", owner, p.x + p.facing * (90 + i * 58), {
            w: 42,
            h: 35 + i * 15,
            hp: 26,
          });
      } else if (id === "nietzsche") this.recur(owner);
      else this.auction(owner);
    } else {
      if (id === "huang") {
        let candles = this.objects.filter(
          (o) => o.owner === owner && o.kind === "candle",
        );
        if (!candles.length)
          candles = [
            this.add("candle", owner, p.x + p.facing * 100, {
              w: 100,
              h: 56,
              label: "NVDA",
            }),
          ];
        for (const c of candles.slice(0, 3)) {
          c.life = 0;
          for (let i = 0; i < 4; i++)
            this.add("chip", owner, c.x + (i - 1.5) * 38, {
              w: 32,
              h: 20,
              y: 14 + i * 17,
              hp: 16,
              label: "NVDA",
              life: 10,
            });
        }
        for (let i = 0; i < 3; i++)
          p.specialQueue.push({
            delay: 0.16 + i * 0.18,
            type: "chip",
            damage: 8,
            facing: p.facing,
          });
        this.notice("액면분할 · 양쪽이 쓸 수 있는 칩 발판", owner);
      } else if (id === "musk") {
        p.boosters--;
        this.add("booster", owner, p.x - p.facing * 30, {
          w: 24,
          h: 20,
          hp: Infinity,
          life: Infinity,
        });
        this.add("starship", owner, p.x + p.facing * 65, {
          w: 172,
          h: 22,
          y: 42,
          vx: p.facing * 110,
          hp: Infinity,
          life: 6,
        });
        this.b.makeBullet(owner, { type: "rocket", damage: 19, velocity: 340 });
        this.notice("스타십 탑승 가능 · 점프로 올라타세요", owner);
      } else if (id === "socrates") {
        const kind = ["projectileJump", "wallMemory", "solidShadows"][
          p.ruleIndex++ % 3
        ];
        this.rule(kind, owner);
        this.question(owner, p.x).switchRule = kind;
        this.b.makeBullet(owner, { type: "question", damage: 13 });
      } else if (id === "plato") {
        if (!this.objects.some((o) => o.kind === "lamp"))
          this.add("lamp", owner, p.x - p.facing * 70, {
            h: 90,
            direction: p.facing,
          });
        this.rule("shadows", owner);
        const a = this.objects.find((o) => o.owner === owner && o.original);
        const others = this.objects
          .filter((o) => ASSET.has(o.kind) && o.id !== a?.id)
          .slice(0, 5);
        if (a) for (const o of others) o.source = a.id;
        if (others.length) this.discover("shared-idea");
        this.b.makeBullet(owner, { type: "crystal", damage: 12 });
      } else if (id === "nietzsche") {
        this.rule("vow", owner, 8);
        this.recur(owner);
        p.attack = {
          type: "dash",
          time: 0,
          duration: 0.42,
          hit: false,
          facing: p.facing,
        };
        p.trail = 0.4;
      } else {
        this.add("train", owner, p.facing === 1 ? 70 : 890, {
          w: 205,
          h: 30,
          vx: p.facing * 120,
          life: 7,
          hp: Infinity,
          label: "BNSF / BRK.B",
        });
        this.b.makeBullet(owner, { type: "coin", damage: 16, velocity: 370 });
        this.notice("주총 열차 · 시설과 가방도 함께 이동", owner);
      }
    }
    return true;
  }
  question(owner, x) {
    const old = this.objects.filter(
      (o) => o.kind === "question" && o.owner === owner,
    );
    if (old.length >= 2) old[0].life = 0;
    return this.add("question", owner, x, {
      w: 42,
      h: 30,
      hp: 18,
      life: 12,
      label: "왜?",
    });
  }
  buyAsset(owner, o) {
    const p = this.b.players[owner];
    if (p.capital < 20) {
      this.notice("인수 자본 부족", owner);
      return false;
    }
    p.capital -= 20;
    o.stakes[owner] = Math.min(100, o.stakes[owner] + 34);
    o.stakes[1 - owner] = 100 - o.stakes[owner];
    if (o.stakes[owner] > 50 && o.owner !== owner) {
      o.owner = owner;
      if (o.kind === "pad") o.target = this.market.TSLA + 4;
      p.stats.claims++;
      this.discover("hostile-takeover");
      this.notice("과반 확보 · 소유권 이전", owner);
    } else this.notice("지분 " + o.stakes[owner] + "% · 과반이면 인수", owner);
    return true;
  }
  trade(owner, sell = false, symbol) {
    const p = this.b.players[owner];
    symbol ||=
      p.fighter.id === "huang"
        ? "NVDA"
        : p.fighter.id === "musk"
          ? "TSLA"
          : "BRK.B";
    if (sell && this.has("vow")) {
      this.notice("아모르 파티 · 매도 금지", owner);
      return false;
    }
    if (sell) {
      if (p.holdings[symbol] <= 0) {
        this.notice("보유 주식 없음", owner);
        return false;
      }
      p.holdings[symbol]--;
      p.capital = Math.min(150, p.capital + 9);
      this.market[symbol] = clamp(this.market[symbol] - 6, 40, 400);
    } else {
      if (p.capital < 12) {
        this.notice("매수 자본 부족", owner);
        return false;
      }
      p.capital -= 12;
      p.holdings[symbol]++;
      this.market[symbol] = clamp(this.market[symbol] + 6, 40, 400);
    }
    p.stats.trades++;
    this.b.emit("trade", { owner, symbol, sell });
    return true;
  }
  auction(owner, template) {
    const p = this.b.players[owner];
    let shot = template;
    if (!shot) {
      shot = this.b.projectiles
        .filter((s) => s.owner !== owner && s.life > 0)
        .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
      if (shot) shot.life = 0;
    }
    const payload = shot
      ? { ...shot }
      : {
          type: "coin",
          damage: 12,
          velocity: 380,
          color: p.fighter.color,
          radius: 17,
        };
    const o = this.add("auction", owner, shot?.x || 480, {
      w: 60,
      h: 44,
      y: 46,
      hp: Infinity,
      life: 3.4,
      payload,
      bidder: owner,
      bid: 0,
      label: "IPO · R 입찰",
    });
    this.record("auction", owner, { x: o.x, payload: { ...payload } });
    this.notice("공격 경매 · 종 근처 R 입찰", owner);
  }
  recur(owner) {
    const p = this.b.players[owner];
    let history = this.history
      .filter((h) => this.b.elapsed - h.at < 4)
      .slice(-6);
    if (!history.length)
      history = [
        {
          kind: "melee",
          owner,
          data: {
            x: p.x + p.facing * 70,
            y: p.y,
            facing: p.facing,
            reach: 110,
            damage: 12,
          },
        },
      ];
    if (p.coatTorn) history = Array.from({ length: 3 }, () => history.at(-1));
    history.forEach((h, i) =>
      this.echoes.push({
        at: this.b.elapsed + 0.9 + i * 0.55,
        entry: { ...h, data: { ...h.data } },
      }),
    );
    this.echoes = this.echoes.slice(-18);
    this.notice(
      p.coatTorn
        ? "상처의 의지 · 마지막 공격 반복"
        : "영원회귀 · 자신의 과거 공격도 주의",
      owner,
    );
  }
  interact(owner, sell = false) {
    if (sell) {
      return this.trade(
        owner,
        true,
        this.objects.some((o) => o.kind === "pad" && o.life > 0)
          ? "TSLA"
          : undefined,
      );
    }
    const p = this.b.players[owner],
      near = this.objects
        .filter(
          (o) =>
            o.life > 0 &&
            Math.abs(o.x - p.x) < 85 &&
            Math.abs(o.y - p.y) < 85 &&
            !o.held,
        )
        .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
    const o =
      near.find((a) =>
        ["booster", "auction", "proof", "lamp", "bag"].includes(a.kind),
      ) || near.find((a) => ASSET.has(a.kind) && a.owner !== owner);
    if (o?.kind === "booster" && p.fighter.id === "musk") {
      p.boosters = Math.min(2, p.boosters + 1);
      o.life = 0;
      this.notice("부스터 회수", owner);
    } else if (o?.kind === "auction") {
      if (p.capital < 8) return;
      p.capital -= 8;
      o.bid += 8;
      o.bidder = owner;
      this.notice("입찰 " + o.bid + " · " + p.fighter.short, owner);
    } else if (o?.kind === "lamp") {
      o.direction = -(o.direction || 1);
      this.notice("조명 회전", owner);
    } else if (o?.kind === "proof") {
      const a = this.objects.find((a) => a.id === o.targetId && a.life > 0);
      if (a?.kind === "pad") {
        a.target += sell ? 6 : -6;
        a.label = "TSLA → " + Math.round(a.target);
        this.notice("발사 전제 변경", owner);
      } else if (a && ASSET.has(a.kind)) this.buyAsset(owner, a);
      else this.recur(owner);
      o.life = 0;
    } else if (o?.kind === "bag" && o.owner === owner) {
      o.held = true;
      this.notice("서류가방 회수", owner);
    } else if (o && ASSET.has(o.kind) && o.owner !== owner)
      this.buyAsset(owner, o);
    else if (p.fighter.id === "buffett") {
      const bag = this.objects.find(
        (a) => a.kind === "bag" && a.owner === owner,
      );
      if (bag?.held) {
        bag.held = false;
        bag.x = p.x - p.facing * 35;
        bag.y = p.y;
        this.notice("가방 내려놓기 · 시설은 계속 작동", owner);
      } else this.trade(owner, sell);
    } else
      this.trade(
        owner,
        sell,
        this.objects.some((a) => a.kind === "pad" && a.life > 0)
          ? "TSLA"
          : undefined,
      );
  }
  strikeObjects(p, a, owner) {
    if (a.worldHit || a.time < 0.09 || a.time > 0.24) return;
    a.worldHit = true;
    const reach = a.type === "kick" ? 126 : 100;
    for (const o of [...this.objects]) {
      if (o.life <= 0 || o.held || o.disabled) continue;
      const d = (o.x - p.x) * a.facing;
      if (
        d < 0 ||
        d > reach + o.w / 2 ||
        Math.abs(p.y - (o.y + Math.min(o.h, 65))) > 105
      )
        continue;
      if (o.owner === owner && this.has("vow") && ASSET.has(o.kind)) continue;
      if (o.kind === "program") {
        o.direction = -o.direction;
        this.notice("컴파일 수정 · 이동 반전", owner);
      }
      if (o.kind === "lamp") o.direction = -(o.direction || 1);
      this.moveObject(o, a.facing * (a.type === "kick" ? 30 : 15));
      if (!["bag", "booster", "auction", "train", "starship"].includes(o.kind))
        o.hp -= a.type === "kick" ? 16 : 10;
      if (o.hp <= 0) this.destroy(o, owner);
    }
    for (const o of this.objects.filter(
      (o) => o.kind === "wallShot" && Math.abs(o.x - p.x) < reach + 15,
    )) {
      this.b.makeBullet(owner, {
        ...o.payload,
        x: o.x - a.facing * 8,
        direction: -a.facing,
        life: 3.6,
        record: false,
      });
      o.life = 0;
    }
  }
  destroy(o, owner) {
    o.life = 0;
    if (o.switchRule) {
      this.rules = this.rules.filter((r) => r.kind !== o.switchRule);
      this.discover("question-switch");
      this.notice("질문 파괴 · 정의 종료", owner);
    }
    if (o.original) {
      for (const c of this.objects.filter((a) => a.source === o.id)) {
        c.disabled = true;
        c.life = Math.min(c.life, 2);
      }
      this.notice("원본 파괴 · 사본은 윤곽선", owner);
    }
  }
  afterHit(p, index, damage, blocked) {
    if (p.fighter.id === "huang" && p.shield === 0 && !p.jacketLost) {
      p.jacketLost = true;
      this.add("jacket", index, p.x - 30 * p.facing, {
        w: 48,
        h: 9,
        hp: Infinity,
        life: 18,
      });
      this.notice("가죽 재킷 파괴 · 이동 +18%", index);
    }
    if (p.fighter.id === "nietzsche" && p.health <= 50 && !p.coatTorn) {
      p.coatTorn = true;
      this.notice("코트 파괴 · 마지막 공격에 의지 집중", index);
    }
    if (
      p.fighter.id === "socrates" &&
      !blocked &&
      damage >= 11 &&
      p.questionCd <= 0
    ) {
      this.question(index, p.x - p.facing * 45);
      p.questionCd = 2;
    }
    if (p.fighter.id === "buffett" && !blocked && damage >= 12) {
      const bag = this.objects.find(
        (o) => o.kind === "bag" && o.owner === index,
      );
      if (bag?.held) {
        bag.held = false;
        bag.x = p.x - p.facing * 55;
        bag.y = 0;
        this.notice("서류가방을 놓쳤습니다 · R 회수", index);
      }
    }
  }
  update(dt) {
    this.rules.forEach((r) => {
      r.life -= dt;
      r.warning = Math.max(0, r.warning - dt);
    });
    this.rules = this.rules.filter((r) => r.life > 0);
    this.feedback.forEach((f) => (f.life -= dt));
    this.feedback = this.feedback.filter((f) => f.life > 0);
    this.marketClock += dt;
    if (this.marketClock >= 0.6) {
      this.marketClock = 0;
      for (const s of Object.keys(this.market)) {
        this.market[s] = clamp(
          this.market[s] +
            Math.sin(this.b.elapsed * 0.8 + (s === "TSLA" ? 2 : 0)) * 0.65,
          40,
          400,
        );
        this.marketHistory[s].push(this.market[s]);
        this.marketHistory[s] = this.marketHistory[s].slice(-24);
      }
    }
    const due = this.echoes.filter((e) => e.at <= this.b.elapsed);
    this.echoes = this.echoes.filter((e) => e.at > this.b.elapsed);
    for (const e of due) {
      const h = e.entry;
      if (h.kind === "projectile")
        this.b.makeBullet(h.owner, {
          ...h.data,
          hostileAll: true,
          damage: Math.min(12, h.data.damage),
          record: false,
          echo: true,
          life: 3.6,
        });
      else if (h.kind === "auction") {
        this.auction(h.owner, h.data.payload);
        this.discover("ownership-dispute");
      } else
        this.add("echo", h.owner, h.data.x, {
          y: h.data.y,
          w: h.data.reach || 110,
          h: 110,
          life: 0.36,
          hp: Infinity,
          direction: h.data.facing,
          damage: Math.min(12, h.data.damage),
          hitPlayers: new Set(),
        });
    }
    for (const o of this.objects.filter((o) => o.kind === "bag" && o.held)) {
      const p = this.b.players[o.owner];
      o.x = p.x + 25 * p.facing;
      o.y = p.y;
    }
    for (const o of [...this.objects]) {
      o.life -= dt;
      o.age += dt;
      if (o.life <= 0) {
        if (o.kind === "auction") {
          const p = this.b.players[o.bidder];
          this.b.makeBullet(o.bidder, {
            ...o.payload,
            x: o.x,
            y: 410 - o.y - 30,
            direction: p.facing,
            record: false,
            life: 3.6,
          });
        }
        if (o.original) this.destroy(o, o.owner);
        continue;
      }
      if (o.kind === "pad") {
        o.armed -= dt;
        o.deadline -= dt;
        if (o.armed <= 0 && (this.market.TSLA >= o.target || o.deadline <= 0)) {
          this.b.makeBullet(o.owner, {
            type: "rocket",
            x: o.x,
            damage: 20,
            velocity: 360,
          });
          o.life = 0;
          this.notice("목표 도달 · SPACEX 발사", o.owner);
        }
      }
      if (o.kind === "program") {
        this.moveObject(o, o.direction * 42 * dt);
        o.clock -= dt;
        if (this.has("wrap")) {
          if (o.x <= 31) o.x = 928;
          if (o.x >= 929) o.x = 32;
        }
        if (this.has("wrap") || this.has("gravity") || this.has("bounce"))
          this.discover("parallel-patch");
        if (o.clock <= 0) {
          o.clock = 1.2;
          const cmd = o.commands[o.index++ % o.commands.length];
          this.b.makeBullet(o.owner, {
            type: "chip",
            x: o.x,
            y: 410 - o.y - 65,
            direction: o.direction,
            damage: cmd === "kick" ? 9 : 6,
            velocity: 280,
            record: false,
          });
        }
      }
      if (o.kind === "depot") {
        o.clock = (o.clock ?? 1.8) - dt;
        if (o.clock <= 0) {
          o.clock = 2.6;
          this.b.makeBullet(o.owner, {
            type: "coin",
            x: o.x,
            damage: 6,
            velocity: 250,
            record: false,
          });
        }
      }
      if (o.kind === "train" || o.kind === "starship") {
        const dx = o.vx * dt;
        o.x += dx;
        for (const p of this.b.players)
          if (
            Math.abs(p.x - (o.x - dx)) < o.w / 2 + 20 &&
            Math.abs(p.y - (o.y + o.h)) < 7
          ) {
            p.x = clamp(p.x + dx, 28, 932);
            if (o.kind === "starship") this.discover("rocket-rider");
          }
        if (o.kind === "train")
          for (const c of this.objects.filter(
            (a) =>
              a !== o &&
              !a.held &&
              a.kind !== "train" &&
              a.kind !== "starship" &&
              a.y < 35 &&
              Math.abs(a.x - o.x) < o.w / 2 &&
              (!a.source ||
                !this.objects.some(
                  (p) => p.id === a.source && Math.abs(p.x - o.x) < o.w / 2,
                )),
          )) {
            this.moveObject(c, dx);
            if (c.kind === "bag" || ASSET.has(c.kind))
              this.discover("moving-portfolio");
          }
        if (o.x < -150 || o.x > 1110) o.life = 0;
      }
      if (o.kind === "jacket")
        for (const p of this.b.players)
          if (
            Math.abs(p.x - o.x) < 31 &&
            p.y < 8 &&
            p.moving &&
            p.slipCd <= 0
          ) {
            p.slip = 0.28;
            p.slipCd = 2.5;
            p.stun = 0.2;
            this.discover("jacket-slip");
          }
      if (o.kind === "echo")
        for (const [i, p] of this.b.players.entries()) {
          const box = this.hurtbox(p);
          if (
            !o.hitPlayers.has(i) &&
            (box.x - o.x) * o.direction > 0 &&
            (box.x - o.x) * o.direction < o.w &&
            Math.abs(box.y - o.y) < 100
          ) {
            o.hitPlayers.add(i);
            this.b.hit(
              p,
              this.b.players[o.owner],
              o.damage,
              o.owner,
              o.direction,
              true,
            );
            if (i === o.owner) this.discover("self-echo");
          }
        }
    }
    if (this.has("solidShadows"))
      for (const [i, p] of this.b.players.entries()) {
        let o = this.objects.find((o) => o.kind === "shadow" && o.owner === i);
        if (!o)
          o = this.add("shadow", i, p.x + 65, {
            w: 58,
            h: 24,
            life: 1,
            hp: Infinity,
          });
        o.x = clamp(p.x + 65, 30, 930);
        o.life = 0.1;
      }
    this.cleanup();
  }
  cleanup() {
    this.objects = this.objects.filter((o) => o.life > 0);
  }
}
