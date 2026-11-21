import type { BattleState, Objective, Pos, Terrain } from '../core/types';
import { ENEMIES, GENERALS, makeUnit } from './units';
import type { CampaignSave } from '../core/save';

export interface Line {
  speaker: string; // '' = narration
  text: string;
}

export interface Scenario {
  id: string;
  chapter: string;
  title: string;
  objectiveText: string;
  intro: Line[];
  outro: Line[];
  /** map rows, top to bottom. . plain  F forest  M mountain  R river  V village */
  map: string[];
  players: { id: string; pos: Pos }[];
  enemies: { id: string; type: keyof typeof ENEMIES; pos: Pos }[];
  reinforcements: { turn: number; id: string; type: keyof typeof ENEMIES; pos: Pos }[];
  objective: Objective;
  next: string | null;
}

const TERRAIN: Record<string, Terrain> = { '.': 'plain', F: 'forest', M: 'mountain', R: 'river', V: 'village' };

export const SCENARIOS: Record<string, Scenario> = {
  'ch1-1': {
    id: 'ch1-1',
    chapter: '1장 황건적의 난',
    title: '탁현 출정',
    objectiveText: '승리: 정원지 격파\n패배: 유비 전사',
    intro: [
      { speaker: '', text: '중평 원년(184년). 태평도의 장각이 "창천이 이미 죽었으니 황천이 일어서리라"를 외치며 난을 일으켰다.' },
      { speaker: '', text: '누런 두건을 두른 무리가 들불처럼 번져 나가고, 유주 탁현에도 의병을 모집하는 방이 붙었다.' },
      { speaker: '유비', text: '나라가 이 지경인데, 돗자리나 짜는 이 몸으로는 아무것도 할 수 없구나…' },
      { speaker: '장비', text: '대장부가 나라를 위해 힘쓰지 않고 어찌 한숨만 쉬시오! 내게 재산이 좀 있으니 함께 의병을 일으킵시다!' },
      { speaker: '관우', text: '두 분의 뜻이 그러하다면, 이 관모도 기꺼이 함께하겠소.' },
      { speaker: '', text: '복숭아꽃이 만개한 장비의 집 뒤뜰. 세 사람은 하늘과 땅에 제를 올렸다.' },
      { speaker: '유비', text: '비록 한날한시에 태어나지는 못했으나, 한날한시에 죽기를 원하노라.' },
      { speaker: '', text: '도원에서 의형제를 맺은 세 사람은 의용군 오백을 이끌고 출정했다. 눈앞에는 황건적 장수 정원지의 무리가 있다.' },
      { speaker: '장비', text: '형님! 저 누런 두건 놈들, 이 장팔사모로 한꺼번에 꿰어 버리겠소!' },
      { speaker: '관우', text: '적이 노리는 곳은 붉게 보이오. 그 자리를 비우거나, 적을 밀쳐내 공격을 빗나가게 하시오.' },
    ],
    outro: [
      { speaker: '', text: '정원지가 쓰러지자, 우두머리를 잃은 황건적은 무기를 버리고 흩어졌다.' },
      { speaker: '장비', text: '하하하! 첫 싸움치고는 시원하구려!' },
      { speaker: '유비', text: '이제 시작일 뿐이다. 청주가 황건적에게 포위되었다는 소식이 들려오는구나.' },
    ],
    map: [
      '..F..F..',
      '.F..M...',
      '...RR.F.',
      'F...R...',
      '..V...F.',
      '.F...M..',
      '....F...',
      '........',
    ],
    players: [
      { id: 'liubei', pos: { x: 3, y: 7 } },
      { id: 'guanyu', pos: { x: 2, y: 7 } },
      { id: 'zhangfei', pos: { x: 4, y: 7 } },
    ],
    enemies: [
      { id: 'boss', type: 'chengyuanzhi', pos: { x: 3, y: 0 } },
      { id: 'r1', type: 'rebel', pos: { x: 2, y: 3 } },
      { id: 'r2', type: 'rebel', pos: { x: 5, y: 3 } },
      { id: 'r3', type: 'rebel', pos: { x: 6, y: 1 } },
      { id: 'a1', type: 'archer', pos: { x: 1, y: 1 } },
    ],
    reinforcements: [
      { turn: 3, id: 'r4', type: 'rebel', pos: { x: 0, y: 0 } },
      { turn: 3, id: 'r5', type: 'rebel', pos: { x: 7, y: 0 } },
    ],
    objective: { type: 'defeatBoss', bossId: 'boss' },
    next: null,
  },
};

/** Build the battle state for a scenario using the campaign's roster progress. */
export function buildBattle(sc: Scenario, save: CampaignSave): BattleState {
  const terrain = sc.map.map((row) => row.split('').map((c) => TERRAIN[c] ?? 'plain'));
  const players = sc.players
    .filter((p) => save.roster[p.id]?.alive !== false)
    .map((p) => makeUnit(p.id, GENERALS[p.id], 'player', p.pos, save.roster[p.id]));
  const enemies = sc.enemies.map((e) => makeUnit(e.id, ENEMIES[e.type], 'enemy', e.pos));
  return {
    width: terrain[0].length,
    height: terrain.length,
    terrain,
    units: [...players, ...enemies],
    intents: [],
    turn: 1,
    objective: sc.objective,
    reinforcements: sc.reinforcements.map((r) => ({
      turn: r.turn,
      unit: makeUnit(r.id, ENEMIES[r.type], 'enemy', r.pos),
    })),
  };
}
