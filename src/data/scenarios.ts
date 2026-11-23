import type { Fighter } from '../core/types';
import type { CampaignSave } from '../core/save';
import { DEFAULT_POSITIONS, fromOrder, normalizePositions, type Positions } from '../core/formation';
import { applyGear, applyTroops, lootFor, type Loot } from '../core/army';
import { assignedTo, gearOf } from '../core/campaign';
import { ENEMIES, GENERALS, makeFighter } from './units';

export interface Line {
  speaker: string; // '' = narration
  text: string;
}

export interface Wave {
  level: number;
  enemies: (keyof typeof ENEMIES)[];
  /** what Liu Bei says before this group (default lines in src/data/briefing.ts) */
  line?: string;
}

export interface Scenario {
  id: string;
  chapter: string;
  title: string;
  objectiveText: string;
  intro: Line[];
  outro: Line[];
  party: string[];
  /** groups of enemies fought one after another, left → right */
  waves: Wave[];
  next: string | null;
}

const CH1 = '1장 황건적의 난';
const PARTY = ['liubei', 'guanyu', 'zhangfei'];
const LOSE = '패배: 유비 전사 또는 전원 전사';

export const SCENARIOS: Record<string, Scenario> = {
  'ch1-1': {
    id: 'ch1-1',
    chapter: CH1,
    title: '탁현 출정',
    objectiveText: `승리: 4개 무리 격파 (등무, 정원지)\n${LOSE}`,
    intro: [
      { speaker: '', text: '중평 원년(184년). 태평도의 장각이 "창천이 이미 죽었으니 황천이 일어서리라"를 외치며 난을 일으켰다.' },
      { speaker: '', text: '누런 두건을 두른 무리가 들불처럼 번져 나가고, 유주 탁현에도 의병을 모집하는 방이 붙었다.' },
      { speaker: '유비', text: '나라가 이 지경인데, 돗자리나 짜는 이 몸으로는 아무것도 할 수 없구나…' },
      { speaker: '장비', text: '대장부가 나라를 위해 힘쓰지 않고 어찌 한숨만 쉬시오! 내게 재산이 좀 있으니 함께 의병을 일으킵시다!' },
      { speaker: '관우', text: '두 분의 뜻이 그러하다면, 이 관모도 기꺼이 함께하겠소.' },
      { speaker: '', text: '복숭아꽃이 만개한 장비의 집 뒤뜰. 세 사람은 하늘과 땅에 제를 올렸다.' },
      { speaker: '유비', text: '비록 한날한시에 태어나지는 못했으나, 한날한시에 죽기를 원하노라.' },
      { speaker: '', text: '의형제가 된 세 사람은 의용군 오백을 이끌고 출정했다. 황건적 장수 정원지와 부장 등무가 오만 대군을 몰고 온다.' },
      { speaker: '관우', text: '선봉에 서는 자가 가장 많이 싸우고 가장 많이 다치오. 누구를 앞세울지 잘 정하시오.' },
    ],
    outro: [
      { speaker: '', text: '등무와 정원지가 차례로 쓰러지자, 우두머리를 잃은 황건적은 무기를 버리고 흩어졌다.' },
      { speaker: '장비', text: '하하하! 첫 싸움치고는 시원하구려!' },
      { speaker: '유비', text: '이제 시작일 뿐이다. 청주성이 황건적에게 포위되었다는 급보가 왔다.' },
    ],
    party: PARTY,
    waves: [
      { level: 1, enemies: ['rebel', 'rebel', 'rebel'] },
      { level: 1, enemies: ['rebel', 'archer', 'rebel'] },
      { level: 1, enemies: ['rebel', 'dengmao', 'archer'] },
      { level: 1, enemies: ['rebel', 'chengyuanzhi', 'rebel'] },
    ],
    next: 'ch1-2',
  },
  'ch1-2': {
    id: 'ch1-2',
    chapter: CH1,
    title: '청주 구원',
    objectiveText: `승리: 4개 무리 격파 (황건두령)\n${LOSE}`,
    intro: [
      { speaker: '', text: '청주 태수 공경은 황건적에게 성을 포위당해 원군을 청했다.' },
      { speaker: '유비', text: '적은 많고 우리는 적다. 정면으로 부딪치기보다 길목에 군사를 숨겨 두자.' },
      { speaker: '관우', text: '그럼 나와 익덕이 좌우 산기슭에 매복하겠소.' },
      { speaker: '장비', text: '형님이 적을 끌어오기만 하시오. 내가 뒤를 끊어 버리겠소!' },
    ],
    outro: [
      { speaker: '', text: '징 소리를 신호로 매복이 일제히 일어나자, 황건적은 크게 무너졌다. 청주성의 포위가 풀렸다.' },
      { speaker: '유비', text: '스승 노식께서 광종에서 장각의 본대와 대치 중이시라 한다. 그곳으로 가자.' },
    ],
    party: PARTY,
    waves: [
      { level: 2, enemies: ['rebel', 'rebel', 'archer', 'sorcerer'] },
      { level: 2, enemies: ['brute', 'rebel', 'archer'] },
      { level: 3, enemies: ['sorcerer', 'rebel', 'brute', 'archer'] },
      { level: 3, enemies: ['brute', 'chieftain', 'archer'] },
    ],
    next: 'ch1-3',
  },
  'ch1-3': {
    id: 'ch1-3',
    chapter: CH1,
    title: '광종 원군',
    objectiveText: `승리: 4개 무리 격파\n${LOSE}`,
    intro: [
      { speaker: '', text: '광종에서는 중랑장 노식이 장각의 본대 십오만과 맞서고 있었다.' },
      { speaker: '유비', text: '스승님, 탁현의 유비가 의병을 이끌고 왔습니다.' },
      { speaker: '', text: '노식은 기뻐하며 세 사람에게 적진의 측면을 흔들어 달라고 부탁했다.' },
      { speaker: '장비', text: '측면이든 정면이든, 누런 두건만 보이면 다 쓸어버리면 되는 거 아니오?' },
    ],
    outro: [
      { speaker: '', text: '세 형제가 측면을 무너뜨리자 장각의 본대는 광종성 안으로 물러났다.' },
      { speaker: '', text: '노식은 영천에서 황보숭, 주준이 장량·장보 형제와 싸우고 있으니 도우라며 군사 천 명을 내주었다.' },
    ],
    party: PARTY,
    waves: [
      { level: 4, enemies: ['rebel', 'brute', 'archer', 'sorcerer'] },
      { level: 4, enemies: ['brute', 'sorcerer', 'brute'] },
      { level: 5, enemies: ['archer', 'rebel', 'brute', 'sorcerer'] },
      { level: 5, enemies: ['brute', 'brute', 'sorcerer', 'archer'] },
    ],
    next: 'ch1-4',
  },
  'ch1-4': {
    id: 'ch1-4',
    chapter: CH1,
    title: '영천의 불길',
    objectiveText: `승리: 4개 무리 격파 (장량)\n${LOSE}`,
    intro: [
      { speaker: '', text: '영천의 황건적은 풀숲에 진을 쳤다. 관군 장수 황보숭은 바람이 부는 밤을 기다려 불을 놓았다.' },
      { speaker: '관우', text: '불길에 쫓겨 나오는 적을 우리가 받아치면 되겠소.' },
      { speaker: '', text: '들판이 불바다가 되자, 장각의 아우 인공장군 장량이 남은 무리를 이끌고 혈로를 뚫으려 한다.' },
    ],
    outro: [
      { speaker: '', text: '장량의 무리는 불길과 세 형제 사이에 갇혀 무너졌다.' },
      { speaker: '', text: '퇴로를 막던 붉은 깃발의 한 장수가 말을 몰고 지나갔다. 기도위 조조, 자는 맹덕이라 했다.' },
      { speaker: '유비', text: '…범상치 않은 인물이로구나.' },
      { speaker: '', text: '남은 황건적은 지공장군 장보를 따라 곡양으로 달아났다.' },
    ],
    party: PARTY,
    waves: [
      { level: 6, enemies: ['rebel', 'sorcerer', 'rebel', 'archer'] },
      { level: 6, enemies: ['brute', 'archer', 'brute', 'sorcerer'] },
      { level: 7, enemies: ['sorcerer', 'brute', 'archer', 'rebel'] },
      { level: 7, enemies: ['brute', 'zhangliang', 'sorcerer'] },
    ],
    next: 'ch1-5',
  },
  'ch1-5': {
    id: 'ch1-5',
    chapter: CH1,
    title: '곡양의 요술',
    objectiveText: `승리: 4개 무리 격파 (고승, 장보)\n${LOSE}`,
    intro: [
      { speaker: '', text: '곡양에 진을 친 장보는 요술로 검은 바람과 귀신 군사를 불러냈다.' },
      { speaker: '장비', text: '형님, 하늘에서 모래가 쏟아지고 귀신이 울부짖소! 이게 무슨 조화요?' },
      { speaker: '유비', text: '요사한 술수일 뿐이다. 마음을 굳게 먹으면 홀리지 않는다.' },
      { speaker: '', text: '먼저 장보의 부장 고승이 진 앞으로 나섰다.' },
    ],
    outro: [
      { speaker: '', text: '부장 고승을 잃고 요술마저 깨지자, 장보는 남은 무리를 버리고 달아났다.' },
      { speaker: '', text: '그때 급보가 날아들었다. 광종의 장각이 성을 나와, 관군 장수 동탁의 군대를 짓밟고 있다는 것이다.' },
      { speaker: '관우', text: '천공장군 장각이 직접 나섰다면, 이번이 난을 끝낼 기회요.' },
    ],
    party: PARTY,
    waves: [
      { level: 8, enemies: ['sorcerer', 'brute', 'sorcerer', 'archer'] },
      { level: 8, enemies: ['brute', 'gaosheng', 'archer'] },
      { level: 9, enemies: ['sorcerer', 'archer', 'brute', 'rebel'] },
      { level: 9, enemies: ['sorcerer', 'zhangbao', 'brute'] },
    ],
    next: 'ch1-6',
  },
  'ch1-6': {
    id: 'ch1-6',
    chapter: CH1,
    title: '천공장군 장각',
    objectiveText: `승리: 4개 무리 격파 (장각)\n${LOSE}`,
    intro: [
      { speaker: '', text: '광종 들판. 동탁의 관군은 장각의 대군에 밀려 무너지고 있었다.' },
      { speaker: '장각', text: '창천은 이미 죽었다! 누런 하늘이 일어선다! 저 관군 놈들을 하나도 살려 보내지 마라!' },
      { speaker: '유비', text: '아우들아, 저것이 장각이다. 이 싸움으로 난을 끝내자!' },
      { speaker: '장비', text: '기다렸소! 교주 놈의 목은 내 것이오!' },
    ],
    outro: [
      { speaker: '', text: '세 형제의 돌격에 장각의 본진이 무너졌다. 천공장군의 깃발이 쓰러지자 황건적은 사방으로 흩어졌다.' },
      { speaker: '', text: '목숨을 건진 동탁은 세 사람이 관직 없는 백신이라는 말을 듣자, 고맙다는 말 한마디 없이 돌아섰다.' },
      { speaker: '장비', text: '목숨을 구해 줬더니 저 무례한 놈이! 형님, 당장 베어 버리겠소!' },
      { speaker: '유비', text: '참아라. 그는 조정의 관리다. 우리의 길은 아직 멀다.' },
      { speaker: '', text: '— 1장 황건적의 난, 끝 —' },
    ],
    party: PARTY,
    waves: [
      { level: 9, enemies: ['rebel', 'brute', 'archer', 'sorcerer'] },
      { level: 10, enemies: ['brute', 'sorcerer', 'brute', 'archer'] },
      { level: 10, enemies: ['sorcerer', 'brute', 'archer', 'brute'] },
      { level: 10, enemies: ['sorcerer', 'zhangjue', 'brute'] },
    ],
    next: null,
  },
};

