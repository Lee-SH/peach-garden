import type { Fighter, Side, Skill } from '../core/types';

export interface FighterTemplate {
  name: string;
  token: string; // single Hangul letter drawn on the token
  hp: number;
  atk: number;
  def: number;
  spd: number;
  /** flat stat gain per level above 1 (generals). Enemies without it scale by percentage. */
  growth?: { hp: number; atk: number; def: number };
  skills: Skill[];
  isLord?: boolean;
  isBoss?: boolean;
  title: string; // short role description
}

const basic = (id: string, name: string, desc = '적 하나를 공격한다.', power = 1.0): Skill => ({
  id, name, desc, target: 'enemy', power, cooldown: 0,
});

/**
 * Playable generals. Level/xp/alive state lives in the campaign save.
 * Profiles (requested): 유비 = lowest attack, sturdy defense / 관우 = strong attack and defense /
 * 장비 = highest attack, lowest defense.
 */
export const GENERALS: Record<string, FighterTemplate> = {
  liubei: {
    name: '유비', token: '유', title: '군주 · 방어/지원 (쓰러지면 패배)',
    hp: 640, atk: 78, def: 92, spd: 100, isLord: true,
    growth: { hp: 52, atk: 6, def: 8 },
    skills: [
      basic('liubei1', '쌍고검', '적 하나를 두 자루 검으로 벤다.'),
      { id: 'liubei2', name: '인덕', desc: '아군 전체의 체력을 최대 체력의 20%만큼 회복한다.', target: 'allAllies', power: 0, heal: 0.2, cooldown: 3 },
      {
        id: 'liubei3', name: '도원의 맹세', desc: '아군 전체 공격력 증가(2턴), 다른 아군의 행동 게이지 +30%.',
        target: 'allAllies', power: 0, cooldown: 0, ultimate: true,
        effects: [{ type: 'atkUp', turns: 2, on: 'targets' }], allyCrPush: 30,
      },
    ],
  },
  guanyu: {
    name: '관우', token: '관', title: '맹장 · 공격/방어 균형',
    hp: 620, atk: 112, def: 78, spd: 103,
    growth: { hp: 48, atk: 9, def: 7 },
    skills: [
      basic('guanyu1', '청룡언월도', '적 하나를 크게 벤다.'),
      {
        id: 'guanyu2', name: '일도양단', desc: '적 하나에게 큰 피해를 주고 방어력을 낮춘다(2턴).',
        target: 'enemy', power: 1.6, cooldown: 3, effects: [{ type: 'defDown', turns: 2, on: 'targets' }],
      },
      { id: 'guanyu3', name: '청룡참', desc: '청룡의 기세로 적 전체를 벤다.', target: 'allEnemies', power: 1.3, cooldown: 0, ultimate: true },
    ],
  },
  zhangfei: {
    name: '장비', token: '장', title: '맹장 · 공격 특화 (방어 약함)',
    hp: 560, atk: 128, def: 38, spd: 97,
    growth: { hp: 56, atk: 11, def: 3 },
    skills: [
      basic('zhangfei1', '장팔사모', '적 하나를 꿰뚫는다.'),
      {
        id: 'zhangfei2', name: '대갈일성', desc: '우레 같은 호통으로 적 전체에 피해를 주고 기절시킨다(1턴).',
        target: 'allEnemies', power: 0.45, cooldown: 4, effects: [{ type: 'stun', turns: 1, on: 'targets' }],
      },
      { id: 'zhangfei3', name: '맹호돌격', desc: '적 하나에게 엄청난 피해를 준다.', target: 'enemy', power: 2.7, cooldown: 0, ultimate: true },
    ],
  },
};

