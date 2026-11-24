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

describe('tavern (주막)', () => {
  it('opens one talk per battle won and tracks unread ones', async () => {
    const { newTalks, openTalks, replayable, talkSeenFlag } = await import('../src/data/tavern');
    const s0 = newCampaign();
    expect(openTalks(s0)).toHaveLength(0);
    const s2 = { ...s0, scenarioId: 'ch1-3' };
    expect(openTalks(s2).map((t) => t.id)).toEqual(['talk1', 'talk2']);
    expect(replayable(s2)).toEqual(['ch1-1', 'ch1-2']);
    const read = { ...s2, flags: { [talkSeenFlag('talk1')]: true } };
    expect(newTalks(read).map((t) => t.id)).toEqual(['talk2']);
    const end = applyBattleResult({ ...s0, scenarioId: 'ch1-6' }, [], null);
    expect(openTalks(end)).toHaveLength(6);
  });
});
