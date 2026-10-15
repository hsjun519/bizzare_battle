import { WIDTH, FLOOR } from "./engine.js";

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function polygon(ctx, color, points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

// All sprites and stages are original, drawn on a small pixel grid.
export function drawFighter(
  ctx,
  fighter,
  x,
  ground,
  {
    scale = 4,
    facing = 1,
    time = 0,
    moving = false,
    attack = null,
    blocking = false,
    crouching = false,
    hurt = false,
    alpha = 1,
    jacketLost = false,
    coatTorn = false,
    bagHeld = true,
    boosters = 2,
  } = {},
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(Math.round(x), Math.round(ground));
  ctx.scale(facing * scale, scale);
  const walk = moving ? Math.sin(time * 14) * 3 : 0;
  const bob = moving ? Math.abs(Math.sin(time * 14)) : Math.sin(time * 3) * 0.6;
  ctx.translate(0, (crouching ? 12 : 0) - bob);
  const ink = "#141b18",
    skin = hurt ? "#fff4dd" : fighter.skin;
  const shade =
    fighter.id === "socrates" || fighter.id === "plato" ? "#ab8568" : "#b27e64";
  const cloth = hurt ? "#f8f5e0" : jacketLost ? "#45504a" : fighter.outfit;
  const greek = ["socrates", "plato"].includes(fighter.id);
  const kick =
    attack?.type === "kick" && attack.time > 0.07 && attack.time < 0.29;
  const punch = attack && !kick && attack.time < 0.34;
  const armX = blocking ? 7 : punch ? 17 : 9;
  const armY = blocking ? -28 : punch ? -25 : -17;
  // Far arm and legs, with separate silhouettes for robes and suits.
  rect(ctx, ink, -12, -27, 6, 19);
  rect(ctx, cloth, -11, -27, 4, 14);
  rect(ctx, shade, -11, -13, 4, 4);
  if (greek) {
    rect(ctx, ink, -8, -13, 6, 13);
    rect(ctx, shade, -7, -11, 4, 10);
    rect(ctx, ink, 3 + walk, -12, 6, 12);
    rect(ctx, skin, 4 + walk, -10, 4, 9);
    rect(ctx, "#63513d", -9, -2, 8, 2);
    rect(ctx, "#63513d", 3 + walk, -2, 8, 2);
  } else {
    const pants =
      fighter.id === "musk"
        ? "#b9c3c5"
        : fighter.id === "huang"
          ? "#292c30"
          : "#292a32";
    rect(ctx, ink, -8 - walk, -16, 7, 16);
    rect(ctx, pants, -7 - walk, -16, 5, 14);
    if (!kick) {
      rect(ctx, ink, 2 + walk, -16, 7, 16);
      rect(ctx, pants, 3 + walk, -16, 5, 14);
    }
    rect(ctx, "#151c1c", -9 - walk, -2, 9, 2);
    if (!kick) rect(ctx, "#151c1c", 2 + walk, -2, 10, 2);
  }
  if (kick) {
    rect(ctx, ink, 3, -18, 25, 7);
    rect(ctx, greek ? skin : "#30343a", 4, -17, 23, 5);
    rect(ctx, "#1c2420", 24, -18, 7, 7);
  }
  // Torso and clothing details.
  rect(ctx, ink, -10, -31, 21, 18);
  rect(ctx, cloth, -9, -30, 19, 16);
  if (greek) {
    polygon(ctx, ink, [
      [-10, -31],
      [-7, -34],
      [8, -30],
      [12, -10],
      [-10, -10],
    ]);
    polygon(ctx, cloth, [
      [-8, -30],
      [-6, -32],
      [6, -28],
      [10, -11],
      [-8, -11],
    ]);
    rect(ctx, fighter.id === "plato" ? "#648eaa" : "#aca58b", -5, -26, 2, 13);
    rect(ctx, fighter.id === "plato" ? "#c0d7e0" : "#f5efd9", 2, -26, 3, 14);
    rect(ctx, "#a58e56", -8, -17, 16, 2);
    polygon(ctx, skin, [
      [-7, -32],
      [-1, -32],
      [2, -23],
      [-7, -25],
    ]);
  } else if (fighter.id === "huang" && !jacketLost) {
    rect(ctx, "#3b4144", -8, -28, 3, 13);
    rect(ctx, "#101619", -2, -29, 6, 13);
    rect(ctx, "#7a8280", 2, -28, 1, 13);
    rect(ctx, "#575d5d", 7, -27, 2, 12);
    rect(ctx, "#2f393a", -5, -18, 4, 2);
    rect(ctx, "#2f393a", 5, -18, 4, 2);
  } else if (fighter.id === "huang") {
    rect(ctx, "#263b2b", -8, -25, 18, 8);
    rect(ctx, "#b6e676", -4, -23, 8, 2);
  } else if (fighter.id === "musk") {
    rect(ctx, "#b2bcbc", -8, -20, 18, 3);
    rect(ctx, "#d44f4a", -5, -28, 3, 2);
    rect(ctx, "#5e7379", 3, -27, 5, 6);
    rect(ctx, "#90a6b0", 4, -26, 3, 2);
    rect(ctx, "#858f90", -9, -16, 19, 2);
    rect(ctx, "#f6f4ed", -2, -29, 2, 12);
    rect(ctx, "#6c7585", -13, -29, 4, 16);
    if (boosters > 0) rect(ctx, "#ada5f0", -13, -12, 4, 4);
  } else {
    rect(ctx, "#e4dfcf", -3, -30, 7, 14);
    polygon(ctx, fighter.id === "buffett" ? "#55708b" : "#564b58", [
      [-8, -30],
      [-3, -30],
      [0, -20],
      [-5, -22],
    ]);
    polygon(ctx, fighter.id === "buffett" ? "#243344" : "#2b2530", [
      [4, -30],
      [9, -30],
      [4, -20],
      [0, -20],
    ]);
    rect(ctx, fighter.id === "buffett" ? "#c36f54" : "#39353b", 0, -28, 2, 9);
    rect(ctx, "#778584", 6, -24, 2, 1);
    if (coatTorn) {
      polygon(ctx, "#b6967d", [
        [-8, -24],
        [-4, -22],
        [-7, -18],
        [-8, -20],
      ]);
      rect(ctx, "#171c18", 5, -21, 4, 3);
      rect(ctx, "#d7b098", 5, -20, 2, 2);
    }
  }
  // Head, neck and individual likeness details.
  rect(ctx, shade, -3, -34, 8, 5);
  rect(ctx, ink, -8, -48, 15, 15);
  rect(ctx, skin, -7, -47, 13, 14);
  rect(ctx, skin, 6, -43, 3, 6);
  rect(ctx, shade, -7, -41, 2, 7);
  rect(ctx, "#eec09b", -3, -46, 5, 2);
  const hair = fighter.hair;
  if (fighter.id === "huang") {
    rect(ctx, ink, -7, -49, 11, 3);
    rect(ctx, hair, -7, -48, 11, 3);
    rect(ctx, "#c2c5bc", -6, -48, 7, 1);
    rect(ctx, hair, -8, -46, 3, 6);
    rect(ctx, hair, 4, -46, 3, 2);
    rect(ctx, hair, 6, -44, 2, 2);
    rect(ctx, "#1a2425", -6, -42, 14, 1);
    rect(ctx, "#25353a", -5, -42, 4, 3);
    rect(ctx, "#25353a", 2, -42, 4, 3);
    rect(ctx, "#b1c1b5", -4, -41, 2, 1);
    rect(ctx, "#b1c1b5", 3, -41, 2, 1);
  } else if (fighter.id === "musk") {
    rect(ctx, hair, -7, -49, 13, 4);
    rect(ctx, hair, -8, -47, 3, 7);
    rect(ctx, hair, 3, -45, 4, 2);
    rect(ctx, "#776450", -5, -48, 7, 2);
    rect(ctx, "#2d3031", 1, -41, 2, 1);
    rect(ctx, "#955f59", 1, -36, 4, 1);
  } else if (fighter.id === "socrates") {
    rect(ctx, hair, -8, -44, 3, 8);
    rect(ctx, hair, 5, -44, 3, 7);
    polygon(ctx, ink, [
      [-7, -39],
      [7, -39],
      [7, -31],
      [2, -27],
      [-4, -30],
    ]);
    polygon(ctx, hair, [
      [-6, -39],
      [6, -39],
      [6, -32],
      [2, -28],
      [-3, -31],
    ]);
    rect(ctx, "#989f96", -3, -35, 2, 5);
    rect(ctx, "#eaebda", 2, -36, 2, 6);
    rect(ctx, "#293630", 1, -42, 2, 1);
    rect(ctx, "#9e7159", 5, -40, 3, 3);
  } else if (fighter.id === "plato") {
    rect(ctx, hair, -8, -49, 15, 5);
    rect(ctx, hair, -9, -45, 4, 9);
    rect(ctx, hair, 5, -45, 3, 6);
    rect(ctx, "#786550", -6, -48, 4, 2);
    rect(ctx, "#786550", 1, -47, 3, 2);
    polygon(ctx, hair, [
      [-6, -39],
      [6, -39],
      [6, -32],
      [0, -28],
      [-5, -32],
    ]);
    rect(ctx, "#293530", 1, -42, 2, 1);
    rect(ctx, "#806c59", 0, -35, 2, 5);
    rect(ctx, "#d7bd68", -8, -46, 16, 1);
  } else if (fighter.id === "nietzsche") {
    rect(ctx, hair, -8, -49, 14, 5);
    rect(ctx, hair, -9, -46, 3, 7);
    rect(ctx, "#716252", -6, -48, 7, 2);
    rect(ctx, "#273029", 1, -42, 2, 1);
    rect(ctx, hair, -5, -38, 13, 4);
    rect(ctx, hair, -6, -37, 3, 5);
    rect(ctx, hair, 6, -37, 3, 5);
    rect(ctx, "#b78b68", -1, -37, 3, 1);
  } else if (fighter.id === "buffett") {
    rect(ctx, hair, -8, -48, 14, 3);
    rect(ctx, hair, -8, -45, 3, 8);
    rect(ctx, hair, 5, -45, 3, 3);
    rect(ctx, "#afb4aa", -7, -47, 5, 1);
    rect(ctx, "#39454a", -6, -42, 13, 1);
    rect(ctx, "#39454a", -5, -42, 4, 3);
    rect(ctx, "#39454a", 2, -42, 4, 3);
    rect(ctx, "#b0cecf", -4, -41, 2, 1);
    rect(ctx, "#b0cecf", 3, -41, 2, 1);
    rect(ctx, "#a77060", 0, -36, 4, 1);
  }
  // Near arm: attack poses are drawn in world-facing direction.
  if (punch || blocking) {
    rect(ctx, ink, 6, -29, 7, 7);
    rect(ctx, cloth, 7, -28, 5, 5);
    rect(ctx, ink, 10, armY - 3, armX - 7, 7);
    rect(ctx, cloth, 11, armY - 2, armX - 8, 5);
    rect(ctx, ink, armX, armY - 4, 7, 7);
    rect(ctx, skin, armX + 1, armY - 3, 5, 5);
    if (blocking) {
      rect(ctx, skin, 10, -35, 5, 9);
      rect(ctx, "#e8e9dc", 12, -35, 2, 1);
    }
    if (attack?.type === "special") {
      rect(ctx, fighter.color, armX + 7, armY - 5, 3, 9);
      rect(ctx, fighter.color, armX + 5, armY - 7, 7, 3);
    }
  } else {
    rect(ctx, ink, 7, -28, 7, 14);
    rect(ctx, cloth, 8, -27, 5, 11);
    rect(ctx, ink, 8, -17, 7, 7);
    rect(ctx, skin, 9, -16, 5, 5);
    if (fighter.id === "plato") {
      rect(ctx, "#cec394", 11, -20, 6, 10);
      rect(ctx, "#fff1b9", 12, -19, 4, 8);
    }
    if (fighter.id === "buffett" && bagHeld) {
      rect(ctx, "#493f2c", 10, -11, 10, 10);
      rect(ctx, "#aa9865", 13, -13, 4, 2);
      rect(ctx, "#b4a265", 14, -7, 2, 2);
    }
  }
  ctx.restore();
}

export function drawCard(canvas, fighter) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fighter.color + "15";
  ctx.fillRect(34, 23, 80, 100);
  rect(ctx, fighter.color + "22", 34, 23, 2, 100);
  rect(ctx, fighter.color + "22", 112, 23, 2, 100);
  drawFighter(ctx, fighter, 75, 159, { scale: 3, facing: 1 });
}

