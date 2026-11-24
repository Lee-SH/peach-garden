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
