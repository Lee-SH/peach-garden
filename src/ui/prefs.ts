const KEY = 'peach-garden.prefs';

export interface Prefs {
  auto: boolean;
  fast: boolean;
  /** draw generals that have a cutout rig with it (false = frame-by-frame art) */
  rig: boolean;
}

const DEFAULTS: Prefs = { auto: true, fast: false, rig: true };

export function readPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
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
