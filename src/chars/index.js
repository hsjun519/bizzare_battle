import socrates from "./socrates.js";
import plato from "./plato.js";
import nietzsche from "./nietzsche.js";
import diogenes from "./diogenes.js";
import huang from "./huang.js";
import musk from "./musk.js";
import buffett from "./buffett.js";
import smith from "./smith.js";

export const PHILOSOPHERS = [socrates, plato, nietzsche, diogenes];
export const CAPITALISTS = [huang, musk, buffett, smith];
export const ROSTER = [...PHILOSOPHERS, ...CAPITALISTS];

export function charById(id) {
  return ROSTER.find((c) => c.id === id) || ROSTER[0];
}
