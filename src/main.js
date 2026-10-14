import { FIGHTERS, STAGES, fighterById } from './roster.js';
import { Battle } from './engine.js';
import { ArenaArt, drawCard } from './art.js';

const $ = id => document.getElementById(id);
const canvas = $('arena');
const art = new ArenaArt(canvas);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let selected = FIGHTERS[0];
let battle = null;
let lastConfig = null;
let lastFrame = performance.now();
let previousPhase = '';
let soundEnabled = false;
let audio = null;
const keys = new Set();
const touches = new Map();
const touchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

function tone(frequency, duration = .08, wave = 'square', volume = .035, delay = 0) {
  if (!soundEnabled || !audio || audio.state !== 'running') return;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  const start = audio.currentTime + delay;
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * .55), start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  oscillator.connect(gain); gain.connect(audio.destination);
  oscillator.start(start); oscillator.stop(start + duration + .02);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}

function sound(type) {
  if (type === 'hit') tone(110,.12,'sawtooth',.05);
  else if (type === 'block') tone(370,.055,'triangle',.04);
  else if (type === 'special') { tone(440,.16,'sawtooth',.028);tone(660,.2,'square',.025,.08); }
  else if (type === 'jump') tone(260,.11,'triangle',.03);
  else if (type === 'punch' || type === 'kick') tone(type === 'kick' ? 100 : 170,.045,'triangle',.025);
  else if (type === 'fight' || type === 'matchEnd') [330,440,660].forEach((f,i) => tone(f,.18,'square',.025,i*.12));
  else if (type === 'roundEnd') { tone(150,.3,'sawtooth',.025);tone(80,.4,'triangle',.05,.14); }
  else tone(560,.05,'square',.02);
}

function readPreferences() {
  try {
    const prefs = JSON.parse(localStorage.getItem('bizzare-settings') || '{}');
    selected = fighterById(prefs.player);
    for (const id of ['mode','difficulty','stage']) if ([...$(id).options].some(o => o.value === prefs[id])) $(id).value = prefs[id];
    if (FIGHTERS.some(f => f.id === prefs.opponent)) $('opponent').value = prefs.opponent;
  } catch { /* Storage is optional; a private window can still play. */ }
}

function savePreferences() {
  try { localStorage.setItem('bizzare-settings', JSON.stringify(config())); } catch { /* Keep playing if storage is unavailable. */ }
}

function config() { return { player: selected.id, opponent: $('opponent').value, mode: $('mode').value, difficulty: $('difficulty').value, stage: $('stage').value }; }
function announce(text) { $('live-announcement').textContent = text; }

function selectFighter(fighter, { announceSelection = false } = {}) {
  if (battle) return;
  selected = fighter;
  $('fighter-info').style.setProperty('--fighter-color', fighter.color);
  $('fighter-number').textContent = `${String(FIGHTERS.indexOf(fighter) + 1).padStart(2,'0')} / 06`;
  $('fighter-category').textContent = fighter.category;
  $('fighter-name').textContent = fighter.name;
  $('fighter-en').textContent = fighter.en;
  $('fighter-quote').textContent = `“${fighter.quote}”`;
  $('fighter-class').textContent = fighter.className;
  $('special-name').textContent = fighter.special;
  $('special-description').textContent = fighter.description;
  $('preview-name').replaceChildren(document.createTextNode(fighter.short));
  const category = document.createElement('span');category.textContent = fighter.category;$('preview-name').append(category);
  $('fighter-stats').innerHTML = [['POWER',fighter.power],['SPEED',fighter.speed],['REACH',fighter.reach]].map(([label,value]) => `<div class="stat"><span class="stat-label">${label}</span><span class="stat-blocks">${Array.from({length:5},(_,i) => `<span class="${i<value?'filled':''}"></span>`).join('')}</span><span class="stat-value">${value}</span></div>`).join('');
  document.querySelectorAll('.fighter-card').forEach(button => { const active = button.dataset.fighter === fighter.id;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active)); });
  canvas.setAttribute('aria-label',`${fighter.name}의 픽셀 캐릭터 미리보기. 필살기: ${fighter.special}`);
  if (announceSelection) { announce(`${fighter.name} 선택. 필살기: ${fighter.special}. ${fighter.description}`);sound('select'); }
  savePreferences();
}

