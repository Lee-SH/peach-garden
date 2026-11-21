import { describe, expect, it } from 'vitest';
import { autoCampaign } from '../src/core/simulate';

/**
 * Difficulty contract (requested): on auto battle a sensible formation never loses,
 * but a careless one (low-defense 장비 as 선봉) can lose or get generals killed.
 */
const RUNS = 12;

function summarize(formation: string[]) {
  let retries = 0;
  let deaths = 0;
  let finished = 0;
  for (let seed = 1; seed <= RUNS; seed++) {
    const r = autoCampaign(formation, seed);
    if (r.finished) finished++;
    for (const e of r.log) {
      retries += e.attempts - 1;
      deaths += e.deaths.length;
    }
  }
  return { retries, deaths, finished };
}

describe('chapter 1 balance on auto', () => {
  it('관우 선봉 > 유비 > 장비 clears every battle first try with no deaths', () => {
    expect(summarize(['guanyu', 'liubei', 'zhangfei'])).toEqual({ retries: 0, deaths: 0, finished: RUNS });
  }, 60_000);

  it('장비 선봉 (lowest defense in front) is clearly punished', () => {
    const bad = summarize(['zhangfei', 'liubei', 'guanyu']);
    expect(bad.retries + bad.deaths).toBeGreaterThan(RUNS);
  }, 60_000);
});
