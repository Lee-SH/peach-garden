import { clearedFlag, type CampaignSave } from '../core/save';
import { SCENARIO_ORDER, SCENARIOS } from './scenarios';

/**
 * The 진영 (home base) between battles: where Liu Bei's army is camped, and the spots on the town
 * map. The camp moves with the campaign — it is wherever the last battle was fought (탁현 at first).
 */

/** Where each battle of chapter 1 takes place. */
export const BATTLE_PLACE: Record<string, string> = {
  'ch1-1': '탁현',
  'ch1-2': '청주',
  'ch1-3': '광종',
  'ch1-4': '영천',
  'ch1-5': '곡양',
  'ch1-6': '광종',
};

/** One line from Liu Bei on the town screen, by camp. */
const MOOD: Record<string, string> = {
  탁현: '의병을 모으자. 병사와 무기를 갖추고 길을 떠난다.',
  청주: '청주 백성들이 무사하다. 숨을 돌리고 채비를 하자.',
  광종: '노식 장군의 진영이다. 이곳에서 군세를 가다듬자.',
  영천: '불길이 잦아들었다. 다친 병사들을 돌보고 떠나자.',
  곡양: '요술은 꺾였다. 이제 남은 것은 장각뿐이다.',
};

export interface TownState {
  place: string;
  mood: string;
  /** the battle the gate leads to, or null when the chapter is finished */
  next: { id: string; label: string } | null;
}

export function townOf(save: CampaignSave): TownState {
  const done = !!save.flags[clearedFlag(save.scenarioId)];
  const i = SCENARIO_ORDER.indexOf(save.scenarioId);
  const prev = done ? save.scenarioId : SCENARIO_ORDER[i - 1];
  const place = prev ? BATTLE_PLACE[prev] ?? '탁현' : '탁현';
  const sc = SCENARIOS[save.scenarioId];
  return {
    place,
    mood: done ? '황건적의 난이 끝났다. 하지만 천하는 아직 어지럽다…' : MOOD[place] ?? MOOD['탁현'],
    next: done || !sc ? null : { id: sc.id, label: `${i + 1}화 「${sc.title}」` },
  };
}

/**
 * Spots on the town map (world coordinates, 360×640). A town picture made later should put its
 * buildings at these places: 군막 upper-left, 창고 right-middle, the road out of town lower-right.
 */
export const SPOTS = {
  camp: { x: 100, y: 236, label: '군영', sub: '장수 · 병력 · 장비' },
  store: { x: 262, y: 340, label: '창고', sub: '재련 도구 · 남은 병력' },
  gate: { x: 270, y: 500, label: '출진', sub: '' },
} as const;
