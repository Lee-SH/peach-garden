import type { Gear, ItemId, Troops } from './army';
import { DEFAULT_POSITIONS, type Positions } from './formation';
import type { Fighter } from './types';

export interface RosterEntry {
  level: number;
  xp: number;
  alive: boolean;
}

export interface CampaignSave {
  version: 1;
  /** next scenario to play */
  scenarioId: string;
  roster: Record<string, RosterEntry>;
  /** story branch flags, e.g. pangtong_survived */
  flags: Record<string, boolean>;
  /** general ids by slot: [선봉, 중군, 후군]. Optional for saves made before formations existed. */
  formation?: string[];
  /** 2D formation grid (general id → cell). Takes precedence over `formation`. */
  positions?: Positions;
  /** soldiers owned (battle loot) */
  army?: Troops;
  /** soldiers assigned to each general */
  assign?: Record<string, Troops>;
  /** each general's weapon and armour upgrades */
  gear?: Record<string, Gear>;
  /** refining tools owned */
  items?: Partial<Record<ItemId, number>>;
}

const KEY = 'peach-garden.save.v1';

export function newCampaign(): CampaignSave {
  return {
    version: 1,
    scenarioId: 'ch1-1',
    roster: {
      liubei: { level: 1, xp: 0, alive: true },
      guanyu: { level: 1, xp: 0, alive: true },
      zhangfei: { level: 1, xp: 0, alive: true },
    },
    flags: {},
    positions: { ...DEFAULT_POSITIONS },
  };
}

/** Copy battle results (levels, deaths) into the campaign. Pure — returns a new save. */
/** `party` fighters must already have their battle XP applied (see gainXp). */
export function applyBattleResult(save: CampaignSave, party: Fighter[], nextScenarioId: string | null): CampaignSave {
  const roster = { ...save.roster };
  for (const u of party.filter((u) => u.side === 'player')) {
    roster[u.id] = { level: u.level, xp: u.xp, alive: !u.dead };
  }
  // the last battle of the content stays the current scenario, marked as cleared
  const flags = nextScenarioId ? save.flags : { ...save.flags, [clearedFlag(save.scenarioId)]: true };
  return { ...save, roster, flags, scenarioId: nextScenarioId ?? save.scenarioId };
}

export const clearedFlag = (scenarioId: string) => `cleared_${scenarioId}`;

export function loadSave(storage: Pick<Storage, 'getItem'> | null = safeStorage()): CampaignSave | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CampaignSave;
    return data.version === 1 ? data : null;
  } catch {
    return null;
  }
}

export function writeSave(save: CampaignSave, storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  try {
    storage?.setItem(KEY, JSON.stringify(save));
  } catch {
    // storage unavailable (private mode); progress lasts for this session only
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
