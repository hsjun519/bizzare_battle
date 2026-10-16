// Visual-only particles. They live in world space (y up) and never affect
// gameplay, so they use Math.random freely.
const R = Math.random;
const TAU = Math.PI * 2;

const SPARK_STYLE = {
  l: { core: "#ffffff", outer: "#ffe36b", size: 34, streaks: 7, life: 10 },
  h: { core: "#fff6d8", outer: "#ff9a3c", size: 56, streaks: 11, life: 14, ring: "#ffd36b" },
  s: { core: "#ffffff", outer: "#ff5f9e", size: 64, streaks: 13, life: 16, ring: "#ff9ad0" },
  super: { core: "#ffffff", outer: "#7af0ff", size: 90, streaks: 16, life: 20, ring: "#ffffff" },
  counter: { core: "#ffffff", outer: "#ff3b3b", size: 64, streaks: 12, life: 16, ring: "#ff7a7a" },
  block: { core: "#e8f6ff", outer: "#56b4ff", size: 40, streaks: 6, life: 12, ring: "#9ad6ff", shield: true },
  armor: { core: "#ffffff", outer: "#ffcc33", size: 50, streaks: 8, life: 12, ring: "#ffe080" },
};

export class FX {
  constructor() {
    this.list = [];
    this.front = [];
  }

  clear() {
    this.list.length = 0;
    this.front.length = 0;
  }

  add(p, front = true) {
    p.age = 0;
    (front ? this.front : this.list).push(p);
    if (this.front.length > 420) this.front.splice(0, 40);
    if (this.list.length > 300) this.list.splice(0, 40);
    return p;
  }

  update(speed = 1) {
    for (const arr of [this.list, this.front]) {
      let w = 0;
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        p.age += speed;
        if (p.update) p.update(p, speed);
        else {
          if (p.vx) p.x += p.vx * speed;
          if (p.vy) p.y += p.vy * speed;
          if (p.g) p.vy -= p.g * speed;
          if (p.drag) {
            p.vx *= Math.pow(p.drag, speed);
            p.vy *= Math.pow(p.drag, speed);
          }
          if (p.vr) p.rot = (p.rot || 0) + p.vr * speed;
          if (p.floor && p.y < 0) {
            p.y = 0;
            p.vy = -p.vy * 0.4;
            p.vx *= 0.7;
          }
        }
        if (p.age < p.life) arr[w++] = p;
      }
      arr.length = w;
    }
  }

  // ------------------------------------------------------------ emitters
  spark(x, y, kind = "l", dir = 1, tint = null) {
    const s = SPARK_STYLE[kind] || SPARK_STYLE.l;
    this.add({ type: "spark", x, y, kind, s, dir, life: s.life, rot: R() * TAU, tint });
    for (let i = 0; i < s.streaks; i++) {
      const a = (i / s.streaks) * TAU + R() * 0.4;
      const sp = 6 + R() * (s.size / 5);
      this.add({
        type: "streak",
        x,
        y,
        vx: Math.cos(a) * sp + dir * 2,
        vy: Math.sin(a) * sp,
        drag: 0.82,
        life: 8 + R() * 8,
        color: i % 3 === 0 ? s.core : tint || s.outer,
        w: kind === "l" ? 3 : 4,
      });
    }
    if (s.ring) this.add({ type: "ring", x, y, r: 10, vr: kind === "super" ? 11 : 7, life: 12, color: s.ring, w: 5 });
    if (s.shield) {
      for (let i = 0; i < 5; i++) {
        this.add({ type: "shard", x, y, vx: -dir * (2 + R() * 4), vy: (R() - 0.3) * 8, g: 0.4, life: 18, rot: R() * TAU, vr: (R() - 0.5) * 0.4, size: 6 + R() * 6, color: "#9ad6ff" });
      }
    }
  }

  ring(x, y, color = "#ffffff", vr = 8, life = 14, w = 6) {
    this.add({ type: "ring", x, y, r: 8, vr, life, color, w });
  }

  dust(x, y = 0, n = 6, color = "#d8cdb8") {
    for (let i = 0; i < n; i++) {
      this.add(
        {
          type: "dust",
          x: x + (R() - 0.5) * 30,
          y: y + R() * 8,
          vx: (R() - 0.5) * 3.5,
          vy: 0.4 + R() * 1.6,
          drag: 0.94,
          r: 8 + R() * 10,
          grow: 0.5,
          life: 22 + R() * 14,
          color,
        },
        false,
      );
    }
  }

  text(x, y, text, color = "#ffffff", size = 34, life = 46, opts = {}) {
    this.add({ type: "text", x, y, vy: opts.vy ?? 1.6, drag: 0.92, text, color, size, life, outline: opts.outline || "#16111d", rot: opts.rot || 0 });
  }

  debris(x, y, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = opts.angle !== undefined ? opts.angle + (R() - 0.5) * (opts.spread ?? 1.2) : R() * TAU;
      const sp = (opts.speed || 6) * (0.5 + R());
      this.add({
        type: "debris",
        shape: opts.shape || "rect",
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp + (opts.up || 0),
        g: opts.g ?? 0.45,
        floor: opts.floor ?? true,
        rot: R() * TAU,
        vr: (R() - 0.5) * 0.5,
        size: (opts.size || 6) * (0.6 + R() * 0.8),
        color: Array.isArray(opts.color) ? opts.color[i % opts.color.length] : opts.color || "#c7b08a",
        life: (opts.life || 40) * (0.7 + R() * 0.6),
      });
    }
  }

  custom(p, front = true) {
    return this.add({ type: "custom", ...p }, front);
  }

  // ------------------------------------------------------------ drawing
  draw(ctx, front = true) {
    const arr = front ? this.front : this.list;
    for (const p of arr) DRAW[p.type]?.(ctx, p);
  }
}

