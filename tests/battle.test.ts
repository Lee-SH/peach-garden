import { describe, expect, it } from 'vitest';
import {
  attackShape,
  checkOutcome,
  executeAttack,
  gainXp,
  moveUnit,
  planEnemyTurn,
  playerAttack,
  resolveIntent,
  runEnemyPhase,
  undoMove,
} from '../src/core/battle';
import { reachableTiles } from '../src/core/grid';
import type { BattleState, Unit } from '../src/core/types';
import { ENEMIES, GENERALS, makeUnit } from '../src/data/units';
import { buildBattle, SCENARIOS } from '../src/data/scenarios';
import { applyBattleResult, newCampaign } from '../src/core/save';

const UP = { x: 0, y: -1 };
const RIGHT = { x: 1, y: 0 };

/** Small open battlefield. map rows use the scenario legend. */
function battle(units: Unit[], map = ['.....', '.....', '.....', '.....', '.....']): BattleState {
  const T = { '.': 'plain', F: 'forest', M: 'mountain', R: 'river', V: 'village' } as const;
  return {
    width: map[0].length,
    height: map.length,
    terrain: map.map((r) => r.split('').map((c) => T[c as keyof typeof T])),
    units,
    intents: [],
    turn: 1,
    objective: { type: 'defeatBoss', bossId: 'boss' },
    reinforcements: [],
  };
}

const liubei = (x: number, y: number) => makeUnit('liubei', GENERALS.liubei, 'player', { x, y });
const guanyu = (x: number, y: number) => makeUnit('guanyu', GENERALS.guanyu, 'player', { x, y });
const zhangfei = (x: number, y: number) => makeUnit('zhangfei', GENERALS.zhangfei, 'player', { x, y });
const rebel = (id: string, x: number, y: number) => makeUnit(id, ENEMIES.rebel, 'enemy', { x, y });
const archer = (id: string, x: number, y: number) => makeUnit(id, ENEMIES.archer, 'enemy', { x, y });
const boss = (x: number, y: number) => makeUnit('boss', ENEMIES.chengyuanzhi, 'enemy', { x, y });

describe('movement', () => {
  it('cannot cross rivers or mountains, can pass through allies but not stop on them', () => {
    const lb = liubei(0, 2);
    const gy = guanyu(1, 2);
    const s = battle([lb, gy], ['.....', '.....', '..R..', '..M..', '.....']);
    const tiles = reachableTiles(s, lb).map((p) => `${p.x},${p.y}`);
    expect(tiles).not.toContain('1,2'); // ally occupied
    expect(tiles).not.toContain('2,2'); // river
    expect(tiles).toContain('1,1'); // passes around
  });

  it('enemies block movement', () => {
    const lb = liubei(0, 0);
    const s = battle([lb, rebel('r', 1, 0), rebel('r2', 0, 1)]);
    expect(reachableTiles(s, lb)).toEqual([{ x: 0, y: 0 }]);
  });

  it('move can be undone before acting but not after', () => {
    const lb = liubei(2, 4);
    const s = battle([lb, rebel('r', 2, 1)]);
    moveUnit(s, lb, { x: 2, y: 2 });
    undoMove(lb, { x: 2, y: 4 });
    expect(lb.pos).toEqual({ x: 2, y: 4 });
    moveUnit(s, lb, { x: 2, y: 2 });
    playerAttack(s, lb, UP);
    expect(() => undoMove(lb, { x: 2, y: 4 })).toThrow();
  });
});

describe('attacks', () => {
  it('zhang fei pierces two tiles', () => {
    const zf = zhangfei(0, 2);
    const a = rebel('a', 1, 2);
    const b = rebel('b', 2, 2);
    const s = battle([zf, a, b]);
    playerAttack(s, zf, RIGHT);
    expect(a.dead && b.dead).toBe(true);
  });

  it('guan yu pushes the target one tile', () => {
    const gy = guanyu(0, 2);
    const t = boss(1, 2);
    const s = battle([gy, t]);
    playerAttack(s, gy, RIGHT);
    expect(t.hp).toBe(6 - 3);
    expect(t.pos).toEqual({ x: 2, y: 2 });
  });

  it('blocked push deals bump damage to both units', () => {
    const gy = guanyu(0, 2);
    const t = boss(1, 2);
    const wall = rebel('w', 2, 2);
    const s = battle([gy, t, wall]);
    playerAttack(s, gy, RIGHT);
    expect(t.pos).toEqual({ x: 1, y: 2 });
    expect(t.hp).toBe(6 - 3 - 1);
    expect(wall.hp).toBe(2 - 1);
  });

  it('forest reduces damage by 1, minimum 1', () => {
    const gy = guanyu(0, 2);
    const t = boss(1, 2);
    const s = battle([gy, t], ['.....', '.....', '.F...', '.....', '.....']);
    executeAttack(s, gy, RIGHT);
    expect(t.hp).toBe(6 - 2);
  });

  it('arrows hit the first unit in line and stop at mountains', () => {
    const ar = archer('a', 0, 0);
    const near = rebel('n', 0, 2);
    const s = battle([ar, near, liubei(0, 3)]);
    expect(attackShape(s, ar, { x: 0, y: 1 }).hits).toEqual([{ x: 0, y: 2 }]);
    const s2 = battle([archer('a', 0, 0), liubei(2, 0)], ['.M...', '.....', '.....', '.....', '.....']);
    expect(attackShape(s2, s2.units[0], RIGHT).hits).toEqual([]);
  });
});