for (const [index,fighter] of FIGHTERS.entries()) {
  const button = document.createElement('button');
  button.type = 'button';button.className = 'fighter-card';button.dataset.fighter = fighter.id;
  button.style.setProperty('--card-color', fighter.color);
  button.setAttribute('aria-label',`${fighter.name} · ${fighter.className} · ${fighter.special}`);
  button.innerHTML = `<span class="card-index">${String(index + 1).padStart(2,'0')}</span><div class="card-art"><canvas width="150" height="120" aria-hidden="true"></canvas></div><div class="card-caption"><strong>${fighter.name} <span class="card-arrow" aria-hidden="true">↗</span></strong><span>${fighter.category}</span></div>`;
  drawCard(button.querySelector('canvas'),fighter);
  button.addEventListener('click',() => selectFighter(fighter,{announceSelection:true}));
  $('roster').append(button);
  const option = document.createElement('option');option.value = fighter.id;option.textContent = fighter.name;$('opponent').append(option);
}
$('opponent').value = 'musk';
readPreferences();
selectFighter(selected);

function updateSettings() {
  $('difficulty').disabled = $('mode').value === 'local';
  $('difficulty-setting').style.opacity = $('mode').value === 'local' ? '.4' : '1';
  $('stage-label').textContent = STAGES[$('stage').value];
  savePreferences();
}
for (const id of ['mode','opponent','difficulty','stage']) $(id).addEventListener('change',updateSettings);
updateSettings();

function lockSettings(locked) {
  for (const element of document.querySelectorAll('.fighter-card, .match-settings select, #start-button')) element.disabled = locked;
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
  previousPhase = '';
  keys.clear();touches.clear();
  document.body.classList.add('playing');
  lockSettings(true);
  $('preview-overlay').hidden = true;
  $('hud').hidden = false;
  $('pause-button').hidden = false;
  $('touch-controls').hidden = !touchDevice || settings.mode === 'local';
  $('arena-mode-label').textContent = settings.mode === 'local' ? 'LOCAL · PLAYER VS PLAYER' : 'ARCADE · PLAYER VS CPU';
  $('p1-name').textContent = `${battle.players[0].fighter.short} · P1`;
  $('p2-name').textContent = `${battle.players[1].fighter.short} · ${settings.mode === 'cpu' ? 'CPU' : 'P2'}`;
  $('arena-hint').textContent = settings.mode === 'local' ? 'P1 · WASD / JKL　 P2 · 방향키 / 123' : 'WASD 이동 · J 펀치 · K 킥 · L 필살기';
  canvas.setAttribute('aria-label',`${battle.players[0].fighter.name} 대 ${battle.players[1].fighter.name} 대전. 하단 조작 안내를 참고하세요.`);
  announce(`대전 시작. ${battle.players[0].fighter.name} 대 ${battle.players[1].fighter.name}. 3판 2선승.`);
  if (matchMedia('(max-width: 800px)').matches) $('arena-mode-label').scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'start'});
  sound('fight');
}

function returnToRoster() {
  battle = null;
  keys.clear();touches.clear();
  document.querySelectorAll('.touch-controls .active').forEach(button => button.classList.remove('active'));
  document.body.classList.remove('playing');
  lockSettings(false);
  $('preview-overlay').hidden = false;$('hud').hidden = true;$('game-overlay').hidden = true;
  $('pause-button').hidden = true;$('touch-controls').hidden = true;
  $('arena-mode-label').textContent = 'FIGHTER PREVIEW';
  $('arena-hint').innerHTML = '<span class="key-hint">← →</span> 아래에서 캐릭터를 선택하세요';
  selectFighter(selected);
  document.querySelector(`.fighter-card[data-fighter="${selected.id}"]`).focus({preventScroll:true});
  announce('캐릭터 선택 화면으로 돌아왔습니다.');
}

