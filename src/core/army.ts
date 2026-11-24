/**
 * Troops (병력) and equipment refining (재련) — campaign-side rules, no Phaser.
 *
 * Troops: infantry/cavalry won as battle loot are assigned to generals (up to their command cap)
 * and raise their stats. Within one battle, troops lost to damage stay lost across groups; the next
 * battle starts at full strength again (the campaign keeps the assigned numbers, not the losses).
 *
 * Refining: old-style smithing tools upgrade each general's weapon and armour.
 */
import type { Fighter } from './types';

// ---------------------------------------------------------------------------
// Troops
// ---------------------------------------------------------------------------

export interface Troops {
  inf: number;
  cav: number;
}

/** Bonuses per 100 soldiers. */
export const INF_HP = 0.05; // max HP +5%
export const INF_DEF = 0.04; // defence +4%
export const CAV_ATK = 0.05; // attack +5%
export const CAV_SPD = 2; // speed +2
/** Share of a hit (as a fraction of max HP) that also costs soldiers. */
export const TROOP_LOSS = 0.6;

/** How many soldiers a general can lead (infantry + cavalry). */
export const troopCap = (level: number) => 60 + level * 30;

/** Attach troops to a fighter at battle start: HP and speed now, attack/defence live (see combat). */
export function applyTroops(f: Fighter, t: Troops) {
  f.maxHp = Math.round(f.maxHp * (1 + (INF_HP * t.inf) / 100));
  f.hp = f.maxHp;
  f.spd = f.spd + Math.round((CAV_SPD * t.cav) / 100);
  f.troops = { inf: t.inf, cav: t.cav, inf0: t.inf, cav0: t.cav };
}

export const troopAtkMult = (f: Fighter) => 1 + (CAV_ATK * (f.troops?.cav ?? 0)) / 100;
export const troopDefMult = (f: Fighter) => 1 + (INF_DEF * (f.troops?.inf ?? 0)) / 100;

/** Soldiers lost when the general takes `damage` (all of them when the general falls). Returns the count lost. */
export function loseTroops(f: Fighter, damage: number): number {
  const t = f.troops;
  if (!t) return 0;
  const before = t.inf + t.cav;
  if (f.dead) {
    t.inf = 0;
    t.cav = 0;
  } else {
    const frac = Math.min(1, (damage / f.maxHp) * TROOP_LOSS);
    t.inf = Math.max(0, t.inf - Math.round(t.inf0 * frac));
    t.cav = Math.max(0, t.cav - Math.round(t.cav0 * frac));
  }
  return before - (t.inf + t.cav);
}

/**
 * Hand out soldiers in proportion to `weight` (battle merit), 10 at a time, never above anyone's
 * `room`. Uses the D'Hondt rule so shares stay proportional; whoever is full is skipped and what
 * nobody can take is left over. Infantry first, then cavalry from the room that's left.
 */
