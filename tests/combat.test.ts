import { describe, expect, it } from 'vitest';
import {
  baseDamage,
  battleXp,
  beginTurn,
  breather,
  gainXp,
  pickByAggro,
  SLOT_XP,
  XP_PER_KILL,
  xpToNext,
  canUse,
  chooseAction,
  endTurn,
  nextActor,
  outcome,
  previewOrder,
  seededRng,
  startWave,
  useSkill,
} from '../src/core/combat';
import type { Battle, Fighter } from '../src/core/types';
import { ENEMIES, GENERALS, makeFighter } from '../src/data/units';
import { buildParty, buildWave, SCENARIOS } from '../src/data/scenarios';
import { applyBattleResult, newCampaign } from '../src/core/save';

const noCrit = () => 0.99; // rng value above CRIT_CHANCE
const battle = (fighters: Fighter[], rng = noCrit): Battle => ({ fighters, rng });
const hero = (id: keyof typeof GENERALS) => makeFighter(id, GENERALS[id], 'player');
const foe = (id: string, type: keyof typeof ENEMIES = 'rebel') => makeFighter(id, ENEMIES[type], 'enemy');
const skill = (f: Fighter, n: 1 | 2 | 3) => f.skills[n - 1];

describe('turn order', () => {
  it('faster fighters act first and more often', () => {
    const fast = { ...foe('fast'), spd: 200 };
    const slow = { ...foe('slow'), spd: 100 };
    const b = battle([fast, slow]);
    const order = previewOrder(b, 3).map((f) => f.id);
    expect(order).toEqual(['fast', 'fast', 'slow']);
  });

  it('nextActor advances readiness for everyone and resets the actor after its turn', () => {
    const a = { ...foe('a'), spd: 100 };
    const c = { ...foe('c'), spd: 50 };
    const b = battle([a, c]);
    expect(nextActor(b).id).toBe('a');
    expect(c.cr).toBe(50);
    endTurn(a);
    expect(a.cr).toBe(0);
  });

  it('preview does not change the battle', () => {
    const b = battle([hero('liubei'), foe('r')]);
    previewOrder(b, 5);
    expect(b.fighters.every((f) => f.cr === 0)).toBe(true);
  });
});

describe('skills', () => {
  it('damage is reduced by defense and boosted by crits', () => {
    const gy = hero('guanyu');
    const r = foe('r');
    const base = baseDamage(gy, r, 1);
    expect(base).toBe(Math.round((gy.atk * 1.15 * 100) / (100 + r.def * 1.5)));
    const crit = battle([gy, r], () => 0);
    const ev = useSkill(crit, gy, skill(gy, 1), 'r');
    expect(ev[0]).toMatchObject({ type: 'damage', crit: true, amount: Math.round(base * 1.5) });
  });

  it('cooldown skills lock for N turns, ticking down at the start of own turn', () => {
    const gy = hero('guanyu');
    const b = battle([gy, { ...foe('r'), hp: 9999, maxHp: 9999 }]);
    useSkill(b, gy, skill(gy, 2), 'r');
    expect(canUse(gy, skill(gy, 2))).toBe(false);
    for (let i = 0; i < 3; i++) beginTurn(b, gy);
    expect(canUse(gy, skill(gy, 2))).toBe(true);
  });

  it('ultimate needs a full morale gauge and empties it', () => {
    const gy = hero('guanyu');
    const b = battle([gy, foe('a'), foe('c')]);
    expect(canUse(gy, skill(gy, 3))).toBe(false);
    gy.morale = 100;
    useSkill(b, gy, skill(gy, 3));
    expect(gy.morale).toBe(0);
    expect(b.fighters.filter((f) => f.side === 'enemy').every((f) => f.hp < f.maxHp)).toBe(true);
  });

  it('acting and getting hit fill morale', () => {
    const gy = hero('guanyu');
    const r = { ...foe('r'), hp: 9999, maxHp: 9999 };
    useSkill(battle([gy, r]), gy, skill(gy, 1), 'r');
    expect(gy.morale).toBe(20);
    expect(r.morale).toBe(10);
  });

  it('defense down makes the next hit stronger', () => {
    const gy = hero('guanyu');
    const boss = foe('boss', 'chengyuanzhi');
    const b = battle([gy, boss]);
    const before = baseDamage(gy, boss, 1);
    useSkill(b, gy, skill(gy, 2), 'boss');
    expect(baseDamage(gy, boss, 1)).toBeGreaterThan(before);
  });

  it('stun skips the turn, then wears off', () => {
    const zf = hero('zhangfei');
    const r = { ...foe('r'), hp: 9999, maxHp: 9999 };
    const b = battle([zf, r]);
    useSkill(b, zf, skill(zf, 2));
    expect(beginTurn(b, r).skip).toBe(true);
    endTurn(r);
    expect(beginTurn(b, r).skip).toBe(false);
  });

  it('burn deals damage at the start of the turn', () => {
    const lb = hero('liubei');
    lb.effects = [{ type: 'burn', turns: 2 }];
    const { events } = beginTurn(battle([lb]), lb);
    const amount = Math.round(lb.maxHp * 0.08);
    expect(events[0]).toMatchObject({ type: 'burn', amount });
    expect(lb.hp).toBe(lb.maxHp - amount);
  });

  it('heal does not exceed max HP', () => {
    const lb = hero('liubei');
    const gy = hero('guanyu');
    gy.hp = gy.maxHp - 10;
    useSkill(battle([lb, gy]), lb, skill(lb, 2));
    expect(gy.hp).toBe(gy.maxHp);
  });

  it('self buffs from an ally skill last through the caster\'s next turn', () => {
    const lb = hero('liubei');
    lb.morale = 100;
    const b = battle([lb, hero('guanyu'), foe('r')]);
    useSkill(b, lb, skill(lb, 3));
    endTurn(lb);
    expect(lb.effects.some((e) => e.type === 'atkUp')).toBe(true);
    expect(b.fighters[1].cr).toBe(30);
  });
});

