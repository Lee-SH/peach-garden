import { describe, expect, it } from 'vitest';
import { applyTroops, splitByWeight, lootFor, loseTroops, troopCap, upgrade, upgradeCost, NO_GEAR } from '../src/core/army';
import { assignedTo, gearOf, grantLoot, grantLootDetail, refine, setAssign, unassigned, unrefine } from '../src/core/campaign';
import { baseDamage, useSkill } from '../src/core/combat';
import { newCampaign } from '../src/core/save';
import { buildParty, scenarioLoot, SCENARIOS } from '../src/data/scenarios';
import { ENEMIES, GENERALS, makeFighter } from '../src/data/units';

const hero = () => makeFighter('guanyu', GENERALS.guanyu, 'player');
const foe = () => makeFighter('e', ENEMIES.rebel, 'enemy', { level: 3, xp: 0 });

describe('troops', () => {
  it('infantry adds HP and defence, cavalry adds attack and speed', () => {
    const plain = hero();
    const led = hero();
    applyTroops(led, { inf: 200, cav: 100 });
    expect(led.maxHp).toBeGreaterThan(plain.maxHp);
    expect(led.spd).toBeGreaterThan(plain.spd);
    expect(baseDamage(led, foe(), 1)).toBeGreaterThan(baseDamage(plain, foe(), 1));
    expect(baseDamage(foe(), led, 1)).toBeLessThan(baseDamage(foe(), plain, 1));
  });

  it('soldiers are lost with damage, all of them when the general falls', () => {
    const f = hero();
    applyTroops(f, { inf: 200, cav: 100 });
    expect(loseTroops(f, f.maxHp * 0.5)).toBeGreaterThan(0);
    expect(f.troops!.inf).toBeLessThan(200);
    f.dead = true;
    loseTroops(f, 1);
    expect(f.troops!.inf + f.troops!.cav).toBe(0);
  });

  it('a hit reports the soldiers lost', () => {
    const f = hero();
    applyTroops(f, { inf: 200, cav: 0 });
    const e = foe();
    const ev = useSkill({ fighters: [f, e], rng: () => 0.99 }, e, e.skills[0], f.id);
    expect(ev.some((x) => x.type === 'troops' && x.id === f.id)).toBe(true);
  });

  it('soldiers go by merit, never above anyone\'s room', () => {
    const out = splitByWeight({ inf: 300, cav: 100 }, { a: 60, b: 30, c: 10 }, { a: 150, b: 300, c: 300 });
    expect(out.a.inf + out.a.cav).toBeLessThanOrEqual(150);
    expect(out.b.inf).toBeGreaterThan(out.c.inf);
    expect(Object.values(out).reduce((n, t) => n + t.inf + t.cav, 0)).toBe(400);
    // the top fighter gets the biggest share while there's room
    const free = splitByWeight({ inf: 100, cav: 0 }, { a: 60, b: 30, c: 10 }, { a: 999, b: 999, c: 999 });
    expect(free.a.inf).toBe(60);
    expect(free.b.inf).toBe(30);
    expect(free.c.inf).toBe(10);
  });

  it('a new battle starts at full strength (losses are not saved)', () => {
    const save = grantLoot(newCampaign(), lootFor(1, 0, false));
    const a = buildParty(SCENARIOS['ch1-1'], save);
    loseTroops(a[0], a[0].maxHp * 0.5);
    const b = buildParty(SCENARIOS['ch1-1'], save);
    expect(b[0].troops!.inf).toBe(b[0].troops!.inf0);
    expect(b[0].troops!.inf0).toBe(assignedTo(save, b[0].id).inf);
  });

  it('assigning by hand is limited by cap and free soldiers', () => {
    let s = grantLoot(newCampaign(), { troops: { inf: 500, cav: 0 }, items: {} });
    s = setAssign(s, 'liubei', { inf: 0, cav: 0 });
    s = setAssign(s, 'guanyu', { inf: 9999, cav: 0 });
    expect(assignedTo(s, 'guanyu').inf).toBe(troopCap(1));
    expect(unassigned(s).inf).toBeGreaterThan(0);
  });
});

