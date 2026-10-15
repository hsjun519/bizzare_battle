import { FIGHTERS, STAGES, DISCOVERIES, fighterById } from "./roster.js";
import { Battle } from "./engine.js";
import { RULES } from "./world.js";
import { ArenaArt, drawCard } from "./art.js";

const $ = (id) => document.getElementById(id);
const canvas = $("arena");
const art = new ArenaArt(canvas);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let selected = FIGHTERS[0];
let battle = null;
let lastConfig = null;
let lastFrame = performance.now();
let previousPhase = "";
let soundEnabled = false;
let audio = null;
const keys = new Set();
const touches = new Map();
const buffers = [{}, {}];
let discoveries = new Set();
try {
  discoveries = new Set(
    JSON.parse(localStorage.getItem("bizzare-discoveries") || "[]").filter(
      (id) => id in DISCOVERIES,
    ),
  );
} catch {}
let toastLife = 0;
let tradeUiCooldown = 0;
const touchDevice =
  matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

function tone(
  frequency,
  duration = 0.08,
  wave = "square",
  volume = 0.035,
  delay = 0,
) {
  if (!soundEnabled || !audio || audio.state !== "running") return;
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  const start = audio.currentTime + delay;
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(30, frequency * 0.55),
    start + duration,
  );
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}

function sound(type) {
  if (type === "hit") tone(110, 0.12, "sawtooth", 0.05);
  else if (type === "block") tone(370, 0.055, "triangle", 0.04);
  else if (type === "special") {
    tone(440, 0.16, "sawtooth", 0.028);
    tone(660, 0.2, "square", 0.025, 0.08);
  } else if (type === "jump") tone(260, 0.11, "triangle", 0.03);
  else if (type === "punch" || type === "kick")
    tone(type === "kick" ? 100 : 170, 0.045, "triangle", 0.025);
  else if (type === "fight" || type === "matchEnd")
    [330, 440, 660].forEach((f, i) => tone(f, 0.18, "square", 0.025, i * 0.12));
  else if (type === "roundEnd") {
    tone(150, 0.3, "sawtooth", 0.025);
    tone(80, 0.4, "triangle", 0.05, 0.14);
  } else tone(560, 0.05, "square", 0.02);
}

function readPreferences() {
  try {
    const prefs = JSON.parse(localStorage.getItem("bizzare-settings") || "{}");
    selected = fighterById(prefs.player);
    for (const id of ["mode", "difficulty", "stage"])
      if ([...$(id).options].some((o) => o.value === prefs[id]))
        $(id).value = prefs[id];
    if (FIGHTERS.some((f) => f.id === prefs.opponent))
      $("opponent").value = prefs.opponent;
  } catch {
    /* Storage is optional; a private window can still play. */
  }
}

function savePreferences() {
  try {
    localStorage.setItem("bizzare-settings", JSON.stringify(config()));
  } catch {
    /* Keep playing if storage is unavailable. */
  }
}

function config() {
  return {
    player: selected.id,
    opponent: $("opponent").value,
    mode: $("mode").value,
    difficulty: $("difficulty").value,
    stage: $("stage").value,
  };
}
function announce(text) {
  $("live-announcement").textContent = text;
}

