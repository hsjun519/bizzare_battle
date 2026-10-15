// Original chiptune soundtrack in a compact tracker notation.
// Each bar has 16 sixteenth-note steps; `div` sets how many steps a token lasts.
// Tokens: note names (C#4), chords joined by "+", "-" holds, "." rests,
// "!" accents and "?" ghosts a hit.

const rep = (bar, n) => Array(n).fill(bar);

export const SONGS = {
  title: {
    bpm: 104,
    loop: true,
    tracks: [
      { inst: "pad", div: 16, bars: ["C3+Eb3+G3", "Ab2+C3+Eb3", "Eb3+G3+Bb3", "Bb2+D3+F3", "C3+Eb3+G3", "Ab2+C3+Eb3", "Bb2+D3+F3", "G2+B2+D3"] },
      {
        inst: "bass",
        div: 2,
        bars: [
          "C2 C3 C2 C3 C2 C3 C2 C3",
          "Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 Ab1 Ab2",
          "Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 Eb2 Eb3",
          "Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2",
          "C2 C3 C2 C3 C2 C3 C2 C3",
          "Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 Ab1 Ab2",
          "Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2",
          "G1 G2 G1 G2 B1 B2 D2 D3",
        ],
      },
      {
        inst: "lead",
        div: 2,
        bars: [
          "C5 - - G4 C5 - D5 -",
          "Eb5 - - D5 C5 - Ab4 -",
          "G4 - - Bb4 Eb5 - F5 -",
          "D5 - - - - - Bb4 -",
          "C5 - - G4 C5 - D5 -",
          "Eb5 - - F5 G5 - Ab5 -",
          "F5 - - Eb5 D5 - Bb4 -",
          "B4 - - - D5 - G5 -",
        ],
      },
      { inst: "kick", bars: ["x . . . . . . . x . x . . . . ."] },
      { inst: "snare", bars: [". . . . x . . . . . . . x . . .", ". . . . x . . . . . . . x . x x"] },
      { inst: "hat", bars: ["x . x . x . x . x . x . x . x ."] },
      { inst: "crash", bars: ["x", ...rep(".", 7)] },
    ],
  },

  select: {
    bpm: 124,
    loop: true,
    tracks: [
      {
        inst: "slap",
        bars: [
          "F2 . F3 . . F2 . F2 . . F3 . C3 . D3 .",
          "D2 . D3 . . D2 . D2 . . D3 . A2 . C3 .",
          "Bb1 . Bb2 . . Bb1 . Bb1 . . Bb2 . F2 . A2 .",
          "C2 . C3 . . C2 . C2 . . C3 . G2 . E2 .",
        ],
      },
      {
        inst: "arp",
        bars: [
          "F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 F5",
          "D4 F4 A4 F4 D4 F4 A4 F4 D4 F4 A4 F4 D4 F4 A4 D5",
          "Bb3 D4 F4 D4 Bb3 D4 F4 D4 Bb3 D4 F4 D4 Bb3 D4 F4 Bb4",
          "C4 E4 G4 E4 C4 E4 G4 E4 C4 E4 G4 E4 C4 E4 G4 C5",
        ],
      },
      {
        inst: "bell",
        div: 2,
        bars: ["A5 - C6 - A5 - F5 -", "D5 - F5 - A5 - - -", "Bb5 - A5 - G5 - F5 -", "E5 - G5 - C6 - - -", ". . . . . . . .", ". . . . . . . .", ". . . . . . . .", ". . . . . . . ."],
      },
      { inst: "kick", bars: ["x . . . x . . . x . . . x . . ."] },
      { inst: "clap", bars: [". . . . x . . . . . . . x . . ."] },
      { inst: "hat", bars: [". . x . . . x . . . x . . . x x?"] },
    ],
  },

  agora: {
    bpm: 150,
    loop: true,
    tracks: [
      {
        inst: "bass",
        bars: [
          "E2 . E2 E3 . E2 F2 . E2 . E2 E3 . E2 G#2 .",
          "F2 . F2 F3 . F2 G2 . F2 . F2 F3 . F2 A2 .",
          "E2 . E2 E3 . E2 F2 . E2 . E2 E3 . E2 G#2 .",
          "D2 . D2 D3 . D2 E2 . D2 . G#2 . B2 . D3 .",
        ],
      },
      {
        inst: "pluck",
        div: 2,
        bars: ["E4 G#4 B4 G#4 E5 B4 G#4 B4", "F4 A4 C5 A4 F5 C5 A4 C5", "E4 G#4 B4 G#4 E5 B4 G#4 B4", "D4 F4 A4 F4 D5 A4 F4 A4"],
      },
      {
        inst: "lead",
        div: 2,
        bars: [
          "E5 - F5 G#5 A5 - G#5 F5",
          "E5 - F5 - A5 - C6 -",
          "B5 - A5 G#5 F5 - E5 -",
          "F5 - E5 D5 E5 - - -",
          "G#5 - A5 B5 C6 - B5 A5",
          "C6 - B5 A5 G#5 - A5 -",
          "F5 - G#5 - E5 - D5 -",
          "E5 - - - - - - -",
        ],
      },
      { inst: "kick", bars: ["x . . x . . x . x . . x . . x ."] },
      { inst: "snare", bars: [". . . . x . . . . . . . x . . x?", ". . . . x . . . . . . . x . x x"] },
      { inst: "hat", bars: ["x . x x? x . x x? x . x x? x . x x?"] },
      { inst: "tom", bars: [...rep(". . . . . . . . . . . . . . . .", 7), ". . . . . . . . G3 . E3 . C3 . A2 ."] },
    ],
  },

  wallst: {
    bpm: 132,
    loop: true,
    swing: 0.08,
    tracks: [
      {
        inst: "slap",
        bars: [
          "D2 . D3 . . D2 . C3 . D2 . . F2 . G2 A2",
          "G1 . G2 . . G1 . F2 . G1 . . Bb1 . C2 D2",
          "Bb1 . Bb2 . . Bb1 . A2 . Bb1 . . D2 . F2 A2",
          "A1 . A2 . . A1 . G2 . A1 . . C#2 . E2 G2",
        ],
      },
      {
        inst: "brass",
        bars: [
          ". . . . F4+A4+C5 . . F4+A4+C5 . . . . . . . .",
          ". . . . F4+Bb4+D5 . . F4+Bb4+D5 . . . . . . . .",
          ". . . . F4+A4+D5 . . F4+A4+D5 . . . . . . . .",
          ". . . . E4+G4+C#5 . . E4+G4+C#5 . . . . E4+G4+C#5 - . .",
        ],
      },
      {
        inst: "lead",
        div: 2,
        bars: [". . . . . . . .", ". . . . . . . .", ". . . . . . . .", ". . . . . . . .", "A5 - - G5 F5 - D5 -", "F5 - G5 - Bb5 - A5 G5", "F5 - - E5 D5 - C5 D5", "E5 - - - C#5 - A4 -"],
      },
      { inst: "kick", bars: ["x . . . . . x . . . x . . . . ."] },
      { inst: "snare", bars: [". . x? . x . . x? . . . . x . . x?"] },
      { inst: "hat", bars: ["x . x x? x . x x? x . x x? x . x x"] },
    ],
  },

  launch: {
    bpm: 164,
    loop: true,
    tracks: [
      { inst: "pad", div: 16, bars: ["A3+C4+E4", "F3+A3+C4", "C3+E3+G3", "G3+B3+D4"] },
      { inst: "bass", div: 2, bars: ["A1 A2 A1 A2 A1 A2 A1 A2", "F1 F2 F1 F2 F1 F2 F1 F2", "C2 C3 C2 C3 C2 C3 C2 C3", "G1 G2 G1 G2 G1 G2 G1 G2"] },
      {
        inst: "arp",
        bars: [
          "A4 C5 E5 A5 E5 C5 A4 C5 E5 A5 E5 C5 A4 C5 E5 C5",
          "F4 A4 C5 F5 C5 A4 F4 A4 C5 F5 C5 A4 F4 A4 C5 A4",
          "C5 E5 G5 C6 G5 E5 C5 E5 G5 C6 G5 E5 C5 E5 G5 E5",
          "G4 B4 D5 G5 D5 B4 G4 B4 D5 G5 D5 B4 G4 B4 D5 B4",
        ],
      },
      {
        inst: "lead",
        div: 2,
        bars: ["E5 - - - A5 - - B5", "C6 - - B5 A5 - - -", "G5 - - - E5 - - G5", "D5 - - - - - - -", "E5 - - - A5 - - B5", "C6 - - D6 E6 - - -", "G5 - - A5 B5 - - D6", "B5 - - - - - - -"],
      },
      { inst: "kick", bars: ["x . . . x . . . x . . . x . . ."] },
      { inst: "snare", bars: [". . . . x . . . . . . . x . . .", ". . . . x . . . . . . . x . x x"] },
      { inst: "hat", bars: ["x? . x . x? . x . x? . x . x? . x x"] },
    ],
  },

  cave: {
    bpm: 138,
    loop: true,
    tracks: [
      { inst: "pad", div: 16, bars: ["D3+F3+A3", "Eb3+G3+Bb3", "Bb2+D3+F3", "A2+C#3+E3"] },
      {
        inst: "bass",
        bars: [
          "D2 . . D2 . . D2 . Eb2 . . D2 . . C2 .",
          "Eb2 . . Eb2 . . Eb2 . F2 . . Eb2 . . D2 .",
          "Bb1 . . Bb1 . . Bb1 . C2 . . Bb1 . . A1 .",
          "A1 . . A1 . . A1 . Bb1 . . A1 . . C#2 .",
        ],
      },
      { inst: "bell", div: 2, bars: ["D5 - - - A4 - - -", "Eb5 - - - D5 - C5 -", "Bb4 - - - F5 - - -", "E5 - - - C#5 - - -"] },
      {
        inst: "lead",
        div: 2,
        bars: [". . . . . . . .", ". . . . . . . .", ". . . . . . . .", ". . . . . . . .", "A5 - Bb5 - A5 - F5 -", "G5 - - Eb5 D5 - - -", "F5 - D5 - Bb4 - D5 -", "C#5 - - - E5 - A5 -"],
      },
      { inst: "kick", bars: ["x . . . . . x . . . x . . . . ."] },
      { inst: "snare", bars: [". . . . x . . . . . . . x . . ."] },
      { inst: "hat", bars: ["x . x? . x . x? . x . x? . x . x x?"] },
      { inst: "tom", bars: [...rep(". . . . . . . . . . . . . . . .", 3), ". . . . . . . . D3 . . D3 . A2 . ."] },
    ],
  },

  datacenter: {
    bpm: 148,
    loop: true,
    tracks: [
      {
        inst: "bass",
        bars: [
          "F#1 . F#2 F#2 F#1 . F#2 F#2 F#1 . F#2 F#2 F#1 . F#2 E2",
          "D1 . D2 D2 D1 . D2 D2 D1 . D2 D2 D1 . D2 E2",
          "E1 . E2 E2 E1 . E2 E2 E1 . E2 E2 E1 . E2 G#2",
          "C#2 . C#3 C#3 C#2 . C#3 C#3 C#2 . C#3 C#3 C#2 . E3 F3",
        ],
      },
      {
        inst: "arp",
        bars: [
          "F#4 A4 C#5 F#5 C#5 A4 F#4 A4 C#5 F#5 C#5 A4 F#4 A4 C#5 A4",
          "D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 F#4",
          "E4 G#4 B4 E5 B4 G#4 E4 G#4 B4 E5 B4 G#4 E4 G#4 B4 G#4",
          "C#4 F4 G#4 C#5 G#4 F4 C#4 F4 G#4 C#5 G#4 F4 C#4 F4 G#4 F4",
        ],
      },
      { inst: "lead", div: 2, bars: ["C#6 - B5 - A5 - F#5 -", "A5 - - - F#5 - D5 -", "E5 - G#5 - B5 - E6 -", "C#6 - - - - - - -", ". . . . . . . .", ". . . . . . . .", ". . . . . . . .", ". . . . . . . ."] },
      { inst: "kick", bars: ["x . . . x . . . x . . . x . . ."] },
      { inst: "clap", bars: [". . . . x . . . . . . . x . . ."] },
      { inst: "ohat", bars: [". . x . . . x . . . x . . . x ."] },
      { inst: "hat", bars: ["x? x? . x? x? x? . x? x? x? . x? x? x? . x?"] },
    ],
  },

  victory: {
    bpm: 140,
    loop: false,
    tracks: [
      { inst: "lead", bars: ["G4 . C5 . E5 . G5 - - - E5 . G5 - - -", "C6 - - - - - - - - - - - . . . ."] },
      { inst: "brass", div: 8, bars: ["C4+E4+G4 F4+A4+C5", "C4+E4+G4+C5 -"] },
      { inst: "bass", div: 4, bars: ["C2 C2 F2 F2", "C2 - - ."] },
      { inst: "snare", bars: ["x x x x x x x x X . . . X . . .", "X . . . . . . . . . . . . . . ."] },
      { inst: "crash", div: 16, bars: [".", "x"] },
    ],
  },

  defeat: {
    bpm: 90,
    loop: false,
    tracks: [
      { inst: "lead", div: 2, bars: ["A4 - G4 - E4 - - -", "D4 - - - - - - -"] },
      { inst: "pad", div: 16, bars: ["A2+C3+E3", "D3+F3+A3"] },
      { inst: "bass", div: 8, bars: ["A1 -", "D2 -"] },
    ],
  },
};

export const STAGE_SONGS = {
  agora: "agora",
  wallst: "wallst",
  launch: "launch",
  cave: "cave",
  datacenter: "datacenter",
};
