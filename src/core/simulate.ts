import { battleXp, beginTurn, breather, chooseAction, endTurn, gainXp, nextActor, outcome, seededRng, startWave, useSkill } from './combat';
import { applyBattleResult, newCampaign, type CampaignSave } from './save';
import { buildParty, buildWave, scenarioLoot, SCENARIOS, SCENARIO_ORDER, type Scenario } from '../data/scenarios';
import { autoRefine, grantLoot } from './campaign';
import type { Battle } from './types';
import { fromOrder, type Positions } from './formation';

export interface BattleRun {
  victory: boolean;
  deaths: string[];
  turns: number;
  party: Battle['fighters'];
}

/** Fully automatic battle (both sides use the AI), as in auto mode. */
export function autoBattle(sc: Scenario, save: CampaignSave, seed: number): BattleRun {
  const b: Battle = { fighters: buildParty(sc, save), rng: seededRng(seed) };
  let wave = 0;
  startWave(b, buildWave(sc, wave));
  let turns = 0;
  for (; turns < 2000; turns++) {
    const o = outcome(b);
    if (o === 'defeat') break;
    if (o === 'victory') {
      if (++wave >= sc.waves.length) break;
      breather(b);
      startWave(b, buildWave(sc, wave));
      continue;
    }
    const actor = nextActor(b);
    if (!beginTurn(b, actor).skip) {
      const c = chooseAction(b, actor);
      useSkill(b, actor, c.skill, c.targetId);
    }
    endTurn(actor);
  }
  const party = b.fighters.filter((f) => f.side === 'player');
  return {
    victory: outcome(b) === 'victory' && wave >= sc.waves.length,
    deaths: party.filter((f) => f.dead).map((f) => f.id),
    turns,
    party,
  };
}

export interface CampaignRun {
  /** per scenario: attempts needed, generals lost, levels after the battle */
  log: { id: string; attempts: number; deaths: string[]; levels: Record<string, number> }[];
  finished: boolean;
}

/** Play the whole campaign on auto with a fixed formation, retrying lost battles. */
export function autoCampaign(formation: string[] | Positions, seed: number, maxAttempts = 5, rewards = true): CampaignRun {
  const positions = Array.isArray(formation) ? fromOrder(formation) : formation;
  let save: CampaignSave = { ...newCampaign(), positions };
  const log: CampaignRun['log'] = [];
  let s = seed;
  for (const id of SCENARIO_ORDER) {
    const sc = SCENARIOS[id];
    let attempts = 0;
    let run: BattleRun | null = null;
    while (attempts < maxAttempts) {
      attempts++;
      run = autoBattle(sc, save, s++ * 7919);
      if (run.victory) break;
    }
    if (!run || !run.victory) {
      log.push({ id, attempts, deaths: [], levels: {} });
      return { log, finished: false };
    }
    const merit: Record<string, number> = {};
    for (const f of run.party) if (!f.dead) gainXp(f, (merit[f.id] = battleXp(f)));
    save = applyBattleResult(save, run.party, sc.next);
    if (rewards) {
      // new soldiers go by merit and every affordable upgrade is bought (a casual player)
      save = grantLoot(save, scenarioLoot(sc), merit);
      save = autoRefine(save, run.party.map((f) => f.id));
    }
    log.push({
      id,
      attempts,
      deaths: run.deaths,
      levels: Object.fromEntries(run.party.map((f) => [f.id, f.level])),
    });
  }
  return { log, finished: true };
}

/**
 * Win the save's current battle on auto (for the developer menu): plays it like autoCampaign does,
 * applies levels and loot and moves on to the next battle. Fallen generals are brought back so a
 * test run always has the whole party. If the battle can't be won in a few tries, it is skipped
 * with the loot granted anyway.
 */
export function devWinCurrent(save: CampaignSave, seed = 1): CampaignSave {
  const sc = SCENARIOS[save.scenarioId];
  if (!sc) return save;
  let next = save;
  let run: BattleRun | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    run = autoBattle(sc, save, (seed + attempt) * 7919);
    if (run.victory) break;
  }
  if (run?.victory) {
    const merit: Record<string, number> = {};
    for (const f of run.party) if (!f.dead) gainXp(f, (merit[f.id] = battleXp(f)));
    next = applyBattleResult(save, run.party, sc.next);
    next = grantLoot(next, scenarioLoot(sc), merit);
  } else {
    next = grantLoot(applyBattleResult(save, [], sc.next), scenarioLoot(sc));
  }
  next = autoRefine(next, Object.keys(next.roster));
  const roster = Object.fromEntries(Object.entries(next.roster).map(([id, r]) => [id, { ...r, alive: true }]));
  return { ...next, roster };
}

/** A save standing just before battle `targetId`, reached by winning every earlier battle on auto. */
export function devSaveAt(targetId: string, seed = 1): CampaignSave {
  let save = newCampaign();
  for (let i = 0; i < SCENARIO_ORDER.length && save.scenarioId !== targetId; i++) {
    const before = save.scenarioId;
    save = devWinCurrent(save, seed + i);
    if (save.scenarioId === before) break; // last battle reached
  }
  return save;
}