function selectFighter(fighter, { announceSelection = false } = {}) {
  if (battle) return;
  selected = fighter;
  $("fighter-info").style.setProperty("--fighter-color", fighter.color);
  $("fighter-number").textContent =
    `${String(FIGHTERS.indexOf(fighter) + 1).padStart(2, "0")} / 06`;
  $("fighter-category").textContent = fighter.category;
  $("fighter-name").textContent = fighter.name;
  $("fighter-en").textContent = fighter.en;
  $("fighter-quote").textContent = `“${fighter.quote}”`;
  $("fighter-class").textContent = fighter.className;
  $("special-name").textContent = fighter.special;
  $("special-description").textContent = fighter.description;
  $("trait-name").textContent = fighter.trait;
  $("trait-description").textContent = fighter.traitDescription;
  $("fighter-affiliation").textContent = fighter.affiliation;
  const kit = [
    ["PASSIVE", fighter.trait, fighter.traitDescription],
    ["Q", ...fighter.skills[0]],
    ["E", ...fighter.skills[1]],
    ["L", fighter.special, fighter.description],
  ];
  $("kit-cards").innerHTML = kit
    .map(
      ([key, name, description]) =>
        `<article class="kit-card"><span class="kit-key">${key}</span><h3>${name}</h3><p>${description}</p></article>`,
    )
    .join("");
  $("counter-tip").textContent = "COUNTERPLAY · " + fighter.counter;
  $("preview-name").replaceChildren(document.createTextNode(fighter.short));
  const category = document.createElement("span");
  category.textContent = fighter.category;
  $("preview-name").append(category);
  $("fighter-stats").innerHTML = [
    ["POWER", fighter.power],
    ["SPEED", fighter.speed],
    ["REACH", fighter.reach],
  ]
    .map(
      ([label, value]) =>
        `<div class="stat"><span class="stat-label">${label}</span><span class="stat-blocks">${Array.from({ length: 5 }, (_, i) => `<span class="${i < value ? "filled" : ""}"></span>`).join("")}</span><span class="stat-value">${value}</span></div>`,
    )
    .join("");
  document.querySelectorAll(".fighter-card").forEach((button) => {
    const active = button.dataset.fighter === fighter.id;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  canvas.setAttribute(
    "aria-label",
    `${fighter.name}의 픽셀 캐릭터 미리보기. 필살기: ${fighter.special}`,
  );
  if (announceSelection) {
    announce(
      `${fighter.name} 선택. 필살기: ${fighter.special}. ${fighter.description}`,
    );
    sound("select");
  }
  savePreferences();
}

for (const [index, fighter] of FIGHTERS.entries()) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fighter-card";
  button.dataset.fighter = fighter.id;
  button.style.setProperty("--card-color", fighter.color);
  button.setAttribute(
    "aria-label",
    `${fighter.name} · ${fighter.className} · ${fighter.special}`,
  );
  button.innerHTML = `<span class="card-index">${String(index + 1).padStart(2, "0")}</span><div class="card-art"><canvas width="150" height="120" aria-hidden="true"></canvas></div><div class="card-caption"><strong>${fighter.name} <span class="card-arrow" aria-hidden="true">↗</span></strong><span>${fighter.category}</span></div>`;
  drawCard(button.querySelector("canvas"), fighter);
  button.addEventListener("click", () =>
    selectFighter(fighter, { announceSelection: true }),
  );
  $("roster").append(button);
  const option = document.createElement("option");
  option.value = fighter.id;
  option.textContent = fighter.name;
  $("opponent").append(option);
}
$("opponent").value = "musk";
readPreferences();
selectFighter(selected);

function updateSettings() {
  $("difficulty").disabled = $("mode").value !== "cpu";
  $("difficulty-setting").style.opacity =
    $("mode").value !== "cpu" ? ".4" : "1";
  $("stage-label").textContent = STAGES[$("stage").value];
  document.querySelector("#start-button small").textContent =
    $("mode").value === "training"
      ? "실험실 시작 · 빠른 재충전"
      : "대전 시작 · 3판 2선승";
  savePreferences();
}
for (const id of ["mode", "opponent", "difficulty", "stage"])
  $(id).addEventListener("change", updateSettings);
updateSettings();

function lockSettings(locked) {
  for (const element of document.querySelectorAll(
    ".fighter-card, .match-settings select, #start-button",
  ))
    element.disabled = locked;
  if (!locked) updateSettings();
}

function startMatch() {
  if (battle) return;
  lastConfig = config();
  runMatch(lastConfig);
}

function runMatch(settings) {
  if (audio && soundEnabled) audio.resume().catch(() => {});
  battle = new Battle(settings);
  previousPhase = "";
  keys.clear();
  touches.clear();
  buffers.forEach((b) => {
    for (const key of Object.keys(b)) delete b[key];
  });
  document.body.classList.add("playing");
  lockSettings(true);
  $("preview-overlay").hidden = true;
  $("hud").hidden = false;
  $("pause-button").hidden = false;
  $("touch-controls").hidden = !touchDevice || settings.mode === "local";
  $("battle-dashboard").hidden = false;
  $("receipt").hidden = true;
  $("training-reset").hidden = settings.mode !== "training";
  const players =
    settings.mode === "local" ? battle.players : [battle.players[0]];
  $("ability-controls").innerHTML = players
    .map(
      (p, i) =>
        `<div class="player-abilities"><span class="ability-owner">${p.fighter.short} · P${i + 1}</span>${[
          ["skill1", p.fighter.skills[0][0], i ? "4" : "Q"],
          ["skill2", p.fighter.skills[1][0], i ? "5" : "E"],
          ["special", p.fighter.special, i ? "3" : "L"],
        ]
          .map(
            ([action, name, key]) =>
              `<button class="ability-button" data-action="${action}" data-player="${i}" title="${action === "special" ? p.fighter.description : p.fighter.skills[action === "skill1" ? 0 : 1][1]}"><kbd>${key}</kbd><span>${name}</span><small>READY</small></button>`,
          )
          .join("")}</div>`,
    )
    .join("");
  for (const button of $("ability-controls").querySelectorAll("button"))
    button.addEventListener("click", () => {
      if (battle && !battle.paused && battle.phase === "fight")
        buffers[Number(button.dataset.player)][button.dataset.action] = 0.22;
    });
  $("arena-mode-label").textContent =
    settings.mode === "local"
      ? "LOCAL · PLAYER VS PLAYER"
      : settings.mode === "training"
        ? "LAB · EXPERIMENT & DISCOVER"
        : "ARCADE · PLAYER VS CPU";
  $("p1-name").textContent = `${battle.players[0].fighter.short} · P1`;
  $("p2-name").textContent =
    `${battle.players[1].fighter.short} · ${settings.mode === "cpu" ? "CPU" : settings.mode === "training" ? "DUMMY" : "P2"}`;
  $("arena-hint").textContent =
    settings.mode === "local"
      ? "P1 · Q/E/L/R　 P2 · 4/5/3/6"
      : "Q / E 기술 · L 필살기 · R 상호작용";
  canvas.setAttribute(
    "aria-label",
    `${battle.players[0].fighter.name} 대 ${battle.players[1].fighter.name} 대전. 하단 조작 안내를 참고하세요.`,
  );
  announce(
    `대전 시작. ${battle.players[0].fighter.name} 대 ${battle.players[1].fighter.name}. 3판 2선승.`,
  );
  if (matchMedia("(max-width: 800px)").matches)
    $("arena-mode-label").scrollIntoView({
      behavior: reducedMotion ? "instant" : "smooth",
      block: "start",
    });
  sound("fight");
}

function returnToRoster() {
  battle = null;
  keys.clear();
  touches.clear();
  document
    .querySelectorAll(".touch-controls .active")
    .forEach((button) => button.classList.remove("active"));
  document.body.classList.remove("playing");
  lockSettings(false);
  $("preview-overlay").hidden = false;
  $("hud").hidden = true;
  $("game-overlay").hidden = true;
  $("pause-button").hidden = true;
  $("touch-controls").hidden = true;
  $("battle-dashboard").hidden = true;
  $("receipt").hidden = true;
  $("battle-toast").hidden = true;
  $("arena-mode-label").textContent = "FIGHTER PREVIEW";
  $("arena-hint").innerHTML =
    '<span class="key-hint">← →</span> 아래에서 캐릭터를 선택하세요';
  selectFighter(selected);
  document
    .querySelector(`.fighter-card[data-fighter="${selected.id}"]`)
    .focus({ preventScroll: true });
  announce("캐릭터 선택 화면으로 돌아왔습니다.");
}

function pauseMatch(value) {
  if (!battle || battle.phase === "finished") return;
  battle.pause(value);
  keys.clear();
  touches.clear();
  buffers.forEach((b) => {
    for (const key of Object.keys(b)) delete b[key];
  });
  document
    .querySelectorAll(".touch-controls .active")
    .forEach((button) => button.classList.remove("active"));
  if (battle.paused) announce("일시정지. 계속하기 버튼 또는 ESC를 누르세요.");
  else announce("경기를 계속합니다.");
}

$("start-button").addEventListener("click", startMatch);
$("pause-button").addEventListener("click", () => pauseMatch(true));
$("roster-button").addEventListener("click", returnToRoster);
$("continue-button").addEventListener("click", () => {
  if (battle?.phase === "finished") runMatch(lastConfig);
  else pauseMatch(false);
});
$("help-button").addEventListener("click", () => {
  if (battle) pauseMatch(true);
  keys.clear();
  $("help-dialog").showModal();
});
for (const id of ["close-help", "help-done"])
  $(id).addEventListener("click", () => $("help-dialog").close());
$("help-dialog").addEventListener("click", (event) => {
  if (event.target === $("help-dialog")) {
    const r = $("help-dialog").getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      $("help-dialog").close();
  }
});
$("sound-button").addEventListener("click", async () => {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    soundEnabled = !soundEnabled;
    if (soundEnabled) await audio.resume();
    $("sound-button").setAttribute("aria-pressed", String(soundEnabled));
    $("sound-button").setAttribute(
      "aria-label",
      `게임 사운드 ${soundEnabled ? "끄기" : "켜기"}`,
    );
    $("sound-label").textContent = `SOUND ${soundEnabled ? "ON" : "OFF"}`;
    if (soundEnabled) sound("select");
  } catch {
    $("sound-label").textContent = "UNAVAILABLE";
    soundEnabled = false;
    announce("이 브라우저에서 사운드를 사용할 수 없습니다.");
  }
});

