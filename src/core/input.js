// Unified input: two keyboard clusters, up to two gamepads and touch controls
// are all exposed as "pads" with the same button names. Scenes ask for the
// pads assigned to each player, so the game never cares where input came from.

export const BUTTONS = ["up", "down", "left", "right", "L", "H", "S", "X", "G", "start", "confirm", "back"];

const LAYOUTS = {
  // One player: every cluster drives P1.
  solo: {
    kbA: {
      up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"],
      L: ["KeyJ", "KeyF"], H: ["KeyK", "KeyG"], S: ["KeyL", "KeyH"], X: ["KeyI", "KeyT"], G: ["KeyU", "KeyR"],
      confirm: ["Enter", "Space", "KeyJ", "KeyF"], back: ["Backspace", "KeyK", "KeyG"], start: ["Escape", "KeyP"],
    },
    kbB: {
      up: ["ArrowUp"], down: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"],
      L: ["KeyZ", "Numpad1"], H: ["KeyX", "Numpad2"], S: ["KeyC", "Numpad3"], X: ["KeyV", "Numpad5"], G: ["KeyB", "Numpad4"],
      confirm: ["KeyZ", "NumpadEnter"], back: ["KeyX"], start: [],
    },
  },
  // Shared keyboard: left cluster for P1, arrows + right side for P2.
  versus: {
    kbA: {
      up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"],
      L: ["KeyF"], H: ["KeyG"], S: ["KeyH"], X: ["KeyT"], G: ["KeyR"],
      confirm: ["KeyF", "Space"], back: ["KeyG"], start: ["Escape"],
    },
    kbB: {
      up: ["ArrowUp"], down: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"],
      L: ["Numpad1", "Comma"], H: ["Numpad2", "Period"], S: ["Numpad3", "Slash"], X: ["Numpad5", "Semicolon"], G: ["Numpad4", "Quote"],
      confirm: ["Numpad1", "Comma", "Enter", "NumpadEnter"], back: ["Numpad2", "Period", "Backspace"], start: ["Escape"],
    },
  },
};

export const KEY_HELP = {
  solo: { move: "W A S D / 방향키", L: "J", H: "K", S: "L", X: "I", G: "U", alt: "방향키 사용 시 Z X C V B" },
  p1: { move: "W A S D", L: "F", H: "G", S: "H", X: "T", G: "R" },
  p2: { move: "방향키", L: ", 또는 Num1", H: ". 또는 Num2", S: "/ 또는 Num3", X: "; 또는 Num5", G: "' 또는 Num4" },
};

const GAME_KEYS = new Set(
  Object.values(LAYOUTS).flatMap((l) => Object.values(l).flatMap((m) => Object.values(m).flat())),
);

function emptyState() {
  const s = {};
  for (const b of BUTTONS) s[b] = false;
  return s;
}

export class Pad {
  constructor(name) {
    this.name = name;
    this.held = emptyState();
    this.prev = emptyState();
    this.pressed = emptyState();
    this.repeat = {};
    this.lastActive = -1;
  }
  commit(next, frame) {
    for (const b of BUTTONS) {
      this.prev[b] = this.held[b];
      this.held[b] = Boolean(next[b]);
      this.pressed[b] = this.held[b] && !this.prev[b];
      if (this.pressed[b]) this.lastActive = frame;
    }
    // Auto repeat for menu navigation.
    for (const d of ["up", "down", "left", "right"]) {
      if (this.held[d]) this.repeat[d] = (this.repeat[d] || 0) + 1;
      else this.repeat[d] = 0;
    }
  }
  nav(dir) {
    const r = this.repeat[dir] || 0;
    return r === 1 || (r > 22 && r % 6 === 0);
  }
}

export class Input {
  constructor(target = window) {
    this.layout = "solo";
    this.keys = new Set();
    this.tapped = new Set(); // pressed and released between polls still count
    this.frame = 0;
    this.pads = {
      kbA: new Pad("kbA"),
      kbB: new Pad("kbB"),
      gp0: new Pad("gp0"),
      gp1: new Pad("gp1"),
      touch: new Pad("touch"),
    };
    this.touchState = emptyState();
    this.anyPressed = false;
    this.lastDevice = "keyboard";
    this.pointer = { x: 0, y: 0, down: false, pressed: false, released: false, moved: false };
    this.pointerQueue = [];
    this.textHandlers = new Set();
    if (typeof target.addEventListener === "function") this.attach(target);
  }

