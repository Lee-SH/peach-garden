const KEY = 'peach-garden.prefs';

export interface Prefs {
  auto: boolean;
  /** battle speed: 1, 2 or 3 */
  speed: number;
  /** animate characters as cutout rigs built from the painted art (default); false = the painted pose pictures */
  joints: boolean;
}

const DEFAULTS: Prefs = { auto: true, speed: 1, joints: true };
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

// ---------------------------------------------------------------------------
// Developer mode: shortcuts for testing later battles (jump anywhere, skip or win battles).
// Turn on with ?dev=1 in the address (?dev=0 turns it off) or by tapping the version on the title 7 times.
// ---------------------------------------------------------------------------
const DEV_KEY = 'peach-garden.dev';

export function isDev(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('dev');
    if (q === '1') localStorage.setItem(DEV_KEY, '1');
    if (q === '0') localStorage.removeItem(DEV_KEY);
    return localStorage.getItem(DEV_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDev(on: boolean) {
  try {
    if (on) localStorage.setItem(DEV_KEY, '1');
    else localStorage.removeItem(DEV_KEY);
  } catch {
    // stays as it was
  }
}