const controlCodes = new Set([
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "KeyJ",
  "KeyK",
  "KeyL",
  "KeyQ",
  "KeyE",
  "KeyR",
  "ShiftLeft",
  "ShiftRight",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Numpad1",
  "Numpad2",
  "Numpad3",
  "Numpad4",
  "Numpad5",
  "Numpad6",
]);
window.addEventListener("keydown", (event) => {
  if ($("help-dialog").open || $("codex-dialog").open) return;
  const interactive =
    event.target instanceof Element &&
    event.target.closest("select,button,a,input,textarea") &&
    !event.target.closest(".ability-controls,.touch-controls,.market-strip");
  if (event.code === "Escape" && battle) {
    event.preventDefault();
    if (!event.repeat) pauseMatch();
    return;
  }
  if (!battle) {
    if (interactive) return;
    if (event.code === "Enter") {
      event.preventDefault();
      startMatch();
    } else if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      selectFighter(
        FIGHTERS[
          (FIGHTERS.indexOf(selected) + (event.code === "ArrowRight" ? 1 : 5)) %
            6
        ],
        { announceSelection: true },
      );
    }
    return;
  }
  if (controlCodes.has(event.code) && !interactive) {
    event.preventDefault();
    keys.add(event.code);
    const map = {
      KeyQ: [0, "skill1"],
      KeyE: [0, "skill2"],
      KeyL: [0, "special"],
      KeyR: [0, "interact"],
      KeyJ: [0, "punch"],
      KeyK: [0, "kick"],
      KeyW: [0, "jump"],
      Digit4: [1, "skill1"],
      Digit5: [1, "skill2"],
      Digit3: [1, "special"],
      Digit6: [1, "interact"],
    };
    const action = map[event.code];
    if (action && !event.repeat) buffers[action[0]][action[1]] = 0.18;
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => {
  keys.clear();
  touches.clear();
  if (battle) pauseMatch(true);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && battle) pauseMatch(true);
});