describe('xp, auto battle, outcome', () => {
  it('xp comes from hits dealt + taken, weighted by slot, plus kills', () => {
    const gy = hero('guanyu');
    gy.slot = 0;
    gy.stats = { dealt: 10, taken: 6, kills: 2 };
    expect(battleXp(gy)).toBe(Math.round(16 * SLOT_XP[0]) + 2 * XP_PER_KILL);
    gy.slot = 2;
    expect(battleXp(gy)).toBeLessThan(Math.round(16 * SLOT_XP[0]) + 2 * XP_PER_KILL);
  });

  it('gainXp can level up several times', () => {
    const gy = hero('guanyu');
    expect(gainXp(gy, xpToNext(1) + xpToNext(2))).toEqual([2, 3]);
    expect(gy.xp).toBe(0);
  });

  it('the front slot hits harder and is targeted most often', () => {
    const front = { ...hero('guanyu'), slot: 0 };
    const rear = { ...hero('guanyu'), slot: 2 };
    const r = foe('r');
    expect(baseDamage(front, r, 1)).toBeGreaterThan(baseDamage(rear, r, 1));
    const picks = { front: 0, rear: 0 };
    for (let i = 0; i < 100; i++) picks[pickByAggro([front, rear], i / 100) === front ? 'front' : 'rear']++;
    expect(picks.front).toBeGreaterThan(picks.rear);
  });

  it('breather heals living allies between waves', () => {
    const lb = hero('liubei');
    lb.hp = 100;
    breather(battle([lb]));
    expect(lb.hp).toBe(100 + Math.round(lb.maxHp * 0.2));
  });

  it('auto battle uses the ultimate when ready and focuses the weakest enemy', () => {
    const gy = hero('guanyu');
    const weak = { ...foe('weak'), hp: 10 };
    const b = battle([gy, foe('a'), weak]);
    expect(chooseAction(b, gy)).toMatchObject({ skill: { id: 'guanyu2' }, targetId: 'weak' });
    gy.morale = 100;
    expect(chooseAction(b, gy).skill.id).toBe('guanyu3');
  });

  it('auto battle does not waste a heal when everyone is healthy', () => {
    const lb = hero('liubei');
    const b = battle([lb, foe('r')]);
    expect(chooseAction(b, lb).skill.id).toBe('liubei1');
  });

  it('victory when the wave is cleared; defeat when the lord falls', () => {
    const lb = hero('liubei');
    const r = foe('r');
    const b = battle([lb, r]);
    expect(outcome(b)).toBe('ongoing');
    r.dead = true;
    expect(outcome(b)).toBe('victory');
    lb.dead = true;
    expect(outcome(b)).toBe('defeat');
  });

  it('a full scripted battle with a seeded rng is reproducible and ends', () => {
    const run = () => {
      const sc = SCENARIOS['ch1-1'];
      const b: Battle = { fighters: buildParty(sc, newCampaign()), rng: seededRng(42) };
      let wave = 0;
      startWave(b, buildWave(sc, wave));
      for (let turns = 0; turns < 500; turns++) {
        const o = outcome(b);
        if (o === 'defeat') return `defeat@wave${wave}`;
        if (o === 'victory') {
          if (++wave >= sc.waves.length) return `victory in ${turns} turns`;
          startWave(b, buildWave(sc, wave));
          continue;
        }
        const actor = nextActor(b);
        if (!beginTurn(b, actor).skip) {
          const { skill: s, targetId } = chooseAction(b, actor);
          useSkill(b, actor, s, targetId);
        }
        endTurn(actor);
      }
      return 'timeout';
    };
    const first = run();
    expect(first).toBe(run());
    expect(first).not.toBe('timeout');
  });
});

describe('campaign', () => {
  it('dead generals stay dead and are not deployed again', () => {
    const save = newCampaign();
    const party = buildParty(SCENARIOS['ch1-1'], save);
    party.find((f) => f.id === 'zhangfei')!.dead = true;
    const after = applyBattleResult(save, party, 'ch1-1');
    expect(after.roster.zhangfei.alive).toBe(false);
    expect(buildParty(SCENARIOS['ch1-1'], after).map((f) => f.id)).toEqual(['guanyu', 'liubei']);
  });

  it('levels raise stats in the next battle', () => {
    const save = newCampaign();
    save.roster.guanyu = { level: 3, xp: 0, alive: true };
    const gy = buildParty(SCENARIOS['ch1-1'], save).find((f) => f.id === 'guanyu')!;
    const g = GENERALS.guanyu;
    expect(gy.maxHp).toBe(g.hp + g.growth!.hp * 2);
    expect(gy.atk).toBe(g.atk + g.growth!.atk * 2);
  });

  it('party is ordered by the saved formation', () => {
    const save = { ...newCampaign(), formation: ['zhangfei', 'guanyu', 'liubei'] };
    const party = buildParty(SCENARIOS['ch1-1'], save);
    expect(party.map((f) => [f.id, f.slot])).toEqual([['zhangfei', 0], ['guanyu', 1], ['liubei', 2]]);
  });
});
