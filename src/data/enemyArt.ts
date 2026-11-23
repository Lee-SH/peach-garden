import { CHAR_SCALE } from './scale';

/**
 * Which picture an enemy uses. Common soldiers come in several looks that change as the chapter
 * goes on (ragtag peasants early, armoured troops late) and are mixed within a battle; officers
 * each have their own art. Art that hasn't been made yet falls back to the round token.
 *
 * Sheets: `node tools/add-art.mjs <sheet.png> <artId> grunt|boss` (see docs/design.md).
 */

export interface Variant {
  /** folder under public/art/ */
  art: string;
  /** first and last battle (1-based, within the chapter) where this look appears */
  from: number;
  to: number;
}

export const ENEMY_VARIANTS: Record<string, Variant[]> = {
  rebel: [
    { art: 'rebel_farmer', from: 1, to: 3 },
    { art: 'rebel_bandit', from: 1, to: 4 },
    { art: 'rebel_elite', from: 4, to: 6 },
  ],
  archer: [
    { art: 'archer_hunter', from: 1, to: 3 },
    { art: 'archer_xbow', from: 4, to: 6 },
  ],
  sorcerer: [
    { art: 'sorc_talisman', from: 2, to: 4 },
    { art: 'sorc_fire', from: 4, to: 6 },
  ],
  brute: [
    { art: 'brute_farmhand', from: 2, to: 4 },
    { art: 'brute_iron', from: 5, to: 6 },
  ],
};

/** On-screen standing height (px) by enemy type; officers are bigger. */
const HEIGHT: Record<string, number> = { rebel: 68, archer: 66, sorcerer: 68, brute: 82 };
export const BOSS_HEIGHT = 84;
/** sizes above are at CHAR_SCALE 1 (kept in step with the heroes) */
export const enemyHeight = (type: string, isBoss: boolean) => Math.round((isBoss ? BOSS_HEIGHT : HEIGHT[type] ?? 68) * CHAR_SCALE);

/**
 * Pick the look for one enemy of `type` in battle number `stage`, among the looks that exist.
 * Officers (not in ENEMY_VARIANTS) use their own id. Returns null when there is no art.
 */
export function pickEnemyArt(type: string, stage: number, available: (art: string) => boolean, rng: () => number): string | null {
  const variants = ENEMY_VARIANTS[type];
  if (!variants) return available(type) ? type : null;
  const inStage = variants.filter((v) => stage >= v.from && stage <= v.to && available(v.art));
  // nothing drawn for this stage yet → any look of this type that exists beats a token
  const pool = inStage.length ? inStage : variants.filter((v) => available(v.art));
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)].art;
}
