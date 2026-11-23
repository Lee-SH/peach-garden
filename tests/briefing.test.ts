import { describe, expect, it } from 'vitest';
import { briefingLine, josa } from '../src/data/briefing';

describe('wave briefing', () => {
  it('picks the right particle', () => {
    expect(josa('장각', '이', '가')).toBe('장각이');
    expect(josa('장보', '이', '가')).toBe('장보가');
    expect(josa('등무', '이', '가')).toBe('등무가');
  });

  it('first, middle, last and officer groups get different lines', () => {
    const lines = [briefingLine(0, 4), briefingLine(1, 4), briefingLine(3, 4), briefingLine(2, 4, '장량')];
    expect(new Set(lines).size).toBe(4);
    expect(briefingLine(2, 4, '장량')).toContain('장량이 나타났다');
    expect(briefingLine(1, 4, undefined, '직접 쓴 대사')).toBe('직접 쓴 대사');
  });
});
