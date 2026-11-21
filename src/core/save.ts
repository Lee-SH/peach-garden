import type { BattleState } from './types';

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
  };
}

/** Copy battle results (levels, deaths) into the campaign. Pure — returns a new save. */
export function applyBattleResult(save: CampaignSave, battle: BattleState, nextScenarioId: string | null): CampaignSave {
  const roster = { ...save.roster };
  for (const u of battle.units.filter((u) => u.side === 'player')) {
    roster[u.id] = { level: u.level, xp: u.xp, alive: !u.dead };
  }
  return { ...save, roster, scenarioId: nextScenarioId ?? save.scenarioId };
}

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