describe('refining', () => {
  it('each step costs more, and grades need sharpening first', () => {
    expect(upgradeCost(NO_GEAR, 'edge')).toEqual({ item: 'whetstone', count: 1 });
    expect(upgradeCost({ ...NO_GEAR, edge: 3 }, 'edge')).toEqual({ item: 'whetstone', count: 4 });
    expect('blocked' in upgradeCost(NO_GEAR, 'grade')).toBe(true);
    expect(upgradeCost({ ...NO_GEAR, edge: 4 }, 'grade')).toEqual({ item: 'steel', count: 1 });
    expect(upgradeCost({ ...NO_GEAR, edge: 10, grade: 2 }, 'grade')).toEqual({ item: 'manual', count: 1 });
  });

  it('upgrading spends tools and fails without them', () => {
    expect(upgrade(NO_GEAR, {}, 'edge')).toBeNull();
    const r = upgrade(NO_GEAR, { whetstone: 3 }, 'edge')!;
    expect(r.gear.edge).toBe(1);
    expect(r.items.whetstone).toBe(2);
  });

  it('refined gear makes the general stronger in battle', () => {
    let s = grantLoot(newCampaign(), { troops: { inf: 0, cav: 0 }, items: { whetstone: 10, lacquer: 10, rawhide: 10 } });
    const before = buildParty(SCENARIOS['ch1-1'], s).find((f) => f.id === 'guanyu')!;
    for (const u of ['edge', 'lacquer', 'lacing'] as const) s = refine(s, 'guanyu', u)!;
    const after = buildParty(SCENARIOS['ch1-1'], s).find((f) => f.id === 'guanyu')!;
    expect(after.atk).toBeGreaterThan(before.atk);
    expect(after.def).toBeGreaterThan(before.def);
    expect(after.maxHp).toBeGreaterThan(before.maxHp);
  });
});

describe('undo and new soldiers', () => {
  it('undoing a refining step gives every tool back', () => {
    let s = grantLoot(newCampaign(), { troops: { inf: 0, cav: 0 }, items: { lacquer: 3 } });
    s = refine(s, 'liubei', 'lacquer')!;
    s = refine(s, 'liubei', 'lacquer')!;
    expect(s.items!.lacquer).toBe(0);
    s = unrefine(s, 'liubei', 'lacquer')!;
    expect(gearOf(s, 'liubei').lacquer).toBe(1);
    expect(s.items!.lacquer).toBe(2);
    s = unrefine(s, 'liubei', 'lacquer')!;
    expect(s.items!.lacquer).toBe(3);
    expect(unrefine(s, 'liubei', 'lacquer')).toBeNull();
  });

  it('sharpening cannot be undone below what the weapon grade needs', () => {
    let s = grantLoot(newCampaign(), { troops: { inf: 0, cav: 0 }, items: { whetstone: 99, steel: 1 } });
    for (let i = 0; i < 4; i++) s = refine(s, 'guanyu', 'edge')!;
    s = refine(s, 'guanyu', 'grade')!;
    expect(unrefine(s, 'guanyu', 'edge')).toBeNull();
    s = unrefine(s, 'guanyu', 'grade')!;
    expect(s.items!.steel).toBe(1);
    expect(unrefine(s, 'guanyu', 'edge')).not.toBeNull();
  });

  it('the best fighter of the battle gets the most new soldiers', () => {
    const r = grantLootDetail(newCampaign(), { troops: { inf: 100, cav: 50 }, items: {} }, { liubei: 10, guanyu: 70, zhangfei: 20 });
    const got = (id: string) => r.given[id].inf + r.given[id].cav;
    expect(got('guanyu')).toBeGreaterThan(got('zhangfei'));
    expect(got('zhangfei')).toBeGreaterThan(got('liubei'));
  });

  it('new soldiers fill free room and never undo hand-made choices', () => {
    let s = grantLoot(newCampaign(), { troops: { inf: 60, cav: 0 }, items: {} });
    s = setAssign(s, 'liubei', { inf: 0, cav: 0 });
    const kept = assignedTo(s, 'guanyu');
    const r = grantLootDetail(s, { troops: { inf: 0, cav: 30 }, items: {} });
    expect(assignedTo(r.save, 'guanyu').inf).toBeGreaterThanOrEqual(kept.inf) // kept, maybe topped up;
    const got = Object.values(r.given).reduce((a, t) => a + t.inf + t.cav, 0);
    expect(got).toBe(30 + unassigned(s).inf); // the new cavalry plus whatever sat in the camp
    expect(unassigned(r.save)).toEqual({ inf: 0, cav: 0 });
  });
});

describe('loot', () => {
  it('grows battle by battle; officers give 백련강; the chapter end gives the manual', () => {
    const l1 = scenarioLoot(SCENARIOS['ch1-1']);
    const l6 = scenarioLoot(SCENARIOS['ch1-6']);
    expect(l6.troops.inf).toBeGreaterThan(l1.troops.inf);
    expect(l6.items.whetstone!).toBeGreaterThan(l1.items.whetstone!);
    expect(l1.items.steel).toBe(2); // 등무, 정원지
    expect(l1.items.manual).toBeUndefined();
    expect(l6.items.manual).toBe(1);
  });
});
