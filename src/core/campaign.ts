/**
 * Campaign-level bookkeeping for troops and refining (pure functions on CampaignSave).
 */
import { addItems, autoAssign, NO_GEAR, troopCap, upgrade, type Gear, type Loot, type Troops, type Upgrade } from './army';
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

/** Re-split all soldiers by command caps. */
export function reassign(save: CampaignSave): CampaignSave {
  return { ...save, assign: autoAssign(armyOf(save), partyCaps(save)) };
}

/** Add battle loot (and re-split soldiers if the player leaves that to the game). */
export function grantLoot(save: CampaignSave, loot: Loot): CampaignSave {
  const army = armyOf(save);
  let next: CampaignSave = {
    ...save,
    army: { inf: army.inf + loot.troops.inf, cav: army.cav + loot.troops.cav },
    items: addItems(save.items ?? {}, loot.items),
  };
  if (next.autoArmy !== false) next = reassign(next);
  return next;
}

/** Change one general's soldiers by hand (clamped to their cap and to what's free). Turns auto-split off. */
export function setAssign(save: CampaignSave, id: string, want: Troops): CampaignSave {
  const cap = troopCap(save.roster[id]?.level ?? 1);
  const cur = assignedTo(save, id);
  const free = unassigned(save);
  const inf = Math.max(0, Math.min(want.inf, cur.inf + free.inf, cap));
  const cav = Math.max(0, Math.min(want.cav, cur.cav + free.cav, cap - inf));
  return { ...save, autoArmy: false, assign: { ...save.assign, [id]: { inf, cav } } };
}

/** Apply one refining step to a general's gear; null if it can't be done. */
export function refine(save: CampaignSave, id: string, u: Upgrade): CampaignSave | null {
  const r = upgrade(gearOf(save, id), save.items ?? {}, u);
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
