// Five hand-built parallax stages. Static layers are cached into offscreen
// canvases; animated details (crowds, tickers, fire, LEDs) draw live.
import { STAGE_W, GROUND_Y, VIEW_W, VIEW_H } from "../game/constants.js";
import { mulberry32, rgba, mix } from "../core/util.js";

const OUT = "#16111d";
const LX = 1200; // half width of a cached layer, in layer units
const LTOP = 760;
const LBOT = 140;

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const cache = new Map();
function cached(key, scale, draw) {
  const k = key + "@" + scale.toFixed(2);
  let c = cache.get(k);
  if (!c) {
    for (const old of cache.keys()) if (old.startsWith(key + "@")) cache.delete(old);
    c = makeCanvas(Math.max(1, Math.ceil(LX * 2 * scale)), Math.max(1, Math.ceil((LTOP + LBOT) * scale)));
    const ctx = c.getContext("2d");
    ctx.scale(scale, scale);
    ctx.translate(LX, LTOP);
    draw(ctx);
    cache.set(k, c);
  }
  return c;
}

// Enter a parallax layer: origin = stage centre on the ground line.
function layer(ctx, cam, k, fn) {
  const z = 1 + (cam.zoom - 1) * k;
  ctx.save();
  ctx.translate(VIEW_W / 2 - (cam.x - STAGE_W / 2) * k * cam.zoom + cam.sx * k, GROUND_Y + cam.y * k * cam.zoom + cam.sy * k);
  ctx.scale(z, z);
  fn();
  ctx.restore();
}

function blit(ctx, canvas) {
  ctx.drawImage(canvas, -LX, -LTOP, LX * 2, LTOP + LBOT);
}

function sky(ctx, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function poly(ctx, pts, fill, stroke = null, lw = 3) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function glowDisk(ctx, x, y, r, color, a = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// World-space floor band (drawn under the world transform).
function floorBand(ctx, top, bottom, lines, lineColor, opts = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, 220);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(-800, 0, STAGE_W + 1600, 400);
  ctx.fillStyle = opts.edge || "rgba(255,255,255,0.18)";
  ctx.fillRect(-800, 0, STAGE_W + 1600, 4);
  if (lines) {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    for (let x = -800; x < STAGE_W + 800; x += lines) {
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(STAGE_W / 2 + (x - STAGE_W / 2) * 1.6, 220);
      ctx.stroke();
    }
    for (const y of opts.rows || [26, 62, 112, 180]) {
      ctx.beginPath();
      ctx.moveTo(-800, y);
      ctx.lineTo(STAGE_W + 800, y);
      ctx.stroke();
    }
  }
}

// ================================================================== AGORA
function column(ctx, x, w, h, base, shade) {
  ctx.fillStyle = shade;
  ctx.fillRect(x - w / 2 - 6, -h - 14, w + 12, 14);
  ctx.fillRect(x - w / 2 - 8, -10, w + 16, 10);
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, shade);
  g.addColorStop(0.35, base);
  g.addColorStop(1, shade);
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, -h, w, h - 10);
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + (w / 4) * i, -h);
    ctx.lineTo(x - w / 2 + (w / 4) * i, -10);
    ctx.stroke();
  }
}