export function splitByWeight(pool: Troops, weight: Record<string, number>, room: Record<string, number>): Record<string, Troops> {
  const ids = Object.keys(room);
  const out: Record<string, Troops> = Object.fromEntries(ids.map((id) => [id, { inf: 0, cav: 0 }]));
  const left = { ...room };
  for (const kind of ['inf', 'cav'] as const) {
    let rest = pool[kind];
    while (rest > 0) {
      const chunk = Math.min(10, rest);
      let best: string | null = null;
      let score = -1;
      for (const id of ids) {
        if (left[id] < chunk) continue;
        const s = (weight[id] ?? 0) / (out[id][kind] / 10 + 1);
        if (s > score) {
          score = s;
          best = id;
        }
      }
      if (!best) break;
      out[best][kind] += chunk;
      left[best] -= chunk;
      rest -= chunk;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Refining
// ---------------------------------------------------------------------------

export type ItemId = 'whetstone' | 'lacquer' | 'rawhide' | 'steel' | 'manual';

export interface Gear {
  /** weapon sharpening +0~+10 (숫돌) */
  edge: number;
  /** weapon grade 0 범철 · 1 정련 · 2 백련 · 3 명기 (백련강, then 간장·막야의 비전) */
  grade: number;
  /** armour lacquer +0~+10 (옻) */
  lacquer: number;
  /** armour lacing +0~+10 (소가죽 끈) */
  lacing: number;
}

export const NO_GEAR: Gear = { edge: 0, grade: 0, lacquer: 0, lacing: 0 };
export const MAX_LEVEL = 10;
export const GRADE_NAMES = ['범철', '정련', '백련', '명기'];
/** weapon sharpening needed before each grade-up */
export const GRADE_NEEDS_EDGE = [4, 8, 10];

/** Stat multipliers from equipment. */
export const gearAtkMult = (g: Gear) => 1 + 0.03 * g.edge + 0.08 * g.grade;
export const gearDefMult = (g: Gear) => 1 + 0.04 * g.lacquer;
export const gearHpMult = (g: Gear) => 1 + 0.03 * g.lacing;

export function applyGear(f: Fighter, g: Gear) {
  f.atk = Math.round(f.atk * gearAtkMult(g));
  f.def = Math.round(f.def * gearDefMult(g));
  f.maxHp = Math.round(f.maxHp * gearHpMult(g));
  f.hp = f.maxHp;
}

export type Upgrade = 'edge' | 'grade' | 'lacquer' | 'lacing';

/** What the next step of an upgrade costs, or why it can't be done. */
export function upgradeCost(g: Gear, u: Upgrade): { item: ItemId; count: number } | { blocked: string } {
  switch (u) {
    case 'edge':
      return g.edge >= MAX_LEVEL ? { blocked: '최대' } : { item: 'whetstone', count: g.edge + 1 };
    case 'lacquer':
      return g.lacquer >= MAX_LEVEL ? { blocked: '최대' } : { item: 'lacquer', count: g.lacquer + 1 };
    case 'lacing':
      return g.lacing >= MAX_LEVEL ? { blocked: '최대' } : { item: 'rawhide', count: g.lacing + 1 };
    case 'grade':
      if (g.grade >= GRADE_NAMES.length - 1) return { blocked: '최대' };
      if (g.edge < GRADE_NEEDS_EDGE[g.grade]) return { blocked: `날 +${GRADE_NEEDS_EDGE[g.grade]} 필요` };
      return g.grade === GRADE_NAMES.length - 2 ? { item: 'manual', count: 1 } : { item: 'steel', count: g.grade + 1 };
  }
}

/** Try an upgrade. Pure: returns the new gear and items, or null when not possible. */
export function upgrade(g: Gear, items: Partial<Record<ItemId, number>>, u: Upgrade): { gear: Gear; items: Partial<Record<ItemId, number>> } | null {
  const cost = upgradeCost(g, u);
  if ('blocked' in cost) return null;
  if ((items[cost.item] ?? 0) < cost.count) return null;
  return { gear: { ...g, [u]: g[u] + 1 }, items: { ...items, [cost.item]: (items[cost.item] ?? 0) - cost.count } };
}

/** What undoing the last step of an upgrade gives back (the full cost of that step), or why it can't. */
export function undoRefund(g: Gear, u: Upgrade): { item: ItemId; count: number } | { blocked: string } {
  switch (u) {
    case 'edge':
      if (g.edge <= 0) return { blocked: '없음' };
      if (g.grade > 0 && g.edge - 1 < GRADE_NEEDS_EDGE[g.grade - 1]) return { blocked: `${GRADE_NAMES[g.grade]} 등급 유지` };
      return { item: 'whetstone', count: g.edge };
    case 'lacquer':
      return g.lacquer <= 0 ? { blocked: '없음' } : { item: 'lacquer', count: g.lacquer };
    case 'lacing':
      return g.lacing <= 0 ? { blocked: '없음' } : { item: 'rawhide', count: g.lacing };
    case 'grade':
      if (g.grade <= 0) return { blocked: '없음' };
      return g.grade === GRADE_NAMES.length - 1 ? { item: 'manual', count: 1 } : { item: 'steel', count: g.grade };
  }
}

/** Undo the last step of an upgrade, refunding its tools in full. Pure; null when there's nothing to undo. */
export function downgrade(g: Gear, items: Partial<Record<ItemId, number>>, u: Upgrade): { gear: Gear; items: Partial<Record<ItemId, number>> } | null {
  const r = undoRefund(g, u);
  if ('blocked' in r) return null;
  return { gear: { ...g, [u]: g[u] - 1 }, items: { ...items, [r.item]: (items[r.item] ?? 0) + r.count } };
}

// ---------------------------------------------------------------------------
// Loot
// ---------------------------------------------------------------------------

export interface Loot {
  troops: Troops;
  items: Partial<Record<ItemId, number>>;
}

/** Soldiers won per battle of chapter 1 (horses are scarce early). */
const TROOP_LOOT: Troops[] = [
  { inf: 100, cav: 50 }, // 탁현: merchants Zhang Shiping and Su Shuang donate horses (and iron)
  { inf: 150, cav: 0 },
  { inf: 200, cav: 30 },
  { inf: 260, cav: 60 },
  { inf: 320, cav: 90 },
  { inf: 400, cav: 130 },
];

/**
 * Loot for winning battle number `stage` (1-based): more every battle; 백련강 per officer defeated;
 * 간장·막야의 비전 for finishing the chapter.
 */
export function lootFor(stage: number, officers: number, chapterEnd: boolean): Loot {
  const troops = TROOP_LOOT[Math.min(stage, TROOP_LOOT.length) - 1] ?? { inf: 0, cav: 0 };
  const items: Partial<Record<ItemId, number>> = { whetstone: 2 + stage, lacquer: 1 + stage, rawhide: 1 + stage };
  if (officers) items.steel = officers;
  if (chapterEnd) items.manual = 1;
  return { troops: { ...troops }, items };
}

export function addItems(a: Partial<Record<ItemId, number>>, b: Partial<Record<ItemId, number>>) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b) as [ItemId, number][]) out[k] = (out[k] ?? 0) + v;
  return out;
}