describe('enemy intents', () => {
  it('enemy moves next to a player and declares an attack on it', () => {
    const lb = liubei(2, 4);
    const r = rebel('r', 2, 0);
    const s = battle([lb, r]);
    planEnemyTurn(s);
    expect(s.intents).toHaveLength(1);
    const { hits } = attackShape(s, r, s.intents[0].dir);
    expect(hits).toEqual([{ x: 2, y: 4 }]);
  });

  it('dodging out of the target tile avoids the attack', () => {
    const lb = liubei(2, 4);
    const r = rebel('r', 2, 0);
    const s = battle([lb, r]);
    planEnemyTurn(s);
    moveUnit(s, lb, { x: 0, y: 4 });
    resolveIntent(s, s.intents[0]);
    expect(lb.hp).toBe(lb.maxHp);
  });

  it('pushing an enemy moves its attack with it — and it can hit its ally', () => {
    // rebel at (2,2) targets liubei below at (2,3). Guan yu pushes the rebel right
    // so it now attacks (3,3) where another rebel stands.
    const lb = liubei(2, 3);
    const gy = guanyu(1, 2);
    const r = rebel('r', 2, 2);
    const victim = rebel('v', 3, 3);
    const s = battle([lb, gy, r, victim]);
    r.hp = 10; // survive guan yu's hit
    s.intents = [{ unitId: 'r', dir: { x: 0, y: 1 } }];
    playerAttack(s, gy, RIGHT);
    expect(r.pos).toEqual({ x: 3, y: 2 });
    resolveIntent(s, s.intents[0]);
    expect(lb.hp).toBe(lb.maxHp);
    expect(victim.hp).toBe(1);
  });

  it('killing an enemy cancels its intent', () => {
    const zf = zhangfei(0, 1);
    const r = rebel('r', 1, 1);
    const s = battle([zf, r, liubei(1, 2)]);
    s.intents = [{ unitId: 'r', dir: { x: 0, y: 1 } }];
    playerAttack(s, zf, RIGHT);
    expect(s.intents).toEqual([]);
  });
});

describe('xp and outcome', () => {
  it('only the killer gains xp; boss gives 3 and levels up', () => {
    const gy = guanyu(0, 2);
    const ev = gainXp(gy, 3);
    expect(gy.level).toBe(2);
    expect(gy.maxHp).toBe(8);
    expect(gy.power).toBe(4);
    expect(ev).toEqual([{ type: 'levelUp', unitId: 'guanyu', level: 2 }]);
  });

  it('victory when boss dies, defeat when the lord dies', () => {
    const b = boss(1, 0);
    const lb = liubei(0, 0);
    const s = battle([lb, b]);
    expect(checkOutcome(s)).toBe('ongoing');
    b.dead = true;
    expect(checkOutcome(s)).toBe('victory');
    b.dead = false;
    lb.dead = true;
    expect(checkOutcome(s)).toBe('defeat');
  });

  it('enemy phase increments the turn and resets player actions', () => {
    const lb = liubei(4, 4);
    const s = battle([lb, boss(0, 0)]);
    lb.acted = lb.moved = true;
    const { outcome } = runEnemyPhase(s);
    expect(outcome).toBe('ongoing');
    expect(s.turn).toBe(2);
    expect(lb.acted).toBe(false);
  });
});

describe('campaign', () => {
  it('dead generals stay dead and are not deployed again', () => {
    const save = newCampaign();
    const s = buildBattle(SCENARIOS['ch1-1'], save);
    s.units.find((u) => u.id === 'zhangfei')!.dead = true;
    const after = applyBattleResult(save, s, 'ch1-1');
    expect(after.roster.zhangfei.alive).toBe(false);
    const next = buildBattle(SCENARIOS['ch1-1'], after);
    expect(next.units.some((u) => u.id === 'zhangfei')).toBe(false);
  });

  it('levels carry over into the next battle', () => {
    const save = newCampaign();
    save.roster.guanyu = { level: 3, xp: 1, alive: true };
    const s = buildBattle(SCENARIOS['ch1-1'], save);
    const gy = s.units.find((u) => u.id === 'guanyu')!;
    expect(gy.maxHp).toBe(9);
    expect(gy.power).toBe(4);
  });
});