function olive(ctx, x, y, s, c) {
  ctx.fillStyle = "#3b2a22";
  ctx.fillRect(x - 5 * s, y - 60 * s, 10 * s, 60 * s);
  ctx.fillStyle = c;
  for (const [dx, dy, r] of [[-26, -80, 34], [10, -96, 38], [34, -72, 30], [-6, -110, 30], [-40, -60, 22]]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

const agora = {
  id: "agora",
  name: "아테네 아고라",
  en: "AGORA OF ATHENS",
  song: "agora",
  desc: "해 질 녘의 광장. 토론이 주먹다짐이 되는 곳.",
  accent: "#ff9a52",
  drawBack(ctx, cam, t, view) {
    sky(ctx, [[0, "#26164a"], [0.45, "#7b3a6e"], [0.72, "#ff8a4c"], [1, "#ffd08a"]]);
    layer(ctx, cam, 0.03, () => {
      glowDisk(ctx, 220, -330, 260, "#ffb36b", 0.55);
      ctx.fillStyle = "#ffe0a0";
      ctx.beginPath();
      ctx.arc(220, -330, 70, 0, Math.PI * 2);
      ctx.fill();
    });
    layer(ctx, cam, 0.15, () =>
      blit(
        ctx,
        cached("agora-far", view.scale, (c) => {
          c.fillStyle = "#5b2f61";
          c.beginPath();
          c.moveTo(-LX, -120);
          c.bezierCurveTo(-700, -220, -520, -250, -300, -250);
          c.lineTo(160, -250);
          c.bezierCurveTo(360, -250, 520, -200, 760, -150);
          c.lineTo(LX, -120);
          c.lineTo(LX, 40);
          c.lineTo(-LX, 40);
          c.fill();
          // parthenon silhouette
          c.fillStyle = "#4a2552";
          c.fillRect(-260, -300, 380, 16);
          poly(c, [[-270, -300], [-70, -350], [130, -300]], "#4a2552");
          for (let i = 0; i < 9; i++) c.fillRect(-250 + i * 44, -286, 14, 40);
          c.fillRect(-264, -248, 390, 10);
          c.fillStyle = "rgba(255,190,120,0.25)";
          c.fillRect(-260, -300, 380, 4);
        }),
      ),
    );
    layer(ctx, cam, 0.42, () =>
      blit(
        ctx,
        cached("agora-mid", view.scale, (c) => {
          c.fillStyle = "#6e4060";
          c.fillRect(-LX, -40, LX * 2, 60);
          olive(c, -860, -30, 1.3, "#33402f");
          olive(c, 880, -30, 1.4, "#2f3b2c");
          // stoa
          const base = "#e7cfa8";
          const sh = "#b48e74";
          c.fillStyle = sh;
          c.fillRect(-620, -360, 1240, 30);
          poly(c, [[-640, -360], [0, -440], [640, -360]], "#d9b994", OUT, 0);
          poly(c, [[-560, -368], [0, -424], [560, -368]], "#c6a07e");
          c.fillStyle = base;
          c.fillRect(-640, -372, 1280, 14);
          for (let i = 0; i < 11; i++) column(c, -560 + i * 112, 46, 330, base, sh);
          c.fillStyle = "#a47c63";
          c.fillRect(-660, -36, 1320, 36);
          c.fillStyle = "rgba(255,170,90,0.18)";
          c.fillRect(-640, -372, 1280, 4);
        }),
      ),
    );
    // cheering crowd behind the low wall
    layer(ctx, cam, 0.7, () => {
      const hype = Math.min(1, (this.hype || 0) / 30);
      const rand = mulberry32(7);
      for (let i = 0; i < 46; i++) {
        const x = -1000 + i * 45 + rand() * 20;
        const tone = ["#3b2346", "#48284f", "#2e1c3b"][i % 3];
        const bob = Math.abs(Math.sin(t * (0.1 + rand() * 0.06) + i)) * (3 + hype * 12);
        const y = -70 - bob - rand() * 16;
        ctx.fillStyle = tone;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - 18, y + 10, 36, 70);
        if (hype > 0.2 && i % 3 === 0) {
          ctx.fillRect(x + 10, y - 26, 8, 30);
        }
      }
      ctx.fillStyle = "#8e6551";
      ctx.fillRect(-1300, -40, 2600, 40);
      ctx.fillStyle = "#b08268";
      ctx.fillRect(-1300, -40, 2600, 6);
    });
    this.hype = Math.max(0, (this.hype || 0) - 0.5);
  },
  drawFloor(ctx) {
    floorBand(ctx, "#d6bb94", "#8a6a55", 140, "rgba(90,60,40,0.25)");
  },
  onEvent(e) {
    if (e.type === "hit" && e.dmg > 60) this.hype = 40;
    if (e.type === "ko" || e.type === "super") this.hype = 80;
  },
};

// ================================================================== WALL ST
const TICKERS = ["NVDA ▲ 3.4%", "TSLA ▼ 2.1%", "BRK.B ▲ 0.8%", "IDEA ▲ ∞", "PLATO ▲ 2.4%", "SOCR ▼ 0.6%", "HAMR ▲ 9.9%", "BARL ▼ 1.2%", "DOGE ▲ 420%", "WLTH ▲ 1.7%"];

const wallst = {
  id: "wallst",
  name: "월스트리트",
  en: "WALL STREET AT NIGHT",
  song: "wallst",
  desc: "시세판이 번쩍이는 밤의 금융가. 주먹에도 시가가 매겨진다.",
  accent: "#ffd45a",
  drawBack(ctx, cam, t, view, b) {
    sky(ctx, [[0, "#070b22"], [0.6, "#1b2a5a"], [1, "#3b4c86"]]);
    layer(ctx, cam, 0.05, () => {
      const r = mulberry32(3);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (let i = 0; i < 60; i++) ctx.fillRect(-900 + r() * 1800, -720 + r() * 300, 2, 2);
      ctx.fillStyle = "#f4f1dc";
      ctx.beginPath();
      ctx.arc(-380, -560, 34, 0, Math.PI * 2);
      ctx.fill();
      glowDisk(ctx, -380, -560, 120, "#f4f1dc", 0.25);
    });
    layer(ctx, cam, 0.14, () =>
      blit(
        ctx,
        cached("wall-far", view.scale, (c) => {
          const r = mulberry32(11);
          let x = -LX;
          while (x < LX) {
            const w = 70 + r() * 110;
            const h = 220 + r() * 380;
            c.fillStyle = mix("#141c3c", "#26315e", r());
            c.fillRect(x, -h, w, h + 40);
            c.fillStyle = "rgba(255,214,120,0.55)";
            for (let wy = -h + 14; wy < -10; wy += 16)
              for (let wx = x + 8; wx < x + w - 8; wx += 14) if (r() < 0.32) c.fillRect(wx, wy, 6, 8);
            if (r() < 0.3) {
              c.fillStyle = "#ff4d5e";
              c.fillRect(x + w / 2 - 2, -h - 24, 4, 24);
            }
            x += w + 6;
          }
        }),
      ),
    );
    layer(ctx, cam, 0.4, () => {
      blit(
        ctx,
        cached("wall-mid", view.scale, (c) => {
          // the exchange facade
          c.fillStyle = "#3a3f58";
          c.fillRect(-700, -460, 1400, 460);
          poly(c, [[-720, -460], [0, -560], [720, -460]], "#4a5070");
          poly(c, [[-620, -470], [0, -540], [620, -470]], "#3a3f58");
          for (let i = 0; i < 8; i++) column(c, -560 + i * 160, 54, 300, "#8c93ad", "#5d6380");
          c.fillStyle = "#2a2e44";
          c.fillRect(-720, -330, 1440, 22);
          c.fillStyle = "#5d6380";
          c.fillRect(-740, -30, 1480, 30);
          c.fillStyle = "#d8c27a";
          c.font = "900 40px Bungee, sans-serif";
          c.textAlign = "center";
          c.fillText("THE EXCHANGE", 0, -480);
        }),
      );
      // LED ticker board
      ctx.fillStyle = "#06070d";
      ctx.fillRect(-640, -400, 1280, 56);
      ctx.strokeStyle = "#2b2f44";
      ctx.lineWidth = 6;
      ctx.strokeRect(-640, -400, 1280, 56);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-636, -396, 1272, 48);
      ctx.clip();
      ctx.font = "900 30px Bungee, sans-serif";
      ctx.textBaseline = "middle";
      const total = TICKERS.length * 260;
      const off = (t * 2.2) % total;
      for (let i = 0; i < TICKERS.length * 2; i++) {
        const s = TICKERS[i % TICKERS.length];
        const x = -640 + i * 260 - off;
        if (x < -900 || x > 700) continue;
        ctx.fillStyle = s.includes("▼") ? "#ff5a6a" : "#5dff8a";
        ctx.fillText(s, x, -372);
      }
      ctx.restore();
      // pulsing board when supers fire
      if (b && b.freeze > 0) {
        ctx.fillStyle = "rgba(255,212,90,0.25)";
        ctx.fillRect(-640, -400, 1280, 56);
      }
    });
    // bull statue + street lamps
    layer(ctx, cam, 0.72, () => {
      for (const lx of [-820, -260, 320, 860]) {
        ctx.fillStyle = "#1a1d2c";
        ctx.fillRect(lx - 5, -300, 10, 300);
        ctx.fillRect(lx - 30, -304, 60, 8);
        glowDisk(ctx, lx, -290, 120, "#ffd890", 0.35);
        ctx.fillStyle = "#ffeec0";
        ctx.fillRect(lx - 16, -296, 32, 8);
      }
      drawBullStatue(ctx, -560, -6, 0.9);
    });
  },
  drawFloor(ctx, cam, t) {
    floorBand(ctx, "#2a2f45", "#11131f", 0, null, { edge: "rgba(255,220,140,0.25)" });
    ctx.fillStyle = "rgba(255,220,120,0.55)";
    for (let x = -400; x < STAGE_W + 400; x += 120) ctx.fillRect(x, 58, 60, 6);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    for (let i = 0; i < 9; i++) ctx.fillRect(STAGE_W / 2 - 260 + i * 60, 96, 34, 70);
    // reflections
    ctx.fillStyle = "rgba(255,216,140,0.06)";
    for (const lx of [200, 700, 1200, 1700]) ctx.fillRect(lx, 10, 40, 140);
  },
};

