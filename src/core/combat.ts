import type { Battle, CombatEvent, EffectType, Fighter, Outcome, Side, Skill } from './types';

export const CRIT_CHANCE = 0.15;
export const CRIT_MULT = 1.5;
export const MORALE_PER_ACTION = 20;
export const MORALE_PER_HIT = 10;
export const BURN_RATIO = 0.08; // of max HP per turn

/** Formation slot effects. 0 = 선봉(front), 1 = 중군(middle), 2 = 후군(rear). */
export const SLOT_NAMES = ['선봉', '중군', '후군'];
/** damage dealt multiplier */
export const SLOT_DAMAGE = [1.15, 1.0, 0.9];
/** chance weight of being picked by a single-target enemy attack */
export const SLOT_AGGRO = [0.5, 0.3, 0.2];
/** XP multiplier on hits dealt + hits taken */
export const SLOT_XP = [1.5, 1.15, 0.95];
/** damage taken by column: the rear is harder to reach, so stacking everyone in front has a cost */
export const SLOT_TAKEN = [1.0, 0.9, 0.8];
export const XP_PER_KILL = 2;
export const XP_PER_BOSS_KILL = 6;

export const xpToNext = (level: number) => 10 + level * 6;

export const living = (b: Battle, side?: Side) => b.fighters.filter((f) => !f.dead && (!side || f.side === side));
export const opponents = (b: Battle, f: Fighter) => living(b, f.side === 'player' ? 'enemy' : 'player');
export const hasEffect = (f: Fighter, t: EffectType) => f.effects.some((e) => e.type === t);

export function getFighter(b: Battle, id: string) {
  const f = b.fighters.find((x) => x.id === id);
  if (!f) throw new Error(`fighter not found: ${id}`);
  return f;
}

// ---------------------------------------------------------------------------
// Turn order (combat readiness)
// ---------------------------------------------------------------------------

/** Time until a fighter's readiness reaches 100. */
const timeToReady = (f: Fighter) => Math.max(0, 100 - f.cr) / f.spd;

function pickFirst(fs: Fighter[]): Fighter {
  // Earliest to 100; ties → faster unit, then player side
  return [...fs].sort(
    (a, b) => timeToReady(a) - timeToReady(b) || b.spd - a.spd || (a.side === 'player' ? -1 : 1),
  )[0];
}

/** Advance time until someone reaches 100 readiness and return them. */
export function nextActor(b: Battle): Fighter {
  const alive = living(b);
  const actor = pickFirst(alive);
  const t = timeToReady(actor);
  for (const f of alive) f.cr = Math.min(100, f.cr + f.spd * t);
  actor.cr = 100;
  return actor;
}

/** Predict the next `n` actors without changing the battle (for the turn order bar). */
export function previewOrder(b: Battle, n: number): Fighter[] {
  const sim = living(b).map((f) => ({ f, cr: f.cr }));
  const order: Fighter[] = [];
  for (let i = 0; i < n && sim.length; i++) {
    const ready = (s: { f: Fighter; cr: number }) => Math.max(0, 100 - s.cr) / s.f.spd;
    sim.sort((a, c) => ready(a) - ready(c) || c.f.spd - a.f.spd || (a.f.side === 'player' ? -1 : 1));
    const first = sim[0];
    const t = ready(first);
    for (const s of sim) s.cr += s.f.spd * t;
    order.push(first.f);
    first.cr = 0;
  }
  return order;
}

// ---------------------------------------------------------------------------
// Turn lifecycle
// ---------------------------------------------------------------------------

/** Start-of-turn: cooldowns tick, burn deals damage, stun skips the turn. */
export function beginTurn(_b: Battle, actor: Fighter): { events: CombatEvent[]; skip: boolean } {
  const events: CombatEvent[] = [];
  for (const k of Object.keys(actor.cooldowns)) actor.cooldowns[k] = Math.max(0, actor.cooldowns[k] - 1);
  if (hasEffect(actor, 'burn')) {
    const amount = Math.max(1, Math.round(actor.maxHp * BURN_RATIO));
    events.push({ type: 'burn', id: actor.id, amount });
    dealDamage(actor, amount, null, events);
  }
  if (actor.dead) return { events, skip: true };
  if (hasEffect(actor, 'stun')) {
    events.push({ type: 'stunned', id: actor.id });
    return { events, skip: true };
  }
  return { events, skip: false };
}

