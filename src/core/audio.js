// Everything you hear is synthesised at runtime with Web Audio:
// a tiny tracker for the soundtrack plus a library of punchy sound effects.
import { SONGS } from "./songs.js";

const NOTE_INDEX = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

export function noteToFreq(name) {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(name);
  if (!m) return 0;
  const midi = 12 * (Number(m[2]) + 1) + NOTE_INDEX[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Turn the compact song notation into per-step events.
export function compileSong(song) {
  const tracks = song.tracks.map((t) => {
    const div = t.div || 1;
    const events = [];
    let last = null;
    t.bars.forEach((bar, b) => {
      const tokens = bar.trim().split(/\s+/);
      tokens.forEach((tok, i) => {
        const step = b * 16 + i * div;
        if (tok === "-") {
          if (last) last.len += div;
          return;
        }
        if (tok === "." || tok === "") {
          last = null;
          return;
        }
        let vel = 1;
        let body = tok;
        if (body.endsWith("!")) {
          vel = 1.35;
          body = body.slice(0, -1);
        } else if (body.endsWith("?")) {
          vel = 0.6;
          body = body.slice(0, -1);
        }
        const ev = { step, len: div, vel, notes: body.split("+"), raw: body };
        events.push(ev);
        last = ev;
      });
    });
    const length = t.bars.length * 16;
    const byStep = new Map();
    for (const ev of events) {
      if (!byStep.has(ev.step)) byStep.set(ev.step, []);
      byStep.get(ev.step).push(ev);
    }
    return { ...t, length, byStep };
  });
  const length = Math.max(...tracks.map((t) => t.length));
  return { ...song, tracks, length };
}

const COMPILED = {};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxVolume = 0.8;
    this.musicVolume = 0.55;
    this.muted = false;
    this.song = null;
    this.songName = null;
    this.timer = null;
    this.lastPlay = {};
  }

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 4;
      this.comp.attack.value = 0.004;
      this.comp.release.value = 0.2;
      this.master.connect(this.comp).connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      // Shared echo for leads and big hits.
      this.delay = ctx.createDelay(1);
      this.delay.delayTime.value = 0.27;
      this.delayFb = ctx.createGain();
      this.delayFb.gain.value = 0.28;
      this.delayTone = ctx.createBiquadFilter();
      this.delayTone.type = "lowpass";
      this.delayTone.frequency.value = 2400;
      this.delay.connect(this.delayTone).connect(this.delayFb).connect(this.delay);
      this.delayTone.connect(this.musicBus);
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      this.timer = setInterval(() => this.tick(), 25);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 0.9, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.55, t, 0.05);
  }

  setVolumes(sfx, music) {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    this.applyVolumes();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.applyVolumes();
    return this.muted;
  }

  // ---------- primitives ----------
  osc({ type = "square", freq = 440, freqEnd = null, dur = 0.1, vol = 0.2, attack = 0.002, when = 0, out = this.sfxBus, detune = 0, curve = "exp", filter = null, q = 1, filterEnd = null }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    if (freqEnd) {
      if (curve === "exp") o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
      else o.frequency.linearRampToValueAtTime(freqEnd, t + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter;
      f.frequency.setValueAtTime(freq * 2, t);
      f.Q.value = q;
      if (filterEnd) f.frequency.exponentialRampToValueAtTime(filterEnd, t + dur);
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
    return o;
  }

  noise({ dur = 0.1, vol = 0.2, type = "bandpass", freq = 1000, freqEnd = null, q = 1, when = 0, attack = 0.002, out = this.sfxBus }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // ---------- sound effects ----------
  play(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // Avoid stacking the identical sound in the same instant.
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.025) return;
    this.lastPlay[name] = now;
    const fn = SFX[name];
    if (fn) fn(this, opts);
  }

  // ---------- music ----------
  playSong(name) {
    if (this.songName === name) return;
    this.songName = name;
    if (!name || !SONGS[name]) {
      this.song = null;
      return;
    }
    COMPILED[name] = COMPILED[name] || compileSong(SONGS[name]);
    this.song = COMPILED[name];
    this.step = 0;
    this.nextTime = this.ctx ? this.ctx.currentTime + 0.08 : 0;
  }

  stopSong() {
    this.songName = null;
    this.song = null;
  }

  tick() {
    if (!this.ctx || !this.song) return;
    const ctx = this.ctx;
    const stepDur = 60 / this.song.bpm / 4;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.14) {
      this.scheduleStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur * (this.step % 2 === 0 ? 1 + (this.song.swing || 0) : 1 - (this.song.swing || 0));
      this.step++;
      if (!this.song.loop && this.step >= this.song.length) {
        this.song = null;
        this.songName = null;
        return;
      }
    }
  }

  scheduleStep(step, time, stepDur) {
    for (const tr of this.song.tracks) {
      const local = step % tr.length;
      const evs = tr.byStep.get(local);
      if (!evs) continue;
      for (const ev of evs) {
        const dur = ev.len * stepDur;
        for (const n of ev.notes) INSTRUMENTS[tr.inst]?.(this, n, time, dur, ev.vel * (tr.vol || 1));
      }
    }
  }
}

