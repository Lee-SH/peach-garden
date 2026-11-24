const KEY = 'peach-garden.prefs';

export interface Prefs {
  auto: boolean;
  /** battle speed: 1, 2 or 3 */
  speed: number;
  /** draw generals that have a cutout rig with it (false = frame-by-frame art) */
  rig: boolean;
}

const DEFAULTS: Prefs = { auto: true, speed: 1, rig: true };
export const SPEEDS = [1, 2, 3];

export function readPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    // older saves stored a fast on/off flag
    if (saved.speed === undefined && saved.fast) saved.speed = 2;
    const p: Prefs = { ...DEFAULTS, ...saved };
    if (!SPEEDS.includes(p.speed)) p.speed = 1;
    return p;
  } catch {
    return { ...DEFAULTS };
  }
}

export function writePrefs(p: Partial<Prefs>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readPrefs(), ...p }));
  } catch {
    // preferences just won't persist
  }
}
