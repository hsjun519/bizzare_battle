// Settings and records persisted in localStorage (fails silently when blocked).
const KEY = "bizzare-battle:v3";

export const DEFAULT_SETTINGS = {
  sfx: 0.8,
  music: 0.5,
  timer: 99,
  rounds: 2,
  paradigm: true,
  difficulty: "normal",
  shake: true,
  hints: true,
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
}

export function loadSave() {
  const d = read();
  return {
    settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) },
    records: { clears: {}, best: 0, steals: 0, paradigms: [], wins: 0, ...(d.records || {}) },
  };
}

export function persist(save) {
  write({ settings: save.settings, records: save.records });
}
