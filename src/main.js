// Boot: canvas scaling, the fixed 60 Hz loop and scene switching.
import { Input } from "./core/input.js";
import { AudioEngine } from "./core/audio.js";
import { loadSave, persist } from "./core/save.js";
import { VIEW_W, VIEW_H } from "./game/constants.js";
import { TitleScene } from "./scenes/title.js";
import { LabScene } from "./scenes/lab.js";
import { Flow } from "./scenes/flow.js";

const STEP = 1000 / 60;

class App {
  constructor() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.input = new Input(window);
    this.audio = new AudioEngine();
    this.save = loadSave();
    this.view = { ctx: this.ctx, scale: 1, ox: 0, oy: 0, dpr: 1 };
    this.scene = null;
    this.t = 0;
    this.fade = 0;
    this.input.bindPointer(this.canvas, (cx, cy) => {
      const r = this.canvas.getBoundingClientRect();
      const d = this.view.dpr;
      return { x: ((cx - r.left) * d - this.view.ox) / this.view.scale, y: ((cy - r.top) * d - this.view.oy) / this.view.scale };
    });
    const unlock = () => {
      this.audio.unlock();
      this.audio.setVolumes(this.save.settings.sfx, this.save.settings.music);
    };
    window.addEventListener("keydown", unlock);
    window.addEventListener("pointerdown", unlock);
    this.input.textHandlers.add((e) => {
      if (e.code === "KeyM" && !e.repeat) this.audio.toggleMute();
    });
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.scene?.onBlur?.();
    });
    window.addEventListener("blur", () => this.scene?.onBlur?.());
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(64, window.innerWidth);
    const h = Math.max(36, window.innerHeight);
    this.lastSize = `${window.innerWidth}x${window.innerHeight}x${dpr}`;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    const scale = Math.min((w * dpr) / VIEW_W, (h * dpr) / VIEW_H);
    this.view.scale = scale;
    this.view.dpr = dpr;
    this.view.ox = Math.round((w * dpr - VIEW_W * scale) / 2);
    this.view.oy = Math.round((h * dpr - VIEW_H * scale) / 2);
    this.view.portrait = h > w;
  }

  saveNow() {
    persist(this.save);
  }

  go(scene) {
    this.scene?.exit?.();
    this.scene = scene;
    this.fade = 1;
    scene.enter?.();
  }

  start(scene) {
    this.go(scene);
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      acc += Math.min(250, now - last);
      last = now;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        this.input.poll();
        this.t++;
        this.scene.update();
        acc -= STEP;
        steps++;
      }
      if (steps === 5) acc = 0;
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  render() {
    const { ctx, view } = this;
    const size = `${window.innerWidth}x${window.innerHeight}x${Math.min(window.devicePixelRatio || 1, 2)}`;
    if (size !== this.lastSize) this.resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#07050c";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.ox, view.oy, VIEW_W * view.scale, VIEW_H * view.scale);
    ctx.clip();
    this.scene.draw(view);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(7,5,12,${this.fade})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      this.fade = Math.max(0, this.fade - 0.08);
    }
    ctx.restore();
    if (view.portrait && view.oy > 60) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const size = Math.round(16 * view.dpr);
      ctx.font = `700 ${size}px "Noto Sans KR", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,248,236,0.75)";
      ctx.fillText("↻ 화면을 가로로 돌리면 더 크게 즐길 수 있어요", this.canvas.width / 2, view.oy / 2 + size / 3);
    }
  }
}

async function boot() {
  const app = new App();
  // Debug hooks for automated playtesting (they work even when rAF is paused).
  window.__app = app;
  window.__run = (n = 1) => {
    for (let i = 0; i < n; i++) {
      app.input.poll();
      app.t++;
      app.scene.update();
    }
    app.fade = 0;
    app.render();
    return app.scene.constructor.name;
  };
  window.__key = (code, frames = 2) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code }));
    window.__run(frames);
    window.dispatchEvent(new KeyboardEvent("keyup", { code }));
    return window.__run(1);
  };
  try {
    await Promise.race([
      Promise.all(['400 40px "Black Han Sans"', '400 40px "Bungee"', '700 20px "Noto Sans KR"', '900 20px "Noto Sans KR"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fonts optional */
  }
  document.getElementById("boot")?.classList.add("hide");
  const hash = location.hash.slice(1);
  if (hash === "lab") app.start(new LabScene(app));
  else if (hash.startsWith("fight")) {
    const [, a = "huang", b = "socrates", stage = "agora", mode = "cpu"] = hash.split(":");
    app.start(new TitleScene(app));
    Flow.fight(app, { mode, p1: a, p2: b, stage, difficulty: "normal" });
  } else if (hash.startsWith("select")) {
    app.start(new TitleScene(app));
    Flow.select(app, hash.split(":")[1] || "cpu");
  } else if (hash === "guide" || hash === "options") {
    app.start(new TitleScene(app));
    Flow[hash](app);
  } else app.start(new TitleScene(app));
  app.canvas.focus();
}

boot();
