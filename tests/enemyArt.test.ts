import { describe, expect, it } from 'vitest';
import { ENEMY_VARIANTS, pickEnemyArt } from '../src/data/enemyArt';

const all = () => true;
const picks = (type: string, stage: number, has: (a: string) => boolean = all) =>
  new Set(Array.from({ length: 50 }, (_, i) => pickEnemyArt(type, stage, has, () => i / 50)));

describe('enemy looks', () => {
  it('mixes the looks allowed in a stage', () => {
    expect(picks('rebel', 1)).toEqual(new Set(['rebel_farmer', 'rebel_bandit']));
    expect(picks('rebel', 4)).toEqual(new Set(['rebel_bandit', 'rebel_elite']));
    expect(picks('rebel', 6)).toEqual(new Set(['rebel_elite']));
  });

  it('every stage of chapter 1 has a look for every soldier type', () => {
    for (const type of Object.keys(ENEMY_VARIANTS))
      for (let stage = 1; stage <= 6; stage++) {
        // sorcerers and brutes first appear in battle 2
        if (stage === 1 && (type === 'sorcerer' || type === 'brute')) continue;
        expect(picks(type, stage).size, `${type} @${stage}`).toBeGreaterThan(0);
      }
  });

  it('falls back to any drawn look, then to no art', () => {
    expect(picks('rebel', 6, (a) => a === 'rebel_farmer')).toEqual(new Set(['rebel_farmer']));
    expect(picks('rebel', 1, () => false)).toEqual(new Set([null]));
  });

  it('officers use their own art when it exists', () => {
    expect(pickEnemyArt('zhangjue', 6, (a) => a === 'zhangjue', Math.random)).toBe('zhangjue');
    expect(pickEnemyArt('zhangjue', 6, () => false, Math.random)).toBeNull();
  });
});