function pauseMatch(value) {
  if (!battle || battle.phase === 'finished') return;
  battle.pause(value);
  keys.clear();touches.clear();
  document.querySelectorAll('.touch-controls .active').forEach(button => button.classList.remove('active'));
  if (battle.paused) announce('일시정지. 계속하기 버튼 또는 ESC를 누르세요.');
  else announce('경기를 계속합니다.');
}

$('start-button').addEventListener('click',startMatch);
$('pause-button').addEventListener('click',() => pauseMatch(true));
$('roster-button').addEventListener('click',returnToRoster);
$('continue-button').addEventListener('click',() => { if (battle?.phase === 'finished') runMatch(lastConfig); else pauseMatch(false); });
$('help-button').addEventListener('click',() => { if (battle) pauseMatch(true);keys.clear();$('help-dialog').showModal(); });
for (const id of ['close-help','help-done']) $(id).addEventListener('click',() => $('help-dialog').close());
$('help-dialog').addEventListener('click',event => { if (event.target === $('help-dialog')) { const r = $('help-dialog').getBoundingClientRect();if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('help-dialog').close(); } });
$('sound-button').addEventListener('click',async () => {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    soundEnabled = !soundEnabled;
    if (soundEnabled) await audio.resume();
    $('sound-button').setAttribute('aria-pressed',String(soundEnabled));
    $('sound-button').setAttribute('aria-label',`게임 사운드 ${soundEnabled?'끄기':'켜기'}`);
    $('sound-label').textContent = `SOUND ${soundEnabled?'ON':'OFF'}`;
    if (soundEnabled) sound('select');
  } catch { $('sound-label').textContent = 'UNAVAILABLE';soundEnabled=false;announce('이 브라우저에서 사운드를 사용할 수 없습니다.'); }
});

const controlCodes = new Set(['KeyA','KeyD','KeyW','KeyS','KeyJ','KeyK','KeyL','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Digit1','Digit2','Digit3','Numpad1','Numpad2','Numpad3']);
window.addEventListener('keydown',event => {
  if ($('help-dialog').open) return;
  const interactive = event.target instanceof Element && event.target.closest('select,button,a,input,textarea');
  if (event.code === 'Escape' && battle) { event.preventDefault();if(!event.repeat)pauseMatch();return; }
  if (!battle) {
    if (interactive) return;
    if (event.code === 'Enter') { event.preventDefault();startMatch(); }
    else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') { event.preventDefault();selectFighter(FIGHTERS[(FIGHTERS.indexOf(selected)+(event.code==='ArrowRight'?1:5))%6],{announceSelection:true}); }
    return;
  }
  if (controlCodes.has(event.code) && !interactive) { event.preventDefault();keys.add(event.code); }
});
window.addEventListener('keyup',event => keys.delete(event.code));
window.addEventListener('blur',() => { keys.clear();touches.clear();if(battle)pauseMatch(true); });
document.addEventListener('visibilitychange',() => { if(document.hidden && battle)pauseMatch(true); });

for (const button of document.querySelectorAll('[data-control]')) {
  button.addEventListener('pointerdown',event => { event.preventDefault();button.setPointerCapture(event.pointerId);touches.set(event.pointerId,button.dataset.control);button.classList.add('active'); });
  const release = event => { touches.delete(event.pointerId);if(![...touches.values()].includes(button.dataset.control))button.classList.remove('active'); };
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
}

function inputs() {
  const touch = new Set(touches.values());
  return [
    { left:keys.has('KeyA')||touch.has('left'),right:keys.has('KeyD')||touch.has('right'),jump:keys.has('KeyW')||touch.has('jump'),crouch:keys.has('KeyS'),punch:keys.has('KeyJ')||touch.has('punch'),kick:keys.has('KeyK')||touch.has('kick'),special:keys.has('KeyL')||touch.has('special'),block:keys.has('ShiftLeft')||touch.has('block') },
    { left:keys.has('ArrowLeft'),right:keys.has('ArrowRight'),jump:keys.has('ArrowUp'),crouch:keys.has('ArrowDown'),punch:keys.has('Digit1')||keys.has('Numpad1'),kick:keys.has('Digit2')||keys.has('Numpad2'),special:keys.has('Digit3')||keys.has('Numpad3'),block:keys.has('ShiftRight') }
  ];
}