// ---------- instruments ----------
function env(g, t, vol, attack, dur, release = 0.05) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
  g.gain.setValueAtTime(Math.max(0.0002, vol), t + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
}

function voice(a, { type, freq, t, dur, vol, attack = 0.005, release = 0.05, cutoff = null, cutoffEnd = null, q = 1, detune = 0, send = 0, vibrato = 0 }) {
  const ctx = a.ctx;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.value = detune;
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 5.6;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(freq * vibrato, t + Math.min(0.25, dur));
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + release + 0.05);
  }
  const g = ctx.createGain();
  env(g, t, vol, attack, dur, release);
  let node = o;
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = q;
    f.frequency.setValueAtTime(cutoff, t);
    if (cutoffEnd) f.frequency.exponentialRampToValueAtTime(cutoffEnd, t + Math.min(dur, 0.4));
    o.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(a.musicBus);
  if (send) {
    const s = ctx.createGain();
    s.gain.value = send;
    g.connect(s).connect(a.delay);
  }
  o.start(t);
  o.stop(t + dur + release + 0.05);
}

function drumNoise(a, t, { dur, vol, type, freq, q = 1 }) {
  const ctx = a.ctx;
  const src = ctx.createBufferSource();
  src.buffer = a.noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.musicBus);
  src.start(t, Math.random() * 0.4);
  src.stop(t + dur + 0.02);
}

