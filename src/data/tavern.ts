import type { CampaignSave } from '../core/save';
import { clearedFlag } from '../core/save';
import { SCENARIO_ORDER, type Line } from './scenarios';

/**
 * 주막: short talks between the sworn brothers, one more after every battle won, and replays of the
 * story so far. Written fresh for this game (the setting follows the public-domain novel).
 */
export interface Talk {
  id: string;
  title: string;
  /** opens once this battle has been won */
  after: string;
  lines: Line[];
}

export const TALKS: Talk[] = [
  {
    id: 'talk1',
    title: '첫 승리의 술',
    after: 'ch1-1',
    lines: [
      { speaker: '', text: '탁현의 작은 주막. 첫 싸움을 이긴 의용군이 술잔을 기울인다.' },
      { speaker: '장비', text: '형님들, 한 잔 받으시오! 오늘 내 장팔사모에 쓰러진 놈이 몇이었더라… 셋? 아니, 다섯!' },
      { speaker: '관우', text: '익덕, 세는 것보다 지키는 것이 장수의 일이네. 오늘 자네 뒤로 빠진 적이 둘이었네.' },
      { speaker: '장비', text: '그, 그건 일부러 둘째 형님께 양보한 거요!' },
      { speaker: '유비', text: '하하. 둘 다 고맙네. 다만 오늘 다친 의병들의 이름도 잊지 말세. 우리가 싸우는 까닭은 그들 같은 백성이니.' },
    ],
  },
  {
    id: 'talk2',
    title: '청주의 등불',
    after: 'ch1-2',
    lines: [
      { speaker: '', text: '포위가 풀린 청주성. 밤늦도록 관우의 막사에 등불이 켜져 있다.' },
      { speaker: '장비', text: '둘째 형님은 또 그 책이오? 춘추인지 뭔지, 글자만 보면 나는 졸음이 쏟아지던데.' },
      { speaker: '관우', text: '옛사람이 의리를 어떻게 지켰는지 적힌 책이네. 칼은 손으로 들지만, 어디로 향할지는 이것이 정해 주지.' },
      { speaker: '장비', text: '흠… 그럼 내 사모는 내 배짱이 정해 주는 걸로 합시다!' },
      { speaker: '유비', text: '운장은 책으로, 익덕은 배짱으로. 그래서 우리 셋이 한데 모인 것이겠지.' },
    ],
  },
  {
    id: 'talk3',
    title: '스승 노식',
    after: 'ch1-3',
    lines: [
      { speaker: '', text: '광종의 관군 진영. 유비는 옛 스승 노식을 만나고 돌아왔다.' },
      { speaker: '유비', text: '젊을 적 노식 선생 밑에서 글을 배웠네. 공부보다 개와 말, 좋은 옷을 더 좋아했던 제자였지만.' },
      { speaker: '장비', text: '형님이? 하하, 거짓말이시겠지!' },
      { speaker: '유비', text: '정말일세. 그런데 선생께서 그러셨지. 사람을 얻는 자가 천하를 얻는다고. 그 말만은 잊지 않았네.' },
      { speaker: '관우', text: '그래서 형님 곁에 사람이 모이는 것이오. 이 관모도 그중 하나요.' },
    ],
  },
  {
    id: 'talk4',
    title: '불길 뒤에',
    after: 'ch1-4',
    lines: [
      { speaker: '', text: '영천의 들판에는 아직 탄내가 남아 있다.' },
      { speaker: '장비', text: '불로 적을 태우다니, 그 조맹덕이란 사람 무섭더군. 웃는 얼굴로 눈은 하나도 안 웃습디다.' },
      { speaker: '관우', text: '재주가 비상한 사람이오. 언젠가 다시 마주칠 것 같소.' },
      { speaker: '유비', text: '재주 있는 자는 많네. 다만 그 재주를 누구를 위해 쓰느냐가 다를 뿐이지.' },
    ],
  },
  {
    id: 'talk5',
    title: '요술이란',
    after: 'ch1-5',
    lines: [
      { speaker: '', text: '곡양 싸움이 끝난 밤. 장비가 슬그머니 술잔을 내려놓는다.' },
      { speaker: '장비', text: '솔직히 말하겠소. 장보 그놈이 검은 바람을 부를 때… 아주 조금, 손톱만큼 겁이 났소.' },
      { speaker: '관우', text: '익덕이 그런 말을 다 하는군. 나도 바람 소리에 수염이 곤두섰네.' },
      { speaker: '유비', text: '두려움을 아는 자가 진짜 용기를 내는 법일세. 요술은 사람의 마음을 흔들 뿐, 우리 셋을 갈라놓지는 못하네.' },
      { speaker: '장비', text: '그렇지! 자, 그럼 겁 먹은 기념으로 한 잔 더!' },
    ],
  },
  {
    id: 'talk6',
    title: '난이 끝난 뒤',
    after: 'ch1-6',
    lines: [
      { speaker: '', text: '장각이 쓰러지고 황건적의 난이 저물었다. 공을 세운 장수들이 하나둘 벼슬을 받았다.' },
      { speaker: '장비', text: '그 많은 싸움을 치르고 받은 게 작은 고을 현위 자리라니! 이게 말이 되오?' },
      { speaker: '관우', text: '조정에 줄을 대지 못한 탓이오. 지금 낙양이 그런 곳이오.' },
      { speaker: '유비', text: '자리가 작으면 작은 고을 백성부터 지키면 되네. 우리 길은 이제 시작일세.' },
      { speaker: '', text: '복숭아 동산의 맹세는 아직 끝나지 않았다. 천하는 더 큰 난세를 향해 가고 있었다.' },
    ],
  },
];

const wonBattle = (save: CampaignSave, id: string) => {
  const now = SCENARIO_ORDER.indexOf(save.scenarioId);
  const i = SCENARIO_ORDER.indexOf(id);
  return i < now || (i === now && !!save.flags[clearedFlag(id)]);
};

export const talkSeenFlag = (id: string) => `seen_${id}`;

/** Talks opened so far, oldest first. */
export const openTalks = (save: CampaignSave) => TALKS.filter((t) => wonBattle(save, t.after));

/** Talks opened but not read yet. */
export const newTalks = (save: CampaignSave) => openTalks(save).filter((t) => !save.flags[talkSeenFlag(t.id)]);

/** Battles whose story can be replayed. */
export const replayable = (save: CampaignSave) => SCENARIO_ORDER.filter((id) => wonBattle(save, id));