/** End-of-turn: readiness resets, the actor's effects lose a turn. */
export function endTurn(actor: Fighter) {
  actor.cr = 0;
  actor.effects = actor.effects.map((e) => ({ ...e, turns: e.turns - 1 })).filter((e) => e.turns > 0);
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export function canUse(actor: Fighter, skill: Skill) {
  if ((actor.cooldowns[skill.id] ?? 0) > 0) return false;
  if (skill.ultimate && actor.morale < 100) return false;
  return true;
}

export function resolveTargets(b: Battle, actor: Fighter, skill: Skill, targetId?: string): Fighter[] {
  switch (skill.target) {
    case 'self':
      return [actor];
    case 'allAllies':
      return living(b, actor.side);
    case 'allEnemies':
      return opponents(b, actor);
    case 'enemy': {
      const foes = opponents(b, actor);
      const t = targetId ? foes.find((f) => f.id === targetId) : undefined;
      if (!t) throw new Error(`invalid target ${targetId} for ${skill.id}`);
      return [t];
    }
  }
}

/** How strongly defense reduces damage. Higher = defense matters more (formation choices matter more). */
export const DEF_WEIGHT = 1.5;

/** Damage before crit: attack × power × 100 / (100 + def × DEF_WEIGHT). */
export function baseDamage(attacker: Fighter, target: Fighter, power: number) {
  const slotMult = attacker.side === 'player' ? SLOT_DAMAGE[attacker.slot] ?? 1 : 1;
  const atk = attacker.atk * slotMult * (hasEffect(attacker, 'atkUp') ? 1.3 : 1);
  const def = target.def * (hasEffect(target, 'defDown') ? 0.5 : 1);
  const taken = target.side === 'player' ? SLOT_TAKEN[target.slot] ?? 1 : 1;
  return Math.max(1, Math.round((atk * power * 100 * taken) / (100 + def * DEF_WEIGHT)));
}

export function useSkill(b: Battle, actor: Fighter, skill: Skill, targetId?: string): CombatEvent[] {
  if (!canUse(actor, skill)) throw new Error(`${actor.id} cannot use ${skill.id}`);
  const events: CombatEvent[] = [];
  const targets = resolveTargets(b, actor, skill, targetId);

  for (const t of targets) {
    if (skill.power > 0) {
      const crit = b.rng() < CRIT_CHANCE;
      const amount = Math.round(baseDamage(actor, t, skill.power) * (crit ? CRIT_MULT : 1));
      events.push({ type: 'damage', id: t.id, amount, crit });
      actor.stats.dealt += 1;
      t.stats.taken += 1;
      if (!t.dead) t.morale = Math.min(100, t.morale + MORALE_PER_HIT);
      dealDamage(t, amount, actor, events);
    }
    if (skill.heal && !t.dead) {
      const amount = Math.min(t.maxHp - t.hp, Math.round(t.maxHp * skill.heal));
      t.hp += amount;
      events.push({ type: 'heal', id: t.id, amount });
    }
  }

  for (const spec of skill.effects ?? []) {
    const receivers = spec.on === 'self' ? [actor] : targets.filter((t) => !t.dead);
    for (const r of receivers) {
      r.effects = r.effects.filter((e) => e.type !== spec.type);
      // +1 so an effect put on yourself still lasts through your next turn
      r.effects.push({ type: spec.type, turns: spec.turns + (r === actor ? 1 : 0) });
      events.push({ type: 'effect', id: r.id, effect: spec.type });
    }
  }

  // Support skills (heal/buff) count as an action for XP, like a hit
  if (skill.power === 0) actor.stats.dealt += 1;

  if (skill.allyCrPush) {
    for (const a of living(b, actor.side)) if (a !== actor) a.cr = Math.min(100, a.cr + skill.allyCrPush);
  }

  if (skill.cooldown) actor.cooldowns[skill.id] = skill.cooldown;
  actor.morale = skill.ultimate ? 0 : Math.min(100, actor.morale + MORALE_PER_ACTION);
  return events;
}

function dealDamage(t: Fighter, amount: number, source: Fighter | null, events: CombatEvent[]) {
  if (t.dead) return;
  t.hp = Math.max(0, t.hp - amount);
  if (t.hp > 0) return;
  t.dead = true;
  t.effects = [];
  events.push({ type: 'death', id: t.id });
  if (source && source.side !== t.side) source.stats.kills += t.isBoss ? XP_PER_BOSS_KILL / XP_PER_KILL : 1;
}

/** XP earned in a battle: hits dealt + taken, weighted by formation slot, plus kills. */
export function battleXp(f: Fighter) {
  return Math.round((f.stats.dealt + f.stats.taken) * (SLOT_XP[f.slot] ?? 1) + f.stats.kills * XP_PER_KILL);
}

/** Apply XP; returns the levels reached (empty if none). */
export function gainXp(f: Fighter, amount: number): number[] {
  const levels: number[] = [];
  f.xp += amount;
  while (f.xp >= xpToNext(f.level)) {
    f.xp -= xpToNext(f.level);
    f.level += 1;
    levels.push(f.level);
  }
  return levels;
}

// ---------------------------------------------------------------------------
// AI (enemies, and players on auto)
// ---------------------------------------------------------------------------

export function chooseAction(b: Battle, actor: Fighter): { skill: Skill; targetId?: string } {
  // Strongest available skill first: ultimate → cooldown skill → basic
  const usable = actor.skills.filter((s) => canUse(actor, s));
  const skill =
    usable.find((s) => s.ultimate) ??
    usable.find((s) => s.cooldown > 0 && !isWastedHeal(b, actor, s)) ??
    usable[0];
  if (skill.target !== 'enemy') return { skill };
  const foes = opponents(b, actor);
  if (actor.side === 'player') {
    // Auto battle: focus the weakest enemy to remove attackers quickly
    const t = [...foes].sort((a, c) => a.hp - c.hp)[0];
    return { skill, targetId: t.id };
  }
  // Enemies mostly hit the front line: weighted by the target's formation slot
  return { skill, targetId: pickByAggro(foes, b.rng()).id };
}

export function pickByAggro(foes: Fighter[], roll: number): Fighter {
  const weights = foes.map((f) => SLOT_AGGRO[f.slot] ?? 0.2);
  const total = weights.reduce((a, c) => a + c, 0);
  let x = roll * total;
  for (let i = 0; i < foes.length; i++) {
    x -= weights[i];
    if (x < 0) return foes[i];
  }
  return foes[foes.length - 1];
}

/** Don't spend a heal when nobody is hurt. */
function isWastedHeal(b: Battle, actor: Fighter, s: Skill) {
  return !!s.heal && s.power === 0 && living(b, actor.side).every((f) => f.hp > f.maxHp * 0.8);
}

// ---------------------------------------------------------------------------
// Waves & outcome
// ---------------------------------------------------------------------------

/** HP recovered by living allies while running to the next group ("숨 고르기"). */
export const WAVE_HEAL = 0.2;

/** Replace defeated enemies with the next wave. Readiness restarts for everyone. */
export function startWave(b: Battle, enemies: Fighter[]) {
  b.fighters = [...b.fighters.filter((f) => f.side === 'player'), ...enemies];
  for (const f of b.fighters) f.cr = 0;
}

/** Between waves: living allies recover a bit of HP. Returns amounts healed by id. */
export function breather(b: Battle): Record<string, number> {
  const healed: Record<string, number> = {};
  for (const f of living(b, 'player')) {
    const amount = Math.min(f.maxHp - f.hp, Math.round(f.maxHp * WAVE_HEAL));
    f.hp += amount;
    healed[f.id] = amount;
  }
  return healed;
}

export function outcome(b: Battle): Outcome {
  const players = living(b, 'player');
  if (!players.length || b.fighters.some((f) => f.isLord && f.dead)) return 'defeat';
  if (!living(b, 'enemy').length) return 'victory';
  return 'ongoing';
}

/** Small seeded RNG (mulberry32) so tests and replays are deterministic. */
export function seededRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