function drumTone(a, t, { f0, f1, dur, vol, type = "sine" }) {
  const ctx = a.ctx;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.musicBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const INSTRUMENTS = {
  bass(a, n, t, dur, vel) {
    const f = noteToFreq(n);
    voice(a, { type: "sawtooth", freq: f, t, dur: Math.max(0.06, dur * 0.92), vol: 0.2 * vel, cutoff: 1400, cutoffEnd: 260, q: 4 });
    voice(a, { type: "square", freq: f / 2, t, dur: Math.max(0.06, dur * 0.92), vol: 0.08 * vel, cutoff: 500 });
  },
  slap(a, n, t, dur, vel) {
    const f = noteToFreq(n);
    voice(a, { type: "square", freq: f, t, dur: Math.max(0.05, dur * 0.7), vol: 0.17 * vel, cutoff: 2600, cutoffEnd: 300, q: 6, release: 0.03 });
  },
  sub(a, n, t, dur, vel) {
    voice(a, { type: "triangle", freq: noteToFreq(n), t, dur: dur * 0.95, vol: 0.32 * vel, release: 0.04 });
  },
  lead(a, n, t, dur, vel) {
    const f = noteToFreq(n);
    voice(a, { type: "square", freq: f, t, dur, vol: 0.075 * vel, attack: 0.01, cutoff: 3200, vibrato: 0.006, send: 0.35, release: 0.08 });
    voice(a, { type: "sawtooth", freq: f, t, dur, vol: 0.045 * vel, attack: 0.01, detune: 9, cutoff: 2600, send: 0.2, release: 0.08 });
  },
  brass(a, n, t, dur, vel) {
    const f = noteToFreq(n);
    voice(a, { type: "sawtooth", freq: f, t, dur, vol: 0.07 * vel, attack: 0.03, cutoff: 600, cutoffEnd: 2400, q: 2, send: 0.15 });
    voice(a, { type: "sawtooth", freq: f, t, dur, vol: 0.05 * vel, attack: 0.03, detune: -12, cutoff: 1800 });
  },
  arp(a, n, t, dur, vel) {
    voice(a, { type: "square", freq: noteToFreq(n), t, dur: Math.min(dur, 0.09), vol: 0.05 * vel, release: 0.03, cutoff: 3800, send: 0.25 });
  },
  pluck(a, n, t, dur, vel) {
    const f = noteToFreq(n);
    voice(a, { type: "triangle", freq: f, t, dur: Math.min(0.35, dur), vol: 0.13 * vel, attack: 0.002, release: 0.25, send: 0.3 });
    voice(a, { type: "square", freq: f * 2, t, dur: 0.04, vol: 0.03 * vel, release: 0.06, cutoff: 2000 });
  },
  pad(a, n, t, dur, vel) {
    const f = noteToFreq(n);
    for (const d of [-8, 7]) voice(a, { type: "sawtooth", freq: f, t, dur, vol: 0.022 * vel, attack: 0.18, release: 0.3, detune: d, cutoff: 1100 });
  },
  bell(a, n, t, dur, vel) {
    const f = noteToFreq(n);
    voice(a, { type: "sine", freq: f, t, dur: Math.min(dur, 0.6), vol: 0.09 * vel, attack: 0.002, release: 0.5, send: 0.4 });
    voice(a, { type: "sine", freq: f * 2.76, t, dur: 0.08, vol: 0.03 * vel, release: 0.2 });
  },
  kick(a, n, t, dur, vel) {
    drumTone(a, t, { f0: 160, f1: 42, dur: 0.22, vol: 0.55 * vel });
    drumNoise(a, t, { dur: 0.02, vol: 0.12 * vel, type: "highpass", freq: 3000 });
  },
  snare(a, n, t, dur, vel) {
    drumNoise(a, t, { dur: 0.16, vol: 0.28 * vel, type: "bandpass", freq: 1900, q: 0.7 });
    drumTone(a, t, { f0: 240, f1: 150, dur: 0.08, vol: 0.18 * vel, type: "triangle" });
  },
  clap(a, n, t, dur, vel) {
    for (let i = 0; i < 3; i++) drumNoise(a, t + i * 0.011, { dur: 0.09, vol: 0.16 * vel, type: "bandpass", freq: 1400, q: 1.4 });
  },
  hat(a, n, t, dur, vel) {
    drumNoise(a, t, { dur: 0.035, vol: 0.09 * vel, type: "highpass", freq: 7500 });
  },
  ohat(a, n, t, dur, vel) {
    drumNoise(a, t, { dur: 0.2, vol: 0.07 * vel, type: "highpass", freq: 6500 });
  },
  tom(a, n, t, dur, vel) {
    drumTone(a, t, { f0: noteToFreq(n === "x" || n === "X" ? "G3" : n) || 200, f1: 70, dur: 0.25, vol: 0.32 * vel });
  },
  crash(a, n, t, dur, vel) {
    drumNoise(a, t, { dur: 1.1, vol: 0.12 * vel, type: "highpass", freq: 4200 });
  },
};

// ---------- sfx library ----------
const SFX = {
  ui_move: (a) => a.osc({ type: "square", freq: 880, dur: 0.05, vol: 0.06, filter: "lowpass" }),
  ui_ok: (a) => {
    a.osc({ type: "square", freq: 660, dur: 0.06, vol: 0.08 });
    a.osc({ type: "square", freq: 990, dur: 0.12, vol: 0.08, when: 0.06 });
  },
  ui_back: (a) => a.osc({ type: "square", freq: 520, freqEnd: 300, dur: 0.12, vol: 0.07 }),
  ui_start: (a) => {
    [523, 659, 784, 1046].forEach((f, i) => a.osc({ type: "square", freq: f, dur: 0.14, vol: 0.08, when: i * 0.06 }));
    a.noise({ dur: 0.5, vol: 0.12, type: "highpass", freq: 3000, when: 0.2 });
  },
  ui_lock: (a) => {
    a.osc({ type: "sawtooth", freq: 180, freqEnd: 90, dur: 0.25, vol: 0.18, filter: "lowpass" });
    a.noise({ dur: 0.18, vol: 0.18, freq: 2400 });
    a.osc({ type: "square", freq: 1320, dur: 0.1, vol: 0.05, when: 0.04 });
  },
  whiff_l: (a) => a.noise({ dur: 0.09, vol: 0.09, type: "bandpass", freq: 1800, freqEnd: 900, q: 1.5 }),
  whiff_h: (a) => a.noise({ dur: 0.16, vol: 0.13, type: "bandpass", freq: 1100, freqEnd: 400, q: 1.2 }),
  hit_l: (a) => {
    a.noise({ dur: 0.07, vol: 0.32, type: "bandpass", freq: 2200, q: 0.8 });
    a.osc({ type: "sine", freq: 180, freqEnd: 70, dur: 0.1, vol: 0.4 });
  },
  hit_h: (a) => {
    a.noise({ dur: 0.16, vol: 0.4, type: "lowpass", freq: 3000, freqEnd: 600 });
    a.osc({ type: "sine", freq: 140, freqEnd: 45, dur: 0.22, vol: 0.6 });
    a.osc({ type: "square", freq: 90, freqEnd: 40, dur: 0.12, vol: 0.12, filter: "lowpass" });
  },
  hit_special: (a) => {
    SFX.hit_h(a);
    a.noise({ dur: 0.3, vol: 0.18, type: "highpass", freq: 2500, freqEnd: 900 });
  },
  hit_super: (a) => {
    a.osc({ type: "sine", freq: 120, freqEnd: 30, dur: 0.5, vol: 0.7 });
    a.noise({ dur: 0.45, vol: 0.45, type: "lowpass", freq: 4000, freqEnd: 300 });
    a.osc({ type: "sawtooth", freq: 300, freqEnd: 60, dur: 0.3, vol: 0.12, filter: "lowpass" });
  },
  counter: (a) => {
    a.osc({ type: "square", freq: 1200, freqEnd: 1800, dur: 0.12, vol: 0.08 });
    a.osc({ type: "square", freq: 1800, dur: 0.16, vol: 0.06, when: 0.08 });
  },
  block: (a) => {
    a.osc({ type: "square", freq: 1500, freqEnd: 900, dur: 0.07, vol: 0.09 });
    a.osc({ type: "triangle", freq: 2400, dur: 0.12, vol: 0.06 });
    a.noise({ dur: 0.06, vol: 0.16, type: "highpass", freq: 4000 });
  },
  jump: (a) => a.noise({ dur: 0.1, vol: 0.06, type: "bandpass", freq: 900, freqEnd: 1600 }),
  land: (a) => {
    a.osc({ type: "sine", freq: 110, freqEnd: 50, dur: 0.08, vol: 0.2 });
    a.noise({ dur: 0.06, vol: 0.06, type: "lowpass", freq: 700 });
  },
  dash: (a) => a.noise({ dur: 0.2, vol: 0.12, type: "bandpass", freq: 600, freqEnd: 2200, q: 0.8 }),
  grab: (a) => {
    a.noise({ dur: 0.08, vol: 0.2, freq: 1200 });
    a.osc({ type: "square", freq: 220, freqEnd: 330, dur: 0.08, vol: 0.06 });
  },
  throw: (a) => {
    a.noise({ dur: 0.3, vol: 0.2, type: "bandpass", freq: 500, freqEnd: 1600 });
  },
  tech: (a) => {
    a.osc({ type: "square", freq: 1000, dur: 0.06, vol: 0.08 });
    a.osc({ type: "square", freq: 1500, dur: 0.1, vol: 0.08, when: 0.05 });
  },
  knockdown: (a) => {
    a.osc({ type: "sine", freq: 90, freqEnd: 35, dur: 0.3, vol: 0.5 });
    a.noise({ dur: 0.25, vol: 0.18, type: "lowpass", freq: 900, freqEnd: 200 });
  },
  ko: (a) => {
    a.osc({ type: "sine", freq: 80, freqEnd: 25, dur: 1.2, vol: 0.8 });
    a.noise({ dur: 1.3, vol: 0.4, type: "lowpass", freq: 3000, freqEnd: 120 });
    a.osc({ type: "sawtooth", freq: 220, freqEnd: 55, dur: 0.9, vol: 0.12, filter: "lowpass" });
  },
  announce: (a) => {
    a.osc({ type: "sawtooth", freq: 110, dur: 0.5, vol: 0.12, filter: "lowpass", filterEnd: 3000 });
    a.osc({ type: "sawtooth", freq: 165, dur: 0.5, vol: 0.1, filter: "lowpass", filterEnd: 3000 });
    a.noise({ dur: 0.6, vol: 0.12, type: "highpass", freq: 5000 });
  },
  fight: (a) => {
    a.osc({ type: "sawtooth", freq: 220, freqEnd: 440, dur: 0.25, vol: 0.14, filter: "lowpass", filterEnd: 4000 });
    a.osc({ type: "square", freq: 880, dur: 0.3, vol: 0.06, when: 0.1 });
    a.noise({ dur: 0.8, vol: 0.2, type: "highpass", freq: 3500, when: 0.05 });
    a.osc({ type: "sine", freq: 120, freqEnd: 40, dur: 0.4, vol: 0.5 });
  },
  super_flash: (a) => {
    a.osc({ type: "sawtooth", freq: 200, freqEnd: 1600, dur: 0.45, vol: 0.12, filter: "lowpass", filterEnd: 5000 });
    a.osc({ type: "square", freq: 1760, dur: 0.4, vol: 0.05, when: 0.15 });
    a.noise({ dur: 0.6, vol: 0.2, type: "highpass", freq: 2000, freqEnd: 8000 });
  },
  meter: (a) => {
    a.osc({ type: "square", freq: 784, dur: 0.07, vol: 0.05 });
    a.osc({ type: "square", freq: 1175, dur: 0.12, vol: 0.05, when: 0.07 });
  },
  tick: (a) => a.osc({ type: "square", freq: 1400, dur: 0.03, vol: 0.04 }),
  laser: (a) => {
    a.osc({ type: "sawtooth", freq: 1800, freqEnd: 200, dur: 0.35, vol: 0.1, filter: "lowpass", filterEnd: 900 });
    a.osc({ type: "square", freq: 2400, freqEnd: 600, dur: 0.2, vol: 0.05 });
  },
  beam: (a) => {
    a.osc({ type: "sawtooth", freq: 110, dur: 1.4, vol: 0.18, filter: "lowpass", filterEnd: 6000 });
    a.osc({ type: "sawtooth", freq: 113, dur: 1.4, vol: 0.14 });
    a.noise({ dur: 1.4, vol: 0.2, type: "bandpass", freq: 1500, freqEnd: 600 });
  },
  chip: (a) => {
    a.osc({ type: "square", freq: 1200, freqEnd: 2400, dur: 0.12, vol: 0.07 });
    a.osc({ type: "square", freq: 600, dur: 0.06, vol: 0.05, when: 0.05 });
  },
  spin: (a) => {
    for (let i = 0; i < 4; i++) a.noise({ dur: 0.08, vol: 0.12, type: "bandpass", freq: 1400, freqEnd: 700, when: i * 0.07 });
  },
  fan: (a) => a.noise({ dur: 0.5, vol: 0.16, type: "bandpass", freq: 300, freqEnd: 2600, q: 2 }),
  coin: (a) => {
    a.osc({ type: "square", freq: 988, dur: 0.07, vol: 0.07 });
    a.osc({ type: "square", freq: 1319, dur: 0.22, vol: 0.07, when: 0.07 });
  },
  rocket: (a) => {
    a.noise({ dur: 1.0, vol: 0.32, type: "lowpass", freq: 800, freqEnd: 250 });
    a.osc({ type: "sawtooth", freq: 60, freqEnd: 120, dur: 1.0, vol: 0.14, filter: "lowpass" });
  },
  drill: (a) => {
    a.osc({ type: "sawtooth", freq: 90, freqEnd: 160, dur: 0.5, vol: 0.12, filter: "lowpass", filterEnd: 900 });
    a.noise({ dur: 0.5, vol: 0.18, type: "bandpass", freq: 500, q: 3 });
  },
  boost: (a) => a.noise({ dur: 0.45, vol: 0.25, type: "bandpass", freq: 400, freqEnd: 1800, q: 0.7 }),
  soda: (a) => {
    a.noise({ dur: 0.5, vol: 0.2, type: "highpass", freq: 3000, freqEnd: 7000 });
    a.osc({ type: "sine", freq: 300, freqEnd: 900, dur: 0.12, vol: 0.08 });
  },
  pop: (a) => a.osc({ type: "sine", freq: 500, freqEnd: 1400, dur: 0.06, vol: 0.12 }),
  bull: (a) => {
    a.osc({ type: "sawtooth", freq: 160, freqEnd: 70, dur: 0.7, vol: 0.2, filter: "lowpass" });
    for (let i = 0; i < 6; i++) a.osc({ type: "sine", freq: 70, freqEnd: 40, dur: 0.12, vol: 0.4, when: i * 0.13 });
  },
  book: (a) => {
    a.noise({ dur: 0.3, vol: 0.2, type: "bandpass", freq: 1200, freqEnd: 400 });
  },
  slam: (a) => {
    a.osc({ type: "sine", freq: 70, freqEnd: 28, dur: 0.6, vol: 0.7 });
    a.noise({ dur: 0.5, vol: 0.35, type: "lowpass", freq: 1500, freqEnd: 150 });
  },
  question: (a) => {
    a.osc({ type: "sine", freq: 500, freqEnd: 900, dur: 0.12, vol: 0.12, curve: "lin" });
    a.osc({ type: "sine", freq: 900, freqEnd: 650, dur: 0.12, vol: 0.1, when: 0.12 });
  },
  buzz: (a) => a.osc({ type: "sawtooth", freq: 220, freqEnd: 260, dur: 0.4, vol: 0.06, filter: "bandpass", q: 6 }),
  cube: (a) => {
    a.osc({ type: "triangle", freq: 660, dur: 0.18, vol: 0.12 });
    a.osc({ type: "triangle", freq: 990, dur: 0.18, vol: 0.08, when: 0.04 });
  },
  teleport: (a) => {
    a.osc({ type: "sine", freq: 1600, freqEnd: 200, dur: 0.25, vol: 0.12 });
    a.osc({ type: "sine", freq: 200, freqEnd: 1600, dur: 0.25, vol: 0.1, when: 0.22 });
  },
  pillar: (a) => {
    a.noise({ dur: 0.4, vol: 0.3, type: "lowpass", freq: 600, freqEnd: 180 });
    a.osc({ type: "square", freq: 70, freqEnd: 140, dur: 0.25, vol: 0.12, filter: "lowpass" });
  },
  hammer: (a) => {
    a.osc({ type: "sine", freq: 100, freqEnd: 30, dur: 0.4, vol: 0.6 });
    a.noise({ dur: 0.25, vol: 0.3, type: "bandpass", freq: 800, freqEnd: 200 });
    a.osc({ type: "square", freq: 2200, freqEnd: 1500, dur: 0.1, vol: 0.05 });
  },
  roar: (a) => {
    a.osc({ type: "sawtooth", freq: 120, freqEnd: 80, dur: 1.0, vol: 0.2, filter: "lowpass", filterEnd: 600 });
    a.osc({ type: "sawtooth", freq: 123, freqEnd: 82, dur: 1.0, vol: 0.18, filter: "lowpass" });
    a.noise({ dur: 1.0, vol: 0.2, type: "bandpass", freq: 600, q: 0.6 });
  },
  power: (a) => {
    a.osc({ type: "sawtooth", freq: 110, freqEnd: 440, dur: 0.6, vol: 0.12, filter: "lowpass", filterEnd: 4000 });
    a.noise({ dur: 0.6, vol: 0.18, type: "highpass", freq: 1500, freqEnd: 6000 });
  },
  lantern: (a) => {
    a.osc({ type: "sine", freq: 1320, dur: 0.3, vol: 0.06 });
    a.osc({ type: "sine", freq: 1980, dur: 0.3, vol: 0.04, when: 0.05 });
    a.noise({ dur: 0.2, vol: 0.12, type: "highpass", freq: 3000 });
  },
  barrel: (a) => {
    for (let i = 0; i < 5; i++) a.osc({ type: "sine", freq: 130, freqEnd: 80, dur: 0.1, vol: 0.25, when: i * 0.09 });
    a.noise({ dur: 0.5, vol: 0.12, type: "lowpass", freq: 500 });
  },
  dog: (a) => {
    a.osc({ type: "sawtooth", freq: 520, freqEnd: 300, dur: 0.09, vol: 0.12, filter: "bandpass", q: 3 });
    a.osc({ type: "sawtooth", freq: 560, freqEnd: 320, dur: 0.1, vol: 0.12, filter: "bandpass", q: 3, when: 0.16 });
  },
  chicken: (a) => {
    for (let i = 0; i < 3; i++) a.osc({ type: "square", freq: 700 + i * 120, freqEnd: 500, dur: 0.07, vol: 0.06, when: i * 0.08, filter: "bandpass", q: 4 });
  },
  explosion: (a) => {
    a.noise({ dur: 0.7, vol: 0.4, type: "lowpass", freq: 2000, freqEnd: 100 });
    a.osc({ type: "sine", freq: 90, freqEnd: 25, dur: 0.6, vol: 0.6 });
  },
  armor: (a) => {
    a.osc({ type: "square", freq: 300, freqEnd: 200, dur: 0.15, vol: 0.1 });
    a.osc({ type: "triangle", freq: 1800, dur: 0.2, vol: 0.07 });
  },
  parry: (a) => {
    a.osc({ type: "triangle", freq: 1760, dur: 0.3, vol: 0.12 });
    a.osc({ type: "triangle", freq: 2637, dur: 0.3, vol: 0.08, when: 0.03 });
    a.noise({ dur: 0.1, vol: 0.2, type: "highpass", freq: 5000 });
  },
  cheer: (a) => {
    for (let i = 0; i < 6; i++) a.noise({ dur: 0.6, vol: 0.05, type: "bandpass", freq: 800 + i * 230, q: 3, when: i * 0.04 });
  },
  perfect: (a) => {
    [784, 988, 1175, 1568].forEach((f, i) => a.osc({ type: "triangle", freq: f, dur: 0.25, vol: 0.1, when: i * 0.08 }));
  },
};