for (const button of document.querySelectorAll("[data-control]")) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    try {
      button.setPointerCapture(event.pointerId);
    } catch {}
    touches.set(event.pointerId, button.dataset.control);
    buffers[0][button.dataset.control] = 0.18;
    button.classList.add("active");
  });
  const release = (event) => {
    touches.delete(event.pointerId);
    if (![...touches.values()].includes(button.dataset.control))
      button.classList.remove("active");
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

function inputs() {
  const touch = new Set(touches.values());
  const result = [
    {
      left: keys.has("KeyA") || touch.has("left"),
      right: keys.has("KeyD") || touch.has("right"),
      jump: keys.has("KeyW") || touch.has("jump"),
      crouch: keys.has("KeyS") || touch.has("crouch") || touch.has("sell"),
      punch: keys.has("KeyJ") || touch.has("punch"),
      kick: keys.has("KeyK") || touch.has("kick"),
      special: keys.has("KeyL"),
      skill1: keys.has("KeyQ"),
      skill2: keys.has("KeyE"),
      interact: keys.has("KeyR") || touch.has("interact") || touch.has("sell"),
      block: keys.has("ShiftLeft") || touch.has("block"),
    },
    {
      left: keys.has("ArrowLeft"),
      right: keys.has("ArrowRight"),
      jump: keys.has("ArrowUp"),
      crouch: keys.has("ArrowDown"),
      punch: keys.has("Digit1") || keys.has("Numpad1"),
      kick: keys.has("Digit2") || keys.has("Numpad2"),
      special: keys.has("Digit3") || keys.has("Numpad3"),
      skill1: keys.has("Digit4") || keys.has("Numpad4"),
      skill2: keys.has("Digit5") || keys.has("Numpad5"),
      interact: keys.has("Digit6") || keys.has("Numpad6"),
      block: keys.has("ShiftRight"),
    },
  ];
  result.forEach((input, i) => {
    for (const key of Object.keys(buffers[i]))
      if (buffers[i][key] > 0) input[key] = true;
    if (input.sell) {
      input.interact = true;
      input.crouch = true;
    }
  });
  return result;
}

function showOverlay(state, eyebrow, title, detail = "", actions = false) {
  const overlay = $("game-overlay");
  overlay.hidden = false;
  overlay.dataset.state = state;
  $("overlay-eyebrow").textContent = eyebrow;
  $("overlay-title").textContent = title;
  $("overlay-detail").textContent = detail;
  $("overlay-actions").hidden = !actions;
}

function updateHud() {
  battle.players.forEach((p, index) => {
    const n = index + 1;
    $(`p${n}-health`).firstElementChild.style.width = `${p.health}%`;
    $(`p${n}-health`).setAttribute("aria-valuenow", String(p.health));
    $(`p${n}-meter`).style.width = `${p.meter}%`;
    $(`p${n}-wins`).textContent =
      `${p.wins >= 1 ? "●" : "○"} ${p.wins >= 2 ? "●" : "○"}`;
    $(`p${n}-meter-label`).textContent =
      p.meter >= 100
        ? `SPECIAL READY${index === 0 ? " · L" : battle.mode === "local" ? " · 3" : ""}`
        : `CHARGING ${Math.floor(p.meter)}%`;
    $(`p${n}-shield`).hidden = p.shield <= 0;
    $(`p${n}-shield`).firstElementChild.style.width =
      `${(p.shield / 22) * 100}%`;
    $(`p${n}-trait`).textContent = traitStatus(p, index);
  });
  $("timer").textContent = String(Math.ceil(battle.time)).padStart(2, "0");
  $("round-label").textContent =
    `ROUND ${String(battle.round).padStart(2, "0")}`;
  if (battle.paused) {
    showOverlay(
      "paused",
      "TAKE A BREATHER",
      "PAUSED",
      "숨을 고르고, 다음 한 방을 생각하세요.",
      true,
    );
    $("continue-button").innerHTML = "계속하기 <span>→</span>";
  } else if (battle.phase === "intro") {
    showOverlay(
      "intro",
      `ROUND ${String(battle.round).padStart(2, "0")} / FIRST TO TWO`,
      battle.phaseTime > 0.6 ? "READY?" : "FIGHT!",
      battle.phaseTime > 0.6
        ? `${battle.players[0].fighter.name} VS ${battle.players[1].fighter.name}`
        : "",
    );
  } else if (battle.phase === "roundEnd") {
    const winner = battle.roundWinner;
    showOverlay(
      "roundEnd",
      winner === null
        ? "EVENLY MATCHED"
        : `${battle.players[winner].fighter.short} WINS THE ROUND`,
      winner === null
        ? "DRAW"
        : battle.players.some((p) => p.health <= 0)
          ? "K.O."
          : "TIME UP",
      winner === null
        ? "무승부! 점수 변동 없이 다음 라운드로."
        : `${battle.players[0].wins} : ${battle.players[1].wins}`,
    );
  } else if (battle.phase === "finished") {
    const winner = battle.players[battle.winner].fighter;
    showOverlay(
      "finished",
      "A NEW CHAMPION",
      `${winner.short} WINS!`,
      `${winner.name} 승리 · ${battle.players[0].wins} : ${battle.players[1].wins}`,
      true,
    );
    $("continue-button").innerHTML = "한 판 더 <span>↗</span>";
    $("pause-button").hidden = true;
    $("touch-controls").hidden = true;
  } else $("game-overlay").hidden = true;
  if (previousPhase !== battle.phase) {
    previousPhase = battle.phase;
    if (battle.phase === "finished") {
      $("continue-button").focus({ preventScroll: true });
      renderReceipt();
    }
  }
  updateDashboard();
}

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.033);
  lastFrame = now;
  tradeUiCooldown = Math.max(0, tradeUiCooldown - dt);
  if (battle) {
    battle.update(dt, inputs());
    buffers.forEach((buffer) => {
      for (const key of Object.keys(buffer)) {
        buffer[key] -= dt;
        if (buffer[key] <= 0) delete buffer[key];
      }
    });
    for (const event of battle.drainEvents()) {
      sound(event.type);
      if (event.type === "fight") announce(`라운드 ${battle.round}. 파이트!`);
      else if (event.type === "roundEnd")
        announce(
          event.winner === null
            ? "라운드 무승부."
            : `${battle.players[event.winner].fighter.name} 라운드 승리. ${battle.players[0].wins} 대 ${battle.players[1].wins}.`,
        );
      else if (event.type === "matchEnd")
        announce(
          `${battle.players[event.winner].fighter.name} 최종 승리! 한 판 더 또는 캐릭터 선택을 누르세요.`,
        );
      else if (event.type === "notice") {
        showToast(event.text);
      } else if (event.type === "discovery") {
        discoveries.add(event.id);
        try {
          localStorage.setItem(
            "bizzare-discoveries",
            JSON.stringify([...discoveries]),
          );
        } catch {}
        renderCodex();
        showToast("NEW DISCOVERY · " + DISCOVERIES[event.id][0]);
        announce(DISCOVERIES[event.id].join(" · "));
      }
    }
    updateHud();
  }
  if (toastLife > 0 && !battle?.paused) {
    toastLife -= dt;
    if (toastLife <= 0) $("battle-toast").hidden = true;
  }
  art.render({
    time: now / 1000,
    stage: battle ? lastConfig.stage : $("stage").value,
    selected,
    battle,
    reducedMotion,
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function traitStatus(p, i) {
  const id = p.fighter.id;
  if (id === "huang")
    return p.jacketLost
      ? "티셔츠 · 이동 +18%"
      : `재킷 방어막 ${Math.ceil(p.shield)}/22`;
  if (id === "musk") return `재사용 부스터 ${p.boosters}/2 · R 회수`;
  if (id === "buffett")
    return battle.world.bagAvailable(i)
      ? "서류가방 · 명령 가능"
      : "가방이 멀다 · 명령 불가";
  if (id === "nietzsche")
    return p.coatTorn
      ? "찢어진 코트 · 마지막 공격 반복"
      : "코트 온전 · 과거 궤적 재생";
  if (id === "plato")
    return `원본 ${battle.world.objects.filter((o) => o.original && o.owner === i).length} · 금빛 테두리 보호`;
  return `질문 ${battle.world.objects.filter((o) => o.kind === "question" && o.owner === i).length}/2 · 왜?`;
}
function showToast(text) {
  $("battle-toast").textContent = text;
  $("battle-toast").hidden = false;
  toastLife = 2.6;
}
function updateDashboard() {
  const w = battle.world;
  if (!$("market-ticker").children.length) {
    $("market-ticker").innerHTML = Object.keys(w.market)
      .map(
        (symbol) =>
          `<span class="quote" data-symbol="${symbol}"><b>${symbol}</b><strong></strong><small></small><span class="trade-buttons"><button data-market="${symbol}" data-sell="false" aria-label="${symbol} 매수">+</button><button data-market="${symbol}" data-sell="true" aria-label="${symbol} 매도">−</button></span></span>`,
      )
      .join("");
  }
  for (const quote of $("market-ticker").children) {
    const symbol = quote.dataset.symbol,
      price = w.market[symbol],
      history = w.marketHistory[symbol],
      up = history.length < 2 || price >= history.at(-2);
    quote.classList.toggle("up", up);
    quote.classList.toggle("down", !up);
    quote.querySelector("strong").textContent = price.toFixed(1);
    quote.querySelector("small").textContent = up ? "↗" : "↘";
    for (const button of quote.querySelectorAll("button"))
      button.disabled =
        battle.paused || battle.phase !== "fight" || tradeUiCooldown > 0;
  }
  const ruleSignature = w.rules
    .map((r) => `${r.kind}:${Math.ceil(r.life)}:${r.warning > 0}`)
    .join("|");
  if ($("active-rules").dataset.state !== ruleSignature) {
    $("active-rules").dataset.state = ruleSignature;
    $("active-rules").innerHTML = w.rules.length
      ? w.rules
          .map(
            (r) =>
              `<span class="rule-chip ${r.warning > 0 ? "warning" : ""}">${r.warning > 0 ? "예고 · " : ""}${RULES[r.kind]} <b>${Math.ceil(r.life)}s</b></span>`,
          )
          .join("")
      : '<span class="no-rule">STANDARD RULES · 새 규칙은 양쪽 모두에게 적용됩니다.</span>';
  }
  for (const button of $("ability-controls").querySelectorAll("button")) {
    const p = battle.players[Number(button.dataset.player)],
      slot = button.dataset.action,
      ready = slot === "special" ? p.meter >= 100 : p.skillCooldowns[slot] <= 0;
    const needsFuel =
      p.fighter.id === "musk" && slot !== "skill2" && p.boosters === 0;
    const needsBag =
      p.fighter.id === "buffett" &&
      !w.bagAvailable(Number(button.dataset.player));
    button.disabled =
      battle.paused ||
      battle.phase !== "fight" ||
      !ready ||
      needsFuel ||
      needsBag ||
      p.stun > 0 ||
      p.cooldown > 0;
    button.querySelector("small").textContent = needsFuel
      ? "R 회수"
      : needsBag
        ? "가방 필요"
        : ready
          ? "READY"
          : slot === "special"
            ? `${Math.floor(p.meter)}%`
            : `${p.skillCooldowns[slot].toFixed(1)}s`;
    button.classList.toggle("ready", ready);
  }
  $("battle-context").textContent =
    `P1 자본 $${Math.floor(battle.players[0].capital)} · R: 회수·회전·입찰·인수 / 물체가 없으면 매수 · S+R 매도`;
}
function renderCodex() {
  $("discovery-count").textContent =
    `${discoveries.size}/${Object.keys(DISCOVERIES).length}`;
  $("codex-list").innerHTML = Object.entries(DISCOVERIES)
    .map(
      ([id, [title, detail]]) =>
        `<article class="codex-entry ${discoveries.has(id) ? "discovered" : ""}"><span>${discoveries.has(id) ? "✦" : "◇"}</span><div><strong>${title}</strong><p>${discoveries.has(id) ? detail : "아직 발견하지 못했습니다. 실험실에서 조합해보세요."}</p></div></article>`,
    )
    .join("");
}
renderCodex();
$("market-ticker").addEventListener("click", (event) => {
  const button = event.target.closest("[data-market]");
  if (
    !button ||
    !battle ||
    battle.paused ||
    battle.phase !== "fight" ||
    tradeUiCooldown > 0
  )
    return;
  battle.world.trade(0, button.dataset.sell === "true", button.dataset.market);
  tradeUiCooldown = 0.45;
});
$("codex-button").addEventListener("click", () => {
  if (battle) pauseMatch(true);
  $("codex-dialog").showModal();
});
$("close-codex").addEventListener("click", () => $("codex-dialog").close());
$("training-reset").addEventListener("click", () => {
  if (battle?.mode === "training") {
    battle.resetRound();
    battle.phase = "fight";
    keys.clear();
    touches.clear();
    buffers.forEach((buffer) => {
      for (const key of Object.keys(buffer)) delete buffer[key];
    });
  }
});
function receiptTitle(p) {
  return p.stats.claims > 0
    ? "냉정한 인수자"
    : p.stats.blocked > 30
      ? "흔들리지 않는 논리"
      : p.stats.misses > p.stats.hits
        ? "가능성을 탐색하는 자"
        : p.stats.trades > 3
          ? "시장의 설계자"
          : "규칙을 깨는 챔피언";
}
function renderReceipt() {
  $("receipt").hidden = false;
  $("receipt-content").innerHTML = battle.players
    .map(
      (p) =>
        `<article><span class="small-label">${p.fighter.en}</span><h3>${receiptTitle(p)}</h3><dl>${[
          ["가한 피해", Math.round(p.stats.damage)],
          ["방어로 절약", p.stats.blocked],
          ["방어막 흡수", p.stats.absorbed],
          ["공격 적중", p.stats.hits],
          ["헛친 공격", p.stats.misses],
          ["기술 사용", p.stats.skills],
          ["기업 인수", p.stats.claims],
          ["주식 거래", p.stats.trades],
        ]
          .map(
            ([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`,
          )
          .join("")}</dl></article>`,
    )
    .join("");
}
$("save-receipt").addEventListener("click", () => {
  if (!battle || battle.phase !== "finished") return;
  const result = document.createElement("canvas");
  result.width = 1000;
  result.height = 670;
  const c = result.getContext("2d");
  c.fillStyle = "#101711";
  c.fillRect(0, 0, 1000, 670);
  c.fillStyle = "#c7f77a";
  c.font = "bold 40px sans-serif";
  c.fillText("BIZZARE BATTLE · FIGHT RECEIPT", 40, 65);
  c.font = "18px sans-serif";
  c.fillStyle = "#b5c6a9";
  c.fillText(
    `${battle.players[battle.winner].fighter.name} 승리 · ${battle.players[0].wins} : ${battle.players[1].wins}`,
    40,
    104,
  );
  battle.players.forEach((p, i) => {
    const x = 40 + i * 490;
    c.fillStyle = p.fighter.color;
    c.font = "bold 27px sans-serif";
    c.fillText(p.fighter.name, x, 170);
    c.font = "17px sans-serif";
    c.fillText(receiptTitle(p), x, 202);
    const lines = [
      ["가한 피해", p.stats.damage],
      ["방어로 절약", p.stats.blocked],
      ["방어막 흡수", p.stats.absorbed],
      ["공격 적중", p.stats.hits],
      ["헛친 공격", p.stats.misses],
      ["기술 사용", p.stats.skills],
      ["기업 인수", p.stats.claims],
      ["주식 거래", p.stats.trades],
    ];
    lines.forEach(([label, value], n) => {
      c.fillStyle = "#c6d0be";
      c.fillText(label, x, 252 + n * 39);
      c.fillStyle = p.fighter.color;
      c.fillText(String(Math.round(value)), x + 330, 252 + n * 39);
    });
  });
  c.fillStyle = "#75886b";
  c.font = "14px monospace";
  c.fillText("THINK. TRADE. FIGHT. REPEAT.", 40, 635);
  result.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "bizzare-battle-receipt.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
});
const helpColumns = document.querySelectorAll(".help-columns dl");
helpColumns[0].insertAdjacentHTML(
  "beforeend",
  "<dt>기술 1 / 기술 2 / 상호작용</dt><dd><kbd>Q</kbd><kbd>E</kbd><kbd>R</kbd></dd>",
);
helpColumns[1].insertAdjacentHTML(
  "beforeend",
  "<dt>기술 1 / 기술 2 / 상호작용</dt><dd><kbd>4</kbd><kbd>5</kbd><kbd>6</kbd></dd>",
);
$("help-dialog")
  .querySelector(".help-tip")
  .insertAdjacentHTML(
    "afterend",
    '<p class="help-tip"><strong>규칙을 바꾸는 기술</strong> · Q/E는 재사용 대기시간, L은 필살기 게이지를 사용합니다. 물체 근처 R로 회수·입찰·회전·지분 매수. 물체가 없으면 주식을 매수하며 S+R은 매도합니다. 가상 주가는 로켓 예약과 발판에 영향을 줍니다. 금빛 원본과 왜? 스위치를 부수면 연결된 효과가 끝납니다.</p>',
  );