function showOverlay(state, eyebrow, title, detail = '', actions = false) {
  const overlay = $('game-overlay');
  overlay.hidden = false;overlay.dataset.state = state;
  $('overlay-eyebrow').textContent = eyebrow;$('overlay-title').textContent = title;$('overlay-detail').textContent = detail;
  $('overlay-actions').hidden = !actions;
}

function updateHud() {
  battle.players.forEach((p,index) => {
    const n=index+1;
    $(`p${n}-health`).firstElementChild.style.width = `${p.health}%`;
    $(`p${n}-health`).setAttribute('aria-valuenow',String(p.health));
    $(`p${n}-meter`).style.width = `${p.meter}%`;
    $(`p${n}-wins`).textContent = `${p.wins>=1?'●':'○'} ${p.wins>=2?'●':'○'}`;
    $(`p${n}-meter-label`).textContent = p.meter >= 100 ? `SPECIAL READY${index===0?' · L':battle.mode==='local'?' · 3':''}` : `CHARGING ${Math.floor(p.meter)}%`;
  });
  $('timer').textContent = String(Math.ceil(battle.time)).padStart(2,'0');
  $('round-label').textContent = `ROUND ${String(battle.round).padStart(2,'0')}`;
  if (battle.paused) {
    showOverlay('paused','TAKE A BREATHER','PAUSED','숨을 고르고, 다음 한 방을 생각하세요.',true);
    $('continue-button').innerHTML = '계속하기 <span>→</span>';
  } else if (battle.phase === 'intro') {
    showOverlay('intro',`ROUND ${String(battle.round).padStart(2,'0')} / FIRST TO TWO`,battle.phaseTime>.6?'READY?':'FIGHT!',battle.phaseTime>.6?`${battle.players[0].fighter.name} VS ${battle.players[1].fighter.name}`:'');
  } else if (battle.phase === 'roundEnd') {
    const winner = battle.roundWinner;
    showOverlay('roundEnd',winner===null?'EVENLY MATCHED':`${battle.players[winner].fighter.short} WINS THE ROUND`,winner===null?'DRAW':battle.players.some(p=>p.health<=0)?'K.O.':'TIME UP',winner===null?'무승부! 점수 변동 없이 다음 라운드로.':`${battle.players[0].wins} : ${battle.players[1].wins}`);
  } else if (battle.phase === 'finished') {
    const winner = battle.players[battle.winner].fighter;
    showOverlay('finished','A NEW CHAMPION',`${winner.short} WINS!`,`${winner.name} 승리 · ${battle.players[0].wins} : ${battle.players[1].wins}`,true);
    $('continue-button').innerHTML = '한 판 더 <span>↗</span>';
    $('pause-button').hidden = true;
    $('touch-controls').hidden = true;
  } else $('game-overlay').hidden = true;
  if (previousPhase !== battle.phase) {
    previousPhase = battle.phase;
    if (battle.phase === 'finished') $('continue-button').focus({preventScroll:true});
  }
}

function frame(now) {
  const dt=Math.min((now-lastFrame)/1000,.033);lastFrame=now;
  if (battle) {
    battle.update(dt,inputs());
    for (const event of battle.drainEvents()) {
      sound(event.type);
      if(event.type==='fight')announce(`라운드 ${battle.round}. 파이트!`);
      else if(event.type==='roundEnd')announce(event.winner===null?'라운드 무승부.':`${battle.players[event.winner].fighter.name} 라운드 승리. ${battle.players[0].wins} 대 ${battle.players[1].wins}.`);
      else if(event.type==='matchEnd')announce(`${battle.players[event.winner].fighter.name} 최종 승리! 한 판 더 또는 캐릭터 선택을 누르세요.`);
    }
    updateHud();
  }
  art.render({time:now/1000,stage:battle?lastConfig.stage:$('stage').value,selected,battle,reducedMotion});
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