  attach(target) {
    target.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (GAME_KEYS.has(e.code) || e.code === "KeyM") e.preventDefault();
      if (!e.repeat) {
        this.keys.add(e.code);
        this.tapped.add(e.code);
        this.lastDevice = "keyboard";
      }
      for (const h of this.textHandlers) h(e);
    });
    target.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
    target.addEventListener("blur", () => this.keys.clear());
  }

  bindPointer(canvas, toLogical) {
    const update = (e, kind) => {
      const p = toLogical(e.clientX, e.clientY);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointerQueue.push({ kind, x: p.x, y: p.y, id: e.pointerId, type: e.pointerType });
    };
    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      if (e.pointerType === "touch") this.lastDevice = "touch";
      else if (this.lastDevice === "touch") this.lastDevice = "mouse";
      update(e, "down");
    });
    canvas.addEventListener("pointermove", (e) => update(e, "move"));
    canvas.addEventListener("pointerup", (e) => update(e, "up"));
    canvas.addEventListener("pointercancel", (e) => update(e, "up"));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  setLayout(layout) {
    this.layout = layout;
  }

  keyState(map) {
    const s = emptyState();
    for (const b of BUTTONS) {
      const codes = map[b] || [];
      s[b] = codes.some((c) => this.keys.has(c) || this.tapped.has(c));
    }
    return s;
  }

  gamepadState(index) {
    const s = emptyState();
    const list = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = list && list[index];
    if (!gp || !gp.connected) return s;
    const b = (i) => Boolean(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const ax = gp.axes[0] || 0;
    const ay = gp.axes[1] || 0;
    s.left = b(14) || ax < -0.45;
    s.right = b(15) || ax > 0.45;
    s.up = b(12) || ay < -0.55 || b(0);
    s.down = b(13) || ay > 0.55;
    s.L = b(2);
    s.H = b(3);
    s.S = b(1);
    s.X = b(5) || b(7);
    s.G = b(4) || b(6);
    s.start = b(9) || b(8);
    s.confirm = b(0) || b(2);
    s.back = b(1);
    if (BUTTONS.some((k) => s[k])) this.lastDevice = "gamepad";
    return s;
  }

  poll() {
    this.frame++;
    const layout = LAYOUTS[this.layout];
    this.pads.kbA.commit(this.keyState(layout.kbA), this.frame);
    this.pads.kbB.commit(this.keyState(layout.kbB), this.frame);
    this.pads.gp0.commit(this.gamepadState(0), this.frame);
    this.pads.gp1.commit(this.gamepadState(1), this.frame);
    this.pads.touch.commit(this.touchState, this.frame);
    this.codes = new Set(this.tapped);
    this.tapped.clear();
    // Pointer: collapse the queued events into this frame's state.
    this.pointer.pressed = false;
    this.pointer.released = false;
    this.pointer.moved = false;
    const q = this.pointerQueue;
    this.pointerQueue = [];
    for (const ev of q) {
      if (ev.kind === "down") {
        this.pointer.down = true;
        this.pointer.pressed = true;
        this.pointer.pressX = ev.x;
        this.pointer.pressY = ev.y;
      } else if (ev.kind === "up") {
        this.pointer.down = false;
        this.pointer.released = true;
      } else this.pointer.moved = true;
    }
    this.anyPressed =
      Object.values(this.pads).some((p) => BUTTONS.some((b) => p.pressed[b])) || this.pointer.pressed;
  }

  // Pads that drive a given player for the current layout.
  padsFor(player) {
    const p = this.pads;
    if (this.layout === "solo") return player === 0 ? [p.kbA, p.kbB, p.gp0, p.gp1, p.touch] : [];
    return player === 0 ? [p.kbA, p.gp0, p.touch] : [p.kbB, p.gp1];
  }

  // Merge several pads into one control snapshot for the fighter.
  controls(player) {
    const held = emptyState();
    const pressed = emptyState();
    for (const pad of this.padsFor(player)) {
      for (const b of BUTTONS) {
        held[b] = held[b] || pad.held[b];
        pressed[b] = pressed[b] || pad.pressed[b];
      }
    }
    return { held, pressed };
  }

  // Menu helpers: any pad of the player (or every pad when player is null).
  menu(player = null) {
    const pads = player === null ? Object.values(this.pads) : this.padsFor(player);
    const out = { up: false, down: false, left: false, right: false, confirm: false, back: false, start: false };
    for (const pad of pads) {
      for (const d of ["up", "down", "left", "right"]) out[d] = out[d] || pad.nav(d);
      out.confirm = out.confirm || pad.pressed.confirm;
      out.back = out.back || pad.pressed.back;
      out.start = out.start || pad.pressed.start;
    }
    return out;
  }

  pressedCode(code) {
    return this.keys.has(code);
  }

  // True only on the poll where the key went down.
  tappedCode(code) {
    return Boolean(this.codes && this.codes.has(code));
  }
}