export const ENEMIES: Record<string, FighterTemplate> = {
  rebel: {
    name: '황건병', token: '황', title: '황건적 보병', hp: 300, atk: 82, def: 30, spd: 90,
    skills: [basic('rebel1', '찌르기')],
  },
  archer: {
    name: '황건궁병', token: '궁', title: '황건적 궁병', hp: 230, atk: 90, def: 20, spd: 102,
    skills: [basic('archer1', '사격'), { id: 'archer2', name: '일제사격', desc: '', target: 'allEnemies', power: 0.4, cooldown: 3 }],
  },
  sorcerer: {
    name: '황건도사', token: '도', title: '태평도 술사', hp: 250, atk: 86, def: 25, spd: 96,
    skills: [
      basic('sorc1', '부적', '', 0.9),
      { id: 'sorc2', name: '귀화', desc: '', target: 'enemy', power: 0.7, cooldown: 3, effects: [{ type: 'burn', turns: 2, on: 'targets' }] },
    ],
  },
  brute: {
    name: '황건역사', token: '역', title: '황건적 장사', hp: 520, atk: 96, def: 48, spd: 84,
    skills: [basic('brute1', '철퇴', '', 1.1), { id: 'brute2', name: '내려찍기', desc: '', target: 'enemy', power: 1.7, cooldown: 3 }],
  },
  // ---- named officers -------------------------------------------------------
  dengmao: {
    name: '등무', token: '등', title: '정원지의 부장', hp: 900, atk: 100, def: 45, spd: 96, isBoss: true,
    skills: [basic('dm1', '창술', '', 1.1), { id: 'dm2', name: '돌격', desc: '', target: 'enemy', power: 1.7, cooldown: 3 }],
  },
  chengyuanzhi: {
    name: '정원지', token: '정', title: '황건적 장수', hp: 1500, atk: 112, def: 55, spd: 98, isBoss: true,
    skills: [
      basic('cyz1', '대도', '', 1.1),
      { id: 'cyz2', name: '황천의 함성', desc: '', target: 'allEnemies', power: 0.55, cooldown: 3, effects: [{ type: 'atkUp', turns: 2, on: 'self' }] },
    ],
  },
  chieftain: {
    name: '황건두령', token: '두', title: '청주를 포위한 두령', hp: 1500, atk: 110, def: 60, spd: 95, isBoss: true,
    skills: [
      basic('chf1', '도끼', '', 1.1),
      { id: 'chf2', name: '포위 공격', desc: '', target: 'allEnemies', power: 0.5, cooldown: 3 },
    ],
  },
  gaosheng: {
    name: '고승', token: '고', title: '장보의 부장', hp: 1500, atk: 116, def: 62, spd: 100, isBoss: true,
    skills: [
      basic('gs1', '언월도', '', 1.15),
      { id: 'gs2', name: '맹공', desc: '', target: 'enemy', power: 1.8, cooldown: 3, effects: [{ type: 'defDown', turns: 2, on: 'targets' }] },
    ],
  },
  zhangliang: {
    name: '장량', token: '량', title: '인공장군 · 장각의 아우', hp: 1700, atk: 112, def: 62, spd: 101, isBoss: true,
    skills: [
      basic('zl1', '부월', '', 1.1),
      { id: 'zl2', name: '인공의 호령', desc: '', target: 'allEnemies', power: 0.45, cooldown: 3, effects: [{ type: 'defDown', turns: 2, on: 'targets' }] },
    ],
  },
  zhangbao: {
    name: '장보', token: '보', title: '지공장군 · 요술을 부린다', hp: 1700, atk: 110, def: 55, spd: 103, isBoss: true,
    skills: [
      basic('zb1', '요술', '', 1.0),
      { id: 'zb2', name: '흑풍', desc: '', target: 'allEnemies', power: 0.35, cooldown: 3, effects: [{ type: 'burn', turns: 2, on: 'targets' }] },
      { id: 'zb3', name: '혼백 묶기', desc: '', target: 'enemy', power: 0.8, cooldown: 4, effects: [{ type: 'stun', turns: 1, on: 'targets' }] },
    ],
  },
  zhangjue: {
    name: '장각', token: '각', title: '천공장군 · 태평도 교주', hp: 1900, atk: 104, def: 60, spd: 104, isBoss: true,
    skills: [
      basic('zj1', '천공의 부적', '', 1.1),
      { id: 'zj2', name: '황천뇌화', desc: '', target: 'allEnemies', power: 0.4, cooldown: 3, effects: [{ type: 'burn', turns: 2, on: 'targets' }] },
      { id: 'zj3', name: '천벌', desc: '', target: 'enemy', power: 1.7, cooldown: 4, effects: [{ type: 'stun', turns: 1, on: 'targets' }] },
    ],
  },
};

/** Enemy stat scaling per level above 1 (percentage of base). */
const ENEMY_SCALE = { hp: 0.09, atk: 0.065, def: 0.05 };
/** Global enemy attack multiplier — the main difficulty knob (tuned with tests/balance.test.ts). */
export const ENEMY_POWER = 1.2;

export function makeFighter(
  id: string,
  t: FighterTemplate,
  side: Side,
  progress: { level: number; xp: number } = { level: 1, xp: 0 },
  slot = 0,
  row = 0,
): Fighter {
  const lv = progress.level - 1;
  let maxHp: number, atk: number, def: number;
  if (t.growth) {
    maxHp = t.hp + t.growth.hp * lv;
    atk = t.atk + t.growth.atk * lv;
    def = t.def + t.growth.def * lv;
  } else {
    maxHp = Math.round(t.hp * (1 + ENEMY_SCALE.hp * lv));
    atk = Math.round(t.atk * ENEMY_POWER * (1 + ENEMY_SCALE.atk * lv));
    def = Math.round(t.def * (1 + ENEMY_SCALE.def * lv));
  }
  return {
    id,
    name: t.name,
    token: t.token,
    side,
    maxHp,
    hp: maxHp,
    atk,
    def,
    spd: t.spd,
    cr: 0,
    morale: 0,
    skills: t.skills,
    cooldowns: {},
    effects: [],
    dead: false,
    isLord: t.isLord,
    isBoss: t.isBoss,
    level: progress.level,
    xp: progress.xp,
    slot,
    row,
    stats: { dealt: 0, taken: 0, kills: 0 },
  };
}
