import { describe, expect, it } from 'vitest';
import { applyBattleResult, newCampaign } from '../src/core/save';
import { townOf } from '../src/data/town';

describe('town (진영)', () => {
  it('starts in 탁현 and moves to where the last battle was fought', () => {
    const s = newCampaign();
    expect(townOf(s).place).toBe('탁현');
    expect(townOf(s).next?.id).toBe('ch1-1');
    const after2 = { ...s, scenarioId: 'ch1-3' };
    expect(townOf(after2).place).toBe('청주');
    expect(townOf(after2).next?.label).toContain('3화');
  });

  it('after the last battle the gate is closed', () => {
    const s = applyBattleResult({ ...newCampaign(), scenarioId: 'ch1-6' }, [], null);
    expect(townOf(s).next).toBeNull();
    expect(townOf(s).place).toBe('광종');
  });
});