const DRAW = {
  spark(ctx, p) {
    const s = p.s;
    const u = p.age / p.life;
    const size = s.size * (u < 0.25 ? 0.5 + u * 2 : 1 - (u - 0.25) * 0.9);
    ctx.save();
    ctx.translate(p.x, -p.y);
    ctx.rotate(p.rot);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1 - u * 0.6;
    star(ctx, 0, 0, 8, size, size * 0.32, p.tint || s.outer);
    star(ctx, 0, 0, 8, size * 0.6, size * 0.2, s.core);
    ctx.fillStyle = s.core;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.25, 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  streak(ctx, p) {
    const u = p.age / p.life;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 1 - u;
    ctx.lineWidth = p.w * (1 - u * 0.6);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, -p.y);
    ctx.lineTo(p.x - p.vx * 2.6, -p.y + p.vy * 2.6);
    ctx.stroke();
    ctx.restore();
  },
  ring(ctx, p) {
    const u = p.age / p.life;
    ctx.save();
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.w * (1 - u);
    ctx.beginPath();
    ctx.arc(p.x, -p.y, p.r + p.vr * p.age, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },
  dust(ctx, p) {
    const u = p.age / p.life;
    ctx.globalAlpha = (1 - u) * 0.55;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, -p.y, p.r + p.grow * p.age, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  text(ctx, p) {
    const u = p.age / p.life;
    const pop = p.age < 6 ? 0.6 + (p.age / 6) * 0.55 : 1.15 - Math.min(0.15, (p.age - 6) / 30);
    ctx.save();
    ctx.translate(p.x, -p.y);
    ctx.rotate(p.rot);
    ctx.scale(pop, pop);
    ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
    ctx.font = `900 ${p.size}px "Black Han Sans", "Bungee", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, p.size / 5);
    ctx.strokeStyle = p.outline;
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  },
  shard(ctx, p) {
    const u = p.age / p.life;
    ctx.save();
    ctx.translate(p.x, -p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = 1 - u;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.lineTo(p.size * 0.8, 0);
    ctx.lineTo(0, p.size);
    ctx.lineTo(-p.size * 0.8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  debris(ctx, p) {
    const u = p.age / p.life;
    ctx.save();
    ctx.translate(p.x, -p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = u > 0.75 ? (1 - u) * 4 : 1;
    const s = p.size;
    if (p.shape === "coin") {
      ctx.fillStyle = "#ffd447";
      ctx.strokeStyle = "#8a5a00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * Math.abs(Math.cos(p.age * 0.3)) + 1, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (p.shape === "bill") {
      ctx.fillStyle = "#8fd47a";
      ctx.strokeStyle = "#2f6b2a";
      ctx.lineWidth = 1.5;
      ctx.fillRect(-s * 1.6, -s * 0.8 * Math.abs(Math.cos(p.age * 0.2)), s * 3.2, s * 1.6 * Math.abs(Math.cos(p.age * 0.2)) + 1);
    } else if (p.shape === "circle") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, TAU);
      ctx.fill();
    } else if (p.shape === "feather") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.4, s * 0.45, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
    }
    ctx.restore();
  },
  custom(ctx, p) {
    p.draw(ctx, p);
  },
};

export function star(ctx, x, y, points, outer, inner, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * TAU;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