export const SCENARIO_ORDER = Object.keys(SCENARIOS);

/** Living generals of a scenario. */
export function aliveParty(sc: Scenario, save: CampaignSave): string[] {
  return sc.party.filter((id) => save.roster[id]?.alive !== false);
}

/** The campaign's formation grid for this scenario's living generals (legacy ordered saves converted). */
export function partyPositions(sc: Scenario, save: CampaignSave): Positions {
  const saved = save.positions ?? (save.formation ? fromOrder(save.formation) : DEFAULT_POSITIONS);
  return normalizePositions(saved, aliveParty(sc, save));
}

/** Living party members, front column first, with campaign progress and grid cell applied (slot = column). */
export function buildParty(sc: Scenario, save: CampaignSave): Fighter[] {
  const pos = partyPositions(sc, save);
  return aliveParty(sc, save)
    .sort((a, b) => pos[a].col - pos[b].col || pos[a].row - pos[b].row)
    .map((id) => {
      const f = makeFighter(id, GENERALS[id], 'player', save.roster[id], pos[id].col, pos[id].row);
      applyGear(f, gearOf(save, id));
      applyTroops(f, assignedTo(save, id));
      return f;
    });
}

/** Battle number within the chapter (1-based). */
export const stageOf = (sc: Scenario) => SCENARIO_ORDER.indexOf(sc.id) + 1;

/** What winning this battle gives: soldiers, tools, 백련강 per officer, the manual at chapter end. */
export function scenarioLoot(sc: Scenario): Loot {
  const officers = sc.waves.flatMap((w) => w.enemies).filter((e) => ENEMIES[e].isBoss).length;
  return lootFor(stageOf(sc), officers, sc.next === null);
}

export function buildWave(sc: Scenario, index: number): Fighter[] {
  const w = sc.waves[index];
  return w.enemies.map((type, i) => makeFighter(`w${index}-${i}-${type}`, ENEMIES[type], 'enemy', { level: w.level, xp: 0 }, i));
}
