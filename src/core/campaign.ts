/**
 * Campaign-level bookkeeping for troops and refining (pure functions on CampaignSave).
 */
import { addItems, downgrade, splitByWeight, NO_GEAR, troopCap, upgrade, type Gear, type Loot, type Troops, type Upgrade } from './army';
import type { CampaignSave } from './save';

export const gearOf = (save: CampaignSave, id: string): Gear => ({ ...NO_GEAR, ...save.gear?.[id] });
export const armyOf = (save: CampaignSave): Troops => save.army ?? { inf: 0, cav: 0 };

const livingIds = (save: CampaignSave) => Object.keys(save.roster).filter((id) => save.roster[id].alive);

/** Command caps of the living generals. */
export function partyCaps(save: CampaignSave): Record<string, number> {
  return Object.fromEntries(livingIds(save).map((id) => [id, troopCap(save.roster[id].level)]));
}

/** Soldiers assigned to a general, clamped to the current cap (fallen generals lead none). */
export function assignedTo(save: CampaignSave, id: string): Troops {
  const r = save.roster[id];
  const a = save.assign?.[id];
  if (!r?.alive || !a) return { inf: 0, cav: 0 };
  const cap = troopCap(r.level);
  const inf = Math.min(a.inf, cap);
  return { inf, cav: Math.min(a.cav, cap - inf) };
}

/** Soldiers not assigned to anyone. */
export function unassigned(save: CampaignSave): Troops {
  const army = armyOf(save);
  let inf = army.inf;
  let cav = army.cav;
  for (const id of livingIds(save)) {
    const a = assignedTo(save, id);
    inf -= a.inf;
    cav -= a.cav;
  }
  return { inf: Math.max(0, inf), cav: Math.max(0, cav) };
}

/**
 * Hand soldiers sitting in the camp to generals who still have room. With `merit` (how much each
 * general did in the battle just won) the best fighters get the most; without it, shares follow
 * the free room. Existing assignments are never touched. Returns who got how many.
 */
export function distributeFree(save: CampaignSave, merit?: Record<string, number>): { save: CampaignSave; given: Record<string, Troops> } {
  const room = Object.fromEntries(
    livingIds(save).map((id) => {
      const a = assignedTo(save, id);
      return [id, troopCap(save.roster[id].level) - a.inf - a.cav];
    }),
  );
  const hasMerit = merit && Object.keys(room).some((id) => (merit[id] ?? 0) > 0);
  const given = splitByWeight(unassigned(save), hasMerit ? merit! : room, room);
  const assign: Record<string, Troops> = {};
  for (const id of livingIds(save)) {
    const a = assignedTo(save, id);
    assign[id] = { inf: a.inf + given[id].inf, cav: a.cav + given[id].cav };
  }
  return { save: { ...save, assign }, given };
}

/** Add battle loot: tools go to the camp, new soldiers go to the generals by merit (see distributeFree). */
export function grantLoot(save: CampaignSave, loot: Loot, merit?: Record<string, number>): CampaignSave {
  return grantLootDetail(save, loot, merit).save;
}

export function grantLootDetail(save: CampaignSave, loot: Loot, merit?: Record<string, number>): { save: CampaignSave; given: Record<string, Troops> } {
  const army = armyOf(save);
  return distributeFree(
    {
      ...save,
      army: { inf: army.inf + loot.troops.inf, cav: army.cav + loot.troops.cav },
      items: addItems(save.items ?? {}, loot.items),
    },
    merit,
  );
}

/** Change one general's soldiers by hand (clamped to their cap and to what's in the camp). */
export function setAssign(save: CampaignSave, id: string, want: Troops): CampaignSave {
  const cap = troopCap(save.roster[id]?.level ?? 1);
  const cur = assignedTo(save, id);
  const free = unassigned(save);
  const inf = Math.max(0, Math.min(want.inf, cur.inf + free.inf, cap));
  const cav = Math.max(0, Math.min(want.cav, cur.cav + free.cav, cap - inf));
  return { ...save, assign: { ...save.assign, [id]: { inf, cav } } };
}

/** Apply one refining step to a general's gear; null if it can't be done. */
export function refine(save: CampaignSave, id: string, u: Upgrade): CampaignSave | null {
  const r = upgrade(gearOf(save, id), save.items ?? {}, u);
  if (!r) return null;
  return { ...save, gear: { ...save.gear, [id]: r.gear }, items: r.items };
}

/** Undo one refining step, getting its tools back; null if there's nothing to undo. */
export function unrefine(save: CampaignSave, id: string, u: Upgrade): CampaignSave | null {
  const r = downgrade(gearOf(save, id), save.items ?? {}, u);
  if (!r) return null;
  return { ...save, gear: { ...save.gear, [id]: r.gear }, items: r.items };
}

/**
 * Spend tools the way a casual player might (for the auto-play simulator): keep upgrading
 * whichever general/track is cheapest until nothing is affordable.
 */
export function autoRefine(save: CampaignSave, order: string[]): CampaignSave {
  let s = save;
  for (let guard = 0; guard < 500; guard++) {
    let done = false;
    for (const u of ['grade', 'edge', 'lacquer', 'lacing'] as Upgrade[])
      for (const id of order) {
        const n = refine(s, id, u);
        if (n) {
          s = n;
          done = true;
        }
      }
    if (!done) break;
  }
  return s;
}
