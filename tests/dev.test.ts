import { describe, expect, it } from 'vitest';
import { devSaveAt, devWinCurrent } from '../src/core/simulate';
import { clearedFlag } from '../src/core/save';

describe('developer shortcuts', () => {
  it('builds a save standing before a later battle, with levels and loot from the earlier ones', () => {
    const s = devSaveAt('ch1-4');
    expect(s.scenarioId).toBe('ch1-4');
    expect(s.roster.guanyu.level).toBeGreaterThan(1);
    expect(s.army!.inf).toBeGreaterThan(0);
    expect(Object.values(s.roster).every((r) => r.alive)).toBe(true);
  });

  it('winning the last battle marks the chapter as cleared', () => {
    const s = devWinCurrent(devSaveAt('ch1-6'));
    expect(s.flags[clearedFlag('ch1-6')]).toBe(true);
  });
});
