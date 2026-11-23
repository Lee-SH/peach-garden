import { describe, expect, it } from 'vitest';
import { applyTroops, autoAssign, lootFor, loseTroops, troopCap, upgrade, upgradeCost, NO_GEAR } from '../src/core/army';
import { assignedTo, grantLoot, refine, setAssign, unassigned } from '../src/core/campaign';
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

  it('auto split respects caps and hands out everything that fits', () => {
    const caps: Record<string, number> = { a: troopCap(1), b: troopCap(3), c: troopCap(5) };
    const out = autoAssign({ inf: 300, cav: 100 }, caps);
    for (const id of Object.keys(caps)) expect(out[id].inf + out[id].cav).toBeLessThanOrEqual(caps[id]);
    expect(Object.values(out).reduce((a, t) => a + t.inf + t.cav, 0)).toBe(400);
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
    expect(s.autoArmy).toBe(false);
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
