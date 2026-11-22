import { describe, expect, it } from 'vitest';
import { DEFAULT_POSITIONS, fromOrder, moveTo, normalizePositions, occupant } from '../src/core/formation';

describe('formation grid', () => {
  it('dragging onto an empty cell moves the general there', () => {
    const p = moveTo(DEFAULT_POSITIONS, 'zhangfei', { col: 0, row: 0 });
    expect(p.zhangfei).toEqual({ col: 0, row: 0 });
    expect(p.guanyu).toEqual(DEFAULT_POSITIONS.guanyu);
    expect(p.liubei).toEqual(DEFAULT_POSITIONS.liubei);
  });

  it('dragging onto another general swaps the two', () => {
    const p = moveTo(DEFAULT_POSITIONS, 'zhangfei', DEFAULT_POSITIONS.guanyu);
    expect(p.zhangfei).toEqual(DEFAULT_POSITIONS.guanyu);
    expect(p.guanyu).toEqual(DEFAULT_POSITIONS.zhangfei);
  });

  it('dropping on its own cell or outside the grid changes nothing', () => {
    expect(moveTo(DEFAULT_POSITIONS, 'guanyu', DEFAULT_POSITIONS.guanyu)).toEqual(DEFAULT_POSITIONS);
    expect(moveTo(DEFAULT_POSITIONS, 'guanyu', { col: 3, row: 0 })).toBe(DEFAULT_POSITIONS);
  });

  it('normalize fixes overlaps and places missing generals, dropping fallen ones', () => {
    const saved = { guanyu: { col: 0, row: 1 }, zhangfei: { col: 0, row: 1 }, liubei: { col: 1, row: 0 } };
    const p = normalizePositions(saved, ['guanyu', 'zhangfei']);
    expect(Object.keys(p).sort()).toEqual(['guanyu', 'zhangfei']);
    expect(p.guanyu).toEqual({ col: 0, row: 1 });
    expect(occupant(p, p.zhangfei)).toBe('zhangfei');
    expect(p.zhangfei).not.toEqual(p.guanyu);
  });

  it('ordered lists map to one general per column', () => {
    const p = fromOrder(['zhangfei', 'liubei', 'guanyu']);
    expect([p.zhangfei.col, p.liubei.col, p.guanyu.col]).toEqual([0, 1, 2]);
  });
});