function drawBullStatue(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "#6b4a2a";
  ctx.fillRect(-90, -34, 180, 34);
  ctx.fillStyle = "#8a6233";
  ctx.beginPath();
  ctx.ellipse(0, -100, 90, 46, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(86, -120, 34, 26, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e4d3a6";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(96, -136);
  ctx.quadraticCurveTo(128, -150, 136, -176);
  ctx.stroke();
  ctx.fillStyle = "#7a5530";
  for (const lx of [-60, -30, 40, 64]) ctx.fillRect(lx, -70, 14, 40);
  ctx.strokeStyle = "#7a5530";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-86, -110);
  ctx.quadraticCurveTo(-120, -140, -110, -170);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,220,150,0.25)";
  ctx.beginPath();
  ctx.ellipse(-10, -126, 60, 14, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ================================================================== LAUNCH PAD
const launch = {
  id: "launch",
  name: "화성행 발사장",
  en: "MARS LAUNCH SITE",
  song: "launch",
  desc: "카운트다운이 끝나지 않는 사막의 발사대.",
  accent: "#5aa9ff",
  drawBack(ctx, cam, t, view) {
    sky(ctx, [[0, "#0b1d3a"], [0.5, "#2c6b8a"], [0.78, "#f08a5d"], [1, "#ffcf8a"]]);
    layer(ctx, cam, 0.02, () => {
      const r = mulberry32(5);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (let i = 0; i < 70; i++) ctx.fillRect(-900 + r() * 1800, -720 + r() * 260, 2, 2);
      glowDisk(ctx, 420, -560, 90, "#ff7b4a", 0.4);
      ctx.fillStyle = "#d9603a";
      ctx.beginPath();
      ctx.arc(420, -560, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b44a2c";
      ctx.beginPath();
      ctx.arc(412, -566, 8, 0, Math.PI * 2);
      ctx.fill();
      // distant launches
      const cyc = t % 1500;
      if (cyc < 400) {
        const u = cyc / 400;
        const rx = -500 + u * 120;
        const ry = -120 - u * 700;
        ctx.strokeStyle = "rgba(255,240,220,0.45)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-500, -120);
        ctx.quadraticCurveTo(-480, ry * 0.6, rx, ry);
        ctx.stroke();
        glowDisk(ctx, rx, ry, 18, "#ffd08a", 0.9);
      }
    });
    layer(ctx, cam, 0.12, () =>
      blit(
        ctx,
        cached("launch-far", view.scale, (c) => {
          c.fillStyle = "#8a4a3a";
          for (const [x, w, h] of [[-1100, 420, 200], [-600, 300, 140], [300, 520, 230], [800, 380, 170]]) {
            poly(c, [[x, 0], [x + 40, -h], [x + w - 40, -h], [x + w, 0]], "#9a5240");
            c.fillStyle = "#b5654c";
            c.fillRect(x + 40, -h, w - 80, 10);
          }
          c.fillStyle = "#7a3e32";
          c.fillRect(-LX, -30, LX * 2, 70);
        }),
      ),
    );
    layer(ctx, cam, 0.36, () => {
      blit(
        ctx,
        cached("launch-mid", view.scale, (c) => {
          // tower
          c.strokeStyle = "#3a3f4c";
          c.lineWidth = 6;
          c.fillStyle = "#2a2e38";
          c.fillRect(160, -620, 70, 620);
          for (let y = -620; y < 0; y += 40) {
            c.beginPath();
            c.moveTo(160, y);
            c.lineTo(230, y + 40);
            c.moveTo(230, y);
            c.lineTo(160, y + 40);
            c.stroke();
          }
          c.fillStyle = "#3a3f4c";
          c.fillRect(100, -470, 140, 10);
          c.fillRect(100, -300, 140, 10);
          // rocket
          const g = c.createLinearGradient(-10, 0, 110, 0);
          g.addColorStop(0, "#8d96a6");
          g.addColorStop(0.4, "#e9edf3");
          g.addColorStop(1, "#9aa3b2");
          c.fillStyle = g;
          c.fillRect(0, -560, 100, 520);
          poly(c, [[0, -560], [50, -680], [100, -560]], "#dfe4ec");
          c.fillStyle = "#2b2f3a";
          c.fillRect(0, -520, 100, 8);
          c.fillRect(0, -200, 100, 8);
          poly(c, [[0, -120], [-40, -40], [0, -40]], "#5e6676");
          poly(c, [[100, -120], [140, -40], [100, -40]], "#5e6676");
          c.fillStyle = "#3a3f4c";
          c.fillRect(-60, -40, 220, 40);
          c.fillStyle = "#ffcf3a";
          for (let i = 0; i < 11; i++) c.fillRect(-60 + i * 20, -40, 10, 8);
        }),
      );
      // venting steam
      for (let i = 0; i < 7; i++) {
        const u = ((t * 0.6 + i * 40) % 260) / 260;
        ctx.fillStyle = `rgba(240,240,250,${0.35 * (1 - u)})`;
        ctx.beginPath();
        ctx.arc(50 + (i % 2 ? -1 : 1) * u * 140, -30 - u * 120, 30 + u * 60, 0, Math.PI * 2);
        ctx.fill();
      }
      // blinking warning light
      if (Math.floor(t / 30) % 2) glowDisk(ctx, 195, -640, 40, "#ff4040", 0.9);
    });
    layer(ctx, cam, 0.72, () => {
      for (const lx of [-900, -380, 520, 980]) {
        ctx.fillStyle = "#23262f";
        ctx.fillRect(lx - 6, -380, 12, 380);
        ctx.fillRect(lx - 40, -390, 80, 26);
        glowDisk(ctx, lx, -376, 160, "#e8f2ff", 0.25);
        ctx.fillStyle = "#f4f9ff";
        ctx.fillRect(lx - 34, -384, 68, 12);
      }
      ctx.strokeStyle = "#3a3e48";
      ctx.lineWidth = 3;
      for (let x = -1300; x < 1300; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, -70);
        ctx.lineTo(x + 26, -40);
        ctx.moveTo(x + 26, -70);
        ctx.lineTo(x, -40);
        ctx.stroke();
      }
      ctx.fillStyle = "#3a3e48";
      ctx.fillRect(-1300, -74, 2600, 6);
    });
  },
  drawFloor(ctx) {
    floorBand(ctx, "#9a9ca5", "#4c4e58", 160, "rgba(30,30,40,0.25)");
    ctx.fillStyle = "rgba(20,20,30,0.25)";
    ctx.beginPath();
    ctx.ellipse(STAGE_W / 2, 50, 300, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let x = -600; x < STAGE_W + 600; x += 80) {
      ctx.fillStyle = (x / 80) % 2 ? "#ffcf3a" : "#22242c";
      ctx.fillRect(x, 4, 80, 10);
    }
  },
};

// ================================================================== CAVE
const SHADOW_PUPPETS = [
  (c) => {
    c.beginPath();
    c.ellipse(0, 0, 70, 34, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(70, -30, 30, 22, 0.4, 0, Math.PI * 2);
    c.fill();
    c.fillRect(-50, 20, 12, 50);
    c.fillRect(30, 20, 12, 50);
    c.fillRect(80, -70, 8, 30);
  },
  (c) => {
    c.beginPath();
    c.moveTo(-40, 60);
    c.lineTo(0, -80);
    c.lineTo(40, 60);
    c.fill();
    c.beginPath();
    c.arc(0, -90, 22, 0, Math.PI * 2);
    c.fill();
  },
  (c) => {
    c.fillRect(-60, -10, 120, 70);
    c.beginPath();
    c.moveTo(-70, -10);
    c.lineTo(0, -70);
    c.lineTo(70, -10);
    c.fill();
  },
];

const cave = {
  id: "cave",
  name: "플라톤의 동굴",
  en: "PLATO'S CAVE",
  song: "cave",
  desc: "불빛이 만든 그림자만이 진실인 곳. 당신의 그림자도 싸운다.",
  accent: "#ff9c4a",
  wallShadows: true,
  drawBack(ctx, cam, t, view) {
    sky(ctx, [[0, "#120a0a"], [0.6, "#2b1712"], [1, "#3e2216"]]);
    layer(ctx, cam, 0.2, () => {
      blit(
        ctx,
        cached("cave-wall", view.scale, (c) => {
          const g = c.createRadialGradient(0, -260, 50, 0, -260, 900);
          g.addColorStop(0, "#7a4a30");
          g.addColorStop(1, "#22130e");
          c.fillStyle = g;
          c.fillRect(-LX, -LTOP, LX * 2, LTOP + 40);
          const r = mulberry32(21);
          c.fillStyle = "rgba(0,0,0,0.18)";
          for (let i = 0; i < 40; i++) {
            c.beginPath();
            c.ellipse(-LX + r() * LX * 2, -LTOP + r() * 700, 40 + r() * 120, 20 + r() * 60, r() * 3, 0, Math.PI * 2);
            c.fill();
          }
          // stalactites
          c.fillStyle = "#1a0f0b";
          for (let x = -LX; x < LX; x += 70 + r() * 60) poly(c, [[x, -LTOP], [x + 30 + r() * 30, -LTOP + 60 + r() * 140], [x + 70, -LTOP]], "#1a0f0b");
        }),
      );
      // shadow puppets parading across the wall
      ctx.fillStyle = "rgba(10,5,4,0.55)";
      for (let i = 0; i < 3; i++) {
        const x = ((t * 0.7 + i * 600) % 1800) - 900;
        ctx.save();
        ctx.translate(x, -330 + Math.sin(t * 0.05 + i) * 10);
        ctx.scale(1.6, 1.6);
        SHADOW_PUPPETS[i](ctx);
        ctx.restore();
      }
    });
    // light shaft from the cave mouth
    layer(ctx, cam, 0.1, () => {
      const g = ctx.createLinearGradient(700, -760, 300, 0);
      g.addColorStop(0, "rgba(255,240,200,0.32)");
      g.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = g;
      poly(ctx, [[640, -760], [860, -760], [520, 0], [180, 0]], null);
      ctx.fill();
    });
    // the fire and the chained prisoners, up on a rock ledge
    layer(ctx, cam, 0.42, () => {
      ctx.translate(0, -70);
      ctx.scale(0.72, 0.72);
      ctx.fillStyle = "#2a1610";
      ctx.beginPath();
      ctx.moveTo(-900, 0);
      ctx.quadraticCurveTo(-400, -30, 0, -26);
      ctx.quadraticCurveTo(400, -30, 900, 0);
      ctx.lineTo(900, 120);
      ctx.lineTo(-900, 120);
      ctx.fill();
      const fx = 0;
      glowDisk(ctx, fx, -80, 520, "#ff8a3a", 0.35 + Math.sin(t * 0.3) * 0.04);
      ctx.fillStyle = "#3a2418";
      ctx.fillRect(-90, -24, 180, 24);
      for (let i = 0; i < 9; i++) {
        const ph = t * 0.25 + i * 1.7;
        const h = 90 + Math.sin(ph) * 30 + (i % 3) * 20;
        const w = 30 + (i % 2) * 14;
        const x = -70 + i * 17;
        const col = ["#ff5a1f", "#ff9a2a", "#ffd25a"][i % 3];
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, -20);
        ctx.quadraticCurveTo(x - w / 2 + Math.sin(ph) * 8, -20 - h * 0.6, x + Math.sin(ph * 1.3) * 10, -20 - h);
        ctx.quadraticCurveTo(x + w / 2, -20 - h * 0.5, x + w / 2, -20);
        ctx.fill();
      }
      ctx.fillStyle = "#1a0e0a";
      for (const px of [-700, -560, 560, 700]) {
        ctx.beginPath();
        ctx.arc(px, -96, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(px - 26, -78, 52, 78);
      }
      ctx.strokeStyle = "#5a4a40";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-760, -40);
      ctx.lineTo(-500, -40);
      ctx.moveTo(500, -40);
      ctx.lineTo(760, -40);
      ctx.stroke();
    });
  },
  drawFloor(ctx) {
    floorBand(ctx, "#5a3a28", "#1e120c", 0, null, { edge: "rgba(255,160,90,0.25)" });
    const r = mulberry32(9);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.ellipse(-400 + r() * (STAGE_W + 800), 20 + r() * 160, 20 + r() * 40, 6 + r() * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// ================================================================== DATACENTER
// Static rack bodies go into the layer cache; LED positions are collected once
// so the blinking lights can be drawn as one batched path per frame.
function rackBody(ctx, x, w, h, leds) {
  ctx.fillStyle = "#14191c";
  ctx.fillRect(x, -h, w, h);
  ctx.strokeStyle = "#2a3236";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, -h, w, h);
  for (let y = -h + 12; y < -12; y += 22) {
    ctx.fillStyle = "#1f262a";
    ctx.fillRect(x + 6, y, w - 12, 16);
    ctx.fillStyle = "#2c3a1a";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 10 + i * 9, y + 6, 5, 4);
      if (leds) leds.push([x + 10 + i * 9, y + 6]);
    }
  }
}

const RACK_LEDS = { far: [], near: [] };
for (let i = -9; i <= 9; i++) rackBody({ fillRect() {}, strokeRect() {} }, i * 110 - 40, 80, 520, RACK_LEDS.far);
for (let i = -6; i <= 6; i++) rackBody({ fillRect() {}, strokeRect() {} }, i * 170 - 60, 120, 430, RACK_LEDS.near);

function blinkLeds(ctx, leds, t, glow, rate) {
  const phase = Math.floor(t / rate);
  ctx.fillStyle = glow;
  ctx.beginPath();
  for (let i = 0; i < leds.length; i++) {
    if ((i * 7919 + phase * 104729 + ((i * 31) % 7) * phase) % 97 < 34) ctx.rect(leds[i][0], leds[i][1], 5, 4);
  }
  ctx.fill();
  ctx.fillStyle = "#ffb84a";
  ctx.beginPath();
  for (let i = 0; i < leds.length; i += 13) {
    if ((i + phase) % 5 === 0) ctx.rect(leds[i][0], leds[i][1], 5, 4);
  }
  ctx.fill();
}

const datacenter = {
  id: "datacenter",
  name: "GPU 데이터센터",
  en: "THE AI FACTORY",
  song: "datacenter",
  desc: "1초에 1경 번 연산하는 서버 숲. 냉각팬 소리가 함성이다.",
  accent: "#76b900",
  drawBack(ctx, cam, t, view) {
    sky(ctx, [[0, "#05080a"], [1, "#0d1a14"]]);
    layer(ctx, cam, 0.15, () => {
      blit(
        ctx,
        cached("dc-far", view.scale, (c) => {
          for (let i = -9; i <= 9; i++) rackBody(c, i * 110 - 40, 80, 520);
        }),
      );
      blinkLeds(ctx, RACK_LEDS.far, t, "#3f7a12", 14);
      ctx.fillStyle = "rgba(5,8,10,0.55)";
      ctx.fillRect(-1100, -560, 2200, 600);
    });
    layer(ctx, cam, 0.35, () => {
      // holographic chart
      ctx.strokeStyle = "rgba(118,185,0,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-260, -560, 520, 240);
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const x = -250 + i * 12.5;
        const y = -340 - Math.pow(i / 40, 2.4) * 190 - Math.sin(i * 0.9 + t * 0.05) * 8;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(184,255,74,0.9)";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = "rgba(184,255,74,0.9)";
      ctx.font = "900 22px Bungee, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("COMPUTE ▲", -250, -575);
      blit(
        ctx,
        cached("dc-near", view.scale, (c) => {
          for (let i = -6; i <= 6; i++) rackBody(c, i * 170 - 60, 120, 430);
        }),
      );
      blinkLeds(ctx, RACK_LEDS.near, t, "#76b900", 9);
    });
    layer(ctx, cam, 0.7, () => {
      // cooling fans and cable trays
      ctx.fillStyle = "#0d1113";
      ctx.fillRect(-1300, -640, 2600, 40);
      for (let i = -6; i <= 6; i++) {
        const x = i * 210;
        ctx.save();
        ctx.translate(x, -620);
        ctx.fillStyle = "#1c2326";
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(t * 0.4 + i);
        ctx.fillStyle = "#38464b";
        for (let k = 0; k < 4; k++) {
          ctx.rotate(Math.PI / 2);
          ctx.fillRect(0, -6, 26, 12);
        }
        ctx.restore();
      }
      ctx.strokeStyle = "#76b900";
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-1300, -560 + i * 8);
        ctx.bezierCurveTo(-400, -500 + i * 10, 400, -620 + i * 6, 1300, -540 + i * 8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  },
  drawFloor(ctx, cam, t) {
    floorBand(ctx, "#132018", "#050806", 0, null, { edge: "rgba(118,185,0,0.6)" });
    ctx.strokeStyle = "rgba(118,185,0,0.35)";
    ctx.lineWidth = 2;
    for (let x = -800; x < STAGE_W + 800; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(STAGE_W / 2 + (x - STAGE_W / 2) * 1.8, 220);
      ctx.stroke();
    }
    const pulse = (t * 3) % 220;
    ctx.fillStyle = "rgba(184,255,74,0.25)";
    ctx.fillRect(-800, pulse, STAGE_W + 1600, 3);
  },
  drawFront(ctx, cam, t) {
    const g = ctx.createLinearGradient(0, VIEW_H - 140, 0, VIEW_H);
    g.addColorStop(0, "rgba(118,185,0,0)");
    g.addColorStop(1, "rgba(118,185,0,0.12)");
    ctx.fillStyle = g;
    ctx.fillRect(0, VIEW_H - 140, VIEW_W, 140);
  },
};

export const STAGES = [agora, wallst, launch, cave, datacenter];
export function getStage(id) {
  return STAGES.find((s) => s.id === id) || agora;
}