function drawColumn(ctx, x, y, height, color, shade, accent) {
  rect(ctx, shade, x - 6, y, 44, 13);
  rect(ctx, color, x - 2, y + 3, 36, 6);
  rect(ctx, shade, x + 2, y + 13, 25, height - 25);
  rect(ctx, color, x + 5, y + 13, 5, height - 25);
  rect(ctx, color, x + 15, y + 13, 3, height - 25);
  rect(ctx, accent, x + 8, y + 13, 2, height - 25);
  rect(ctx, shade, x - 5, y + height - 12, 42, 12);
  rect(ctx, color, x - 3, y + height - 12, 38, 4);
}

export class ArenaArt {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.backgrounds = new Map();
  }
  background(stage) {
    if (this.backgrounds.has(stage)) return this.backgrounds.get(stage);
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = 510;
    const c = canvas.getContext("2d");
    c.imageSmoothingEnabled = false;
    const city = stage === "city",
      academy = stage === "academy";
    const sky = c.createLinearGradient(0, 0, 0, 510);
    sky.addColorStop(0, city ? "#181d2c" : academy ? "#171c30" : "#192924");
    sky.addColorStop(1, city ? "#29343a" : academy ? "#303241" : "#3c513d");
    c.fillStyle = sky;
    c.fillRect(0, 0, 960, 510);
    // Quiet pixel stars and a stepped moon.
    for (let i = 0; i < 85; i++) {
      const x = (i * 139 + 31) % 960,
        y = (i * 71 + 19) % 239;
      rect(
        c,
        i % 3 === 0 ? "#71866b" : "#425d50",
        x,
        y,
        i % 7 === 0 ? 3 : 2,
        2,
      );
    }
    if (city) {
      rect(c, "#a0958b", 722, 64, 38, 38);
      rect(c, "#a0958b", 714, 73, 54, 22);
      rect(c, "#181d2c", 710, 61, 32, 37);
      const buildings = [
        [0, 170, 84],
        [85, 124, 85],
        [180, 199, 82],
        [270, 96, 75],
        [357, 147, 99],
        [465, 176, 72],
        [548, 116, 111],
        [670, 207, 82],
        [768, 148, 78],
        [856, 95, 105],
      ];
      for (const [x, y, w] of buildings) {
        rect(c, "#152324", x, y, w, 410 - y);
        rect(c, "#354548", x, y, w, 4);
        for (let wx = x + 12; wx < x + w - 8; wx += 17)
          for (let wy = y + 18; wy < 367; wy += 24)
            rect(c, (wx + wy) % 3 === 0 ? "#a4b37b" : "#354848", wx, wy, 5, 7);
      }
      rect(c, "#354a47", 177, 170, 70, 24);
      rect(c, "#bacd90", 184, 177, 55, 3);
      rect(c, "#bacd90", 190, 185, 40, 3);
      rect(c, "#374652", 565, 136, 75, 26);
      rect(c, "#afa3d6", 573, 142, 60, 4);
      rect(c, "#afa3d6", 583, 151, 41, 3);
    } else {
      const moonColor = academy ? "#c5bfaf" : "#82977a";
      polygon(c, moonColor, [
        [742, 58],
        [783, 58],
        [783, 65],
        [794, 65],
        [794, 100],
        [783, 100],
        [783, 111],
        [742, 111],
        [742, 100],
        [731, 100],
        [731, 69],
        [742, 69],
      ]);
      rect(c, academy ? "#929394" : "#637b60", 756, 70, 8, 8);
      rect(c, academy ? "#acac9e" : "#718b68", 778, 87, 6, 9);
      polygon(c, "#253c32", [
        [0, 303],
        [66, 241],
        [123, 278],
        [198, 223],
        [259, 270],
        [321, 218],
        [400, 277],
        [482, 226],
        [549, 264],
        [637, 220],
        [710, 279],
        [792, 223],
        [847, 265],
        [913, 234],
        [960, 270],
        [960, 410],
        [0, 410],
      ]);
      polygon(c, "#2d4337", [
        [0, 343],
        [78, 290],
        [159, 310],
        [237, 274],
        [320, 315],
        [390, 276],
        [470, 330],
        [561, 271],
        [650, 310],
        [752, 281],
        [840, 331],
        [911, 282],
        [960, 312],
        [960, 410],
        [0, 410],
      ]);
      // A classical academy meeting the neon arcade.
      polygon(c, academy ? "#525361" : "#476048", [
        [260, 205],
        [477, 123],
        [692, 205],
      ]);
      polygon(c, academy ? "#303344" : "#293e30", [
        [288, 198],
        [477, 137],
        [664, 198],
      ]);
      rect(c, academy ? "#6c6577" : "#758367", 262, 205, 430, 14);
      rect(c, "#23372b", 273, 219, 408, 161);
      for (const x of [291, 365, 439, 513, 587, 655])
        drawColumn(
          c,
          x,
          223,
          160,
          academy ? "#4f5261" : "#435a43",
          academy ? "#333949" : "#304733",
          academy ? "#797387" : "#6c805f",
        );
      rect(c, "#3c513e", 253, 380, 455, 8);
      rect(c, "#53654a", 240, 388, 479, 9);
      rect(c, "#2b4130", 228, 397, 503, 13);
      if (academy) {
        rect(c, "#494256", 401, 182, 153, 16);
        c.font = "10px monospace";
        c.fillStyle = "#c7b8d4";
        c.textAlign = "center";
        c.fillText("KNOW THYSELF", 477, 194);
      } else {
        rect(c, "#8ea57a", 384, 178, 185, 18);
        rect(c, "#172a1f", 388, 181, 177, 12);
        c.font = "10px monospace";
        c.fillStyle = "#bed791";
        c.textAlign = "center";
        c.fillText("THE FUTURE IS ANCIENT", 477, 191);
      }
      drawColumn(c, 81, 212, 198, "#526b4e", "#354f38", "#8c9d6b");
      drawColumn(c, 847, 212, 198, "#526b4e", "#354f38", "#8c9d6b");
      rect(c, "#536b4a", 68, 206, 57, 6);
      rect(c, "#536b4a", 833, 206, 58, 6);
      rect(c, "#607354", 87, 151, 10, 49);
      rect(c, "#a2b17a", 80, 153, 24, 4);
      rect(c, "#344b36", 85, 135, 14, 20);
      rect(c, "#6a8158", 88, 126, 9, 14);
      rect(c, "#53694b", 854, 170, 12, 35);
      rect(c, "#79916a", 846, 174, 28, 4);
      rect(c, "#6c8058", 852, 151, 17, 19);
    }
    rect(c, "#53674b", 0, 410, 960, 5);
    rect(c, "#263b29", 0, 415, 960, 9);
    rect(c, "#182b21", 0, 424, 960, 86);
    // A perspective grid with carefully spaced broken stonework.
    for (let y = 434; y < 510; y += 20) rect(c, "#344a34", 0, y, 960, 1);
    for (let x = -200; x < 1160; x += 95)
      polygon(c, "#344a34", [
        [480 + (x - 480) * 0.64, 424],
        [x, 510],
        [x + 2, 510],
        [482 + (x - 480) * 0.64, 424],
      ]);
    for (let x = 0; x < 960; x += 48) {
      rect(c, "#75845a", x + 3, 411, 18, 2);
      rect(c, "#1c3223", x + 37, 411, 5, 4);
    }
    rect(c, "#9fa77f55", 250, 471, 70, 2);
    rect(c, "#9fa77f33", 740, 450, 42, 2);
    const vignette = c.createRadialGradient(480, 275, 60, 480, 275, 580);
    vignette.addColorStop(0, "#06140b00");
    vignette.addColorStop(1, "#06110b99");
    c.fillStyle = vignette;
    c.fillRect(0, 0, 960, 510);
    this.backgrounds.set(stage, canvas);
    return canvas;
  }

  render({ time, stage, selected, battle, reducedMotion = false }) {
    const c = this.ctx;
    c.save();
    c.clearRect(0, 0, 960, 510);
    if (battle?.shake && !reducedMotion)
      c.translate(
        Math.sin(time * 110) * battle.shake,
        Math.cos(time * 93) * battle.shake * 0.5,
      );
    c.drawImage(this.background(stage), 0, 0);
    const scanTime = reducedMotion ? 0 : time;
    // Atmospheric leaves and tiny sparks, kept behind characters.
    for (let i = 0; i < 12; i++) {
      const x = (i * 97 + scanTime * (7 + (i % 4))) % 960,
        y = 180 + ((i * 43) % 225) + Math.sin(scanTime + i) * 8;
      rect(c, i % 3 === 0 ? "#a3b56b55" : "#bdd58b25", x, y, 3, 2);
    }
    if (!battle) {
      this.shadow(484, FLOOR, 80, selected.color);
      const glow = c.createRadialGradient(484, 330, 10, 484, 330, 190);
      glow.addColorStop(0, selected.color + "1b");
      glow.addColorStop(1, selected.color + "00");
      c.fillStyle = glow;
      c.fillRect(275, 130, 420, 310);
      drawFighter(c, selected, 482, FLOOR, {
        scale: 5.5,
        time: reducedMotion ? 0 : time,
      });
      c.fillStyle = selected.color + "55";
      c.fillRect(396, 445, 172, 2);
      rect(c, selected.color, 436, 445, 92, 2);
      c.font = "8px monospace";
      c.textAlign = "center";
      c.fillStyle = "#96ad87";
      c.fillText("— SELECTED & READY —", 482, 465);
    } else {
      for (const e of battle.world.echoes) {
        const d = e.entry.data;
        c.save();
        c.globalAlpha = 0.35;
        c.strokeStyle = "#ee9891";
        c.setLineDash([6, 6]);
        c.strokeRect(d.x || 480, FLOOR - (d.y || 0) - 110, d.reach || 80, 110);
        c.restore();
      }
      for (const o of battle.world.objects) this.object(o, battle, time);
      for (const p of battle.players) {
        this.shadow(p.x, FLOOR, 44 - p.y * 0.06, p.fighter.color);
        if (p.trail > 0 && !reducedMotion)
          for (let i = 3; i > 0; i--)
            drawFighter(c, p.fighter, p.x - p.facing * i * 24, FLOOR - p.y, {
              scale: 3.3,
              facing: p.facing,
              attack: p.attack,
              alpha: 0.09 * (4 - i),
            });
        const box = battle.world.hurtbox(p),
          bag = battle.world.objects.find(
            (o) => o.kind === "bag" && o.owner === battle.players.indexOf(p),
          );
        if (battle.world.has("shadows")) {
          drawFighter(c, p.fighter, box.x, FLOOR - p.y, {
            scale: 3.3,
            facing: p.facing,
            alpha: 0.23,
          });
          c.save();
          c.strokeStyle = p.fighter.color;
          c.setLineDash([4, 5]);
          c.strokeRect(box.x - 25, FLOOR - p.y - 151, 50, 151);
          c.restore();
        }
        drawFighter(c, p.fighter, p.x, FLOOR - p.y, {
          scale: 3.3,
          facing: p.facing,
          time: reducedMotion ? 0 : time,
          moving: p.moving,
          attack: p.attack,
          blocking: p.blocking,
          crouching: p.crouching,
          hurt: p.stun > 0.1,
          jacketLost: p.jacketLost,
          coatTorn: p.coatTorn,
          bagHeld: bag?.held ?? true,
          boosters: p.boosters,
        });
        if (p.shield > 0) {
          c.strokeStyle = "#c7f77a66";
          c.lineWidth = 2;
          c.beginPath();
          c.ellipse(p.x, FLOOR - p.y - 76, 42, 82, 0, 0, Math.PI * 2);
          c.stroke();
        }
        if (p.blocking) {
          c.strokeStyle = "#cde4b688";
          c.lineWidth = 3;
          c.beginPath();
          c.arc(
            p.x + p.facing * 20,
            FLOOR - p.y - 75,
            46,
            p.facing === 1 ? -1.2 : 1.9,
            p.facing === 1 ? 1.2 : 4.4,
          );
          c.stroke();
        }
      }
      for (const shot of battle.projectiles) this.projectile(shot, time);
      for (const p of battle.particles) {
        c.globalAlpha = Math.min(1, p.life * 4);
        rect(c, p.color, p.x, p.y, p.size, p.size);
      }
      c.globalAlpha = 1;
    }
    // A subtle scanline texture gives the entire scene one coherent pixel look.
    c.fillStyle = "#0000000c";
    for (let y = 0; y < 510; y += 4) c.fillRect(0, y, 960, 1);
    c.restore();
  }

  object(o, battle, time) {
    const c = this.ctx,
      color = battle.players[o.owner]?.fighter.color || "#c7f77a",
      x = o.x - o.w / 2,
      y = FLOOR - o.y - o.h;
    if (o.held || o.life <= 0) return;
    c.save();
    if (o.disabled) c.globalAlpha = 0.3;
    if (o.kind === "candle" || o.kind === "chip") {
      rect(c, "#142819", x, y, o.w, o.h);
      rect(c, color, x + 2, y + 2, o.w - 4, o.h - 4);
      rect(c, "#344d2e", x + 6, y + 6, o.w - 12, Math.max(3, o.h - 12));
      rect(c, color, o.x - 2, y - 9, 4, 9);
      c.font = "bold 8px monospace";
      c.textAlign = "center";
      c.fillStyle = color;
      c.fillText("NVDA", o.x, y + 15);
    } else if (o.kind === "program") {
      rect(c, "#101d17", x, y, o.w, o.h);
      rect(c, color, x + 2, y + 2, o.w - 4, 10);
      rect(c, "#42523b", x + 4, y + 15, o.w - 8, 32);
      c.font = "10px monospace";
      c.textAlign = "center";
      c.fillStyle = "#d6efb9";
      c.fillText(o.direction === 1 ? "→" : "←", o.x, y + 26);
      c.fillText(
        (o.commands[o.index % o.commands.length] || "J") === "kick" ? "K" : "J",
        o.x,
        y + 43,
      );
    } else if (o.kind === "pad") {
      rect(c, "#45515b", x, y + 12, o.w, 12);
      rect(c, "#b3aedc", x + 6, y + 7, o.w - 12, 5);
      rect(c, "#5d647c", o.x - 6, y - 15, 12, 26);
      rect(c, "#e6ddc8", o.x - 4, y - 14, 8, 15);
      c.font = "bold 9px monospace";
      c.textAlign = "center";
      c.fillStyle = "#d8d6f8";
      c.fillText("TSLA ≥ " + Math.ceil(o.target), o.x, y - 24);
      c.fillText(Math.ceil(o.deadline) + "s", o.x, y - 36);
    } else if (o.kind === "booster") {
      rect(c, "#858d91", x, y, o.w, o.h);
      rect(c, "#d7d7d0", x + 4, y + 2, o.w - 8, 5);
      rect(c, "#313d47", x + 4, y + 11, o.w - 8, 7);
    } else if (o.kind === "starship") {
      polygon(c, "#e0e6df", [
        [x, y],
        [x + o.w - 28, y],
        [x + o.w, y + o.h / 2],
        [x + o.w - 28, y + o.h],
        [x, y + o.h],
      ]);
      rect(c, "#8583a5", x + 12, y + 5, o.w - 50, 4);
      rect(c, "#b6aef5", x + 36, y + 12, 40, 4);
      rect(c, "#f6b178", x - 18 - (Math.sin(time * 30) + 1) * 5, y + 4, 18, 14);
      c.font = "bold 8px monospace";
      c.fillStyle = "#313d45";
      c.textAlign = "left";
      c.fillText("SPACEX", x + 65, y + 17);
    } else if (o.kind === "train") {
      rect(c, "#8b663a", x, y, o.w, o.h);
      rect(c, "#e5c75e", x + 4, y + 3, o.w - 8, 6);
      for (let i = 12; i < o.w - 15; i += 30) {
        rect(c, "#203e47", x + i, y + 12, 20, 10);
        rect(c, "#141e1c", x + i, y + o.h - 2, 10, 7);
      }
      c.font = "bold 9px monospace";
      c.textAlign = "center";
      c.fillStyle = "#f9e5a2";
      c.fillText("BNSF  ·  BRK.B", o.x, y - 6);
    } else if (o.kind === "bag") {
      rect(c, "#493f2c", x, y, o.w, o.h);
      rect(c, "#c1a675", x + 9, y - 5, 12, 5);
      rect(c, "#bcb078", o.x - 2, y + 10, 4, 5);
    } else if (o.kind === "lamp") {
      rect(c, "#665c76", o.x - 3, y + 22, 6, o.h - 22);
      rect(c, "#9c94ac", x, y, o.w, 22);
      rect(c, "#f0e7bb", x + 3, y + 4, o.w - 6, 11);
      rect(c, "#50485a", x - 5, FLOOR - o.y - 5, o.w + 10, 5);
      c.save();
      c.globalAlpha = 0.08;
      polygon(c, "#fff1aa", [
        [o.x, y + 10],
        [o.x + (o.direction || 1) * 230, FLOOR],
        [o.x + (o.direction || 1) * 80, FLOOR],
      ]);
      c.restore();
    } else if (o.kind === "crystal") {
      polygon(c, "#81bbcd", [
        [x, FLOOR - o.y],
        [o.x, y],
        [x + o.w, FLOOR - o.y],
      ]);
      polygon(c, "#ccedf4", [
        [o.x, y],
        [o.x + 6, FLOOR - o.y],
        [o.x - 4, FLOOR - o.y],
      ]);
    } else if (o.kind === "question" || o.kind === "proof") {
      rect(c, o.kind === "proof" ? "#374c49" : "#6d634a", x, y, o.w, o.h);
      rect(c, "#a99a6b", x + 3, y + 3, o.w - 6, 3);
      c.font = "bold 21px monospace";
      c.textAlign = "center";
      c.fillStyle = "#f6e4ad";
      c.fillText("?", o.x, y + 25);
      if (o.switchRule) {
        rect(c, "#c7f77a", o.x - 3, y - 10, 6, 6);
        c.font = "8px monospace";
        c.fillText("RULE SWITCH", o.x, y - 16);
      }
    } else if (o.kind === "auction") {
      rect(c, "#725f35", x, y + 25, o.w, 14);
      rect(c, "#f0d36c", o.x - 14, y + 7, 28, 17);
      rect(c, "#cfb45b", o.x - 3, y, 6, 9);
      c.font = "bold 10px monospace";
      c.textAlign = "center";
      c.fillStyle = "#ffdf75";
      c.fillText("IPO $" + o.bid, o.x, y - 7);
      c.fillStyle = battle.players[o.bidder].fighter.color;
      c.fillText(battle.players[o.bidder].fighter.short, o.x, y - 20);
    } else if (o.kind === "jacket") {
      polygon(c, "#3f4944", [
        [x, y + 3],
        [x + 10, y - 5],
        [x + 22, y + 1],
        [x + 29, y - 5],
        [x + o.w, y + 3],
        [x + o.w - 4, y + 8],
        [x + 5, y + 8],
      ]);
      rect(c, "#91998c", o.x, y, 2, 8);
    } else if (o.kind === "depot") {
      rect(c, "#47523b", x, y, o.w, o.h);
      rect(c, "#f1cd68", x + 4, y + 4, o.w - 8, 6);
      c.font = "bold 9px monospace";
      c.textAlign = "center";
      c.fillStyle = "#efe0a5";
      c.fillText("BRK.B", o.x, y + 25);
    } else if (o.kind === "echo") {
      c.globalAlpha = 0.3;
      polygon(c, "#ee9891", [
        [o.x, y],
        [o.x + o.direction * o.w, y + 20],
        [o.x + o.direction * o.w, FLOOR - o.y],
        [o.x, FLOOR - o.y],
      ]);
    } else if (o.kind === "shadow") {
      rect(c, "#87d5e866", x, y, o.w, o.h);
    } else if (o.kind === "wallShot") {
      rect(c, "#e8c487", x, y, o.w, o.h);
      c.font = "10px monospace";
      c.fillStyle = "#203121";
      c.fillText("↔", x + 2, y + 15);
    }
    if (o.original) {
      c.strokeStyle = "#ffdd81";
      c.lineWidth = 2;
      c.strokeRect(x - 3, y - 3, o.w + 6, o.h + 6);
      c.font = "7px monospace";
      c.textAlign = "center";
      c.fillStyle = "#ffdd81";
      c.fillText("ORIGINAL", o.x, y - 8);
    }
    if (o.source) {
      c.strokeStyle = "#87d5e866";
      c.setLineDash([3, 5]);
      const parent = battle.world.objects.find((a) => a.id === o.source);
      if (parent) {
        c.beginPath();
        c.moveTo(o.x, y);
        c.lineTo(parent.x, FLOOR - parent.y - parent.h);
        c.stroke();
      }
      c.setLineDash([]);
    }
    if (o.stakes?.some((s) => s > 0) && o.hp < Infinity) {
      c.fillStyle = color + "aa";
      c.fillRect(x, FLOOR - o.y + 5, (o.w * Math.max(0, o.hp)) / 34, 2);
    }
    const near = battle.players.some(
      (p) => Math.abs(p.x - o.x) < 85 && Math.abs(p.y - o.y) < 85,
    );
    if (
      near &&
      ["booster", "bag", "lamp", "auction", "proof"].includes(o.kind)
    ) {
      c.font = "bold 9px monospace";
      c.textAlign = "center";
      c.fillStyle = "#ecf6d7";
      c.fillText("[R]", o.x, y - 9);
    }
    c.restore();
  }

  shadow(x, y, width, color) {
    const c = this.ctx;
    c.fillStyle = "#09150bb0";
    c.beginPath();
    c.ellipse(x, y + 5, width, 8, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = color + "24";
    c.beginPath();
    c.ellipse(x, y + 6, width - 5, 3, 0, 0, Math.PI * 2);
    c.fill();
  }
  projectile(p, time) {
    const c = this.ctx;
    c.save();
    c.translate(Math.round(p.x), Math.round(p.y));
    c.scale(p.direction, 1);
    rect(c, p.color + "25", -58, -10, 60, 20);
    rect(c, p.color + "66", -34, -5, 35, 10);
    if (p.type === "chip") {
      rect(c, "#1f3724", -14, -14, 28, 28);
      rect(c, p.color, -11, -11, 22, 22);
      rect(c, "#344628", -7, -7, 14, 14);
      for (let i = -8; i <= 8; i += 8) {
        rect(c, p.color, i, -18, 3, 4);
        rect(c, p.color, i, 14, 3, 4);
        rect(c, p.color, -18, i, 4, 3);
        rect(c, p.color, 14, i, 4, 3);
      }
    } else if (p.type === "rocket") {
      rect(c, "#fff0ce", -23, -11, 40, 22);
      polygon(c, "#adadff", [
        [17, -11],
        [32, 0],
        [17, 11],
      ]);
      rect(c, "#6e78a0", 0, -7, 10, 14);
      polygon(c, "#77768e", [
        [-23, -11],
        [-34, -22],
        [-12, -11],
      ]);
      polygon(c, "#77768e", [
        [-23, 11],
        [-34, 22],
        [-12, 11],
      ]);
      rect(c, "#f5ce81", -43, -7, 20, 14);
      rect(c, "#f58e65", -54, -4, 15, 8);
    } else if (p.type === "question") {
      c.strokeStyle = p.color;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(0, 0, 30, 0, Math.PI * 2);
      c.stroke();
      c.font = "bold 42px monospace";
      c.textAlign = "center";
      c.fillStyle = p.color;
      c.fillText("?", 0, 14);
    } else if (p.type === "crystal") {
      polygon(c, p.color, [
        [-20, 0],
        [0, -25],
        [22, 0],
        [0, 25],
      ]);
      polygon(c, "#e8ffff", [
        [0, -25],
        [8, 0],
        [0, 25],
        [-6, 0],
      ]);
    } else if (p.type === "coin") {
      c.fillStyle = "#ac862e";
      c.beginPath();
      c.ellipse(0, 0, 18, 23, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = p.color;
      c.beginPath();
      c.ellipse(2, 0, 14, 19, 0, 0, Math.PI * 2);
      c.fill();
      c.font = "bold 24px monospace";
      c.fillStyle = "#886c27";
      c.textAlign = "center";
      c.fillText("$", 2, 9);
    }
    c.restore();
  }
}
