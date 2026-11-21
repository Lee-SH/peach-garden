import type { AttackKind, Pos, Side, Unit } from '../core/types';

export interface UnitTemplate {
  name: string;
  token: string;
  hp: number;
  move: number;
  power: number;
  attack: AttackKind;
  range?: number;
  isLord?: boolean;
  isBoss?: boolean;
  /** Short description shown in the info panel */
  desc: string;
}

/** Playable generals. Level/xp/alive state lives in the campaign save. */
export const GENERALS: Record<string, UnitTemplate> = {
  liubei: { name: '유비', token: '유', hp: 6, move: 3, power: 2, attack: 'melee', isLord: true, desc: '군주. 쓰러지면 패배. 쌍고검: 인접 1칸 공격' },
  guanyu: { name: '관우', token: '관', hp: 7, move: 4, power: 3, attack: 'push', desc: '청룡언월도: 인접 1칸 공격 후 1칸 밀쳐냄' },
  zhangfei: { name: '장비', token: '장', hp: 8, move: 3, power: 2, attack: 'pierce', desc: '장팔사모: 직선 2칸 관통 공격' },
};

export const ENEMIES: Record<string, UnitTemplate> = {
  rebel: { name: '황건병', token: '황', hp: 2, move: 3, power: 1, attack: 'melee', desc: '인접 1칸 공격' },
  archer: { name: '황건궁병', token: '궁', hp: 2, move: 2, power: 1, attack: 'ranged', range: 3, desc: '직선 3칸 안의 첫 유닛 사격' },
  chengyuanzhi: { name: '정원지', token: '정', hp: 6, move: 3, power: 2, attack: 'melee', isBoss: true, desc: '황건적 장수. 격파하면 승리' },
};

export function makeUnit(
  id: string,
  t: UnitTemplate,
  side: Side,
  pos: Pos,
  progress: { level: number; xp: number } = { level: 1, xp: 0 },
): Unit {
  // Apply level growth the same way gainXp does: +1 hp per level, +1 power on even levels
  const lv = progress.level;
  const bonusHp = lv - 1;
  const bonusPower = Math.floor(lv / 2);
  return {
    id,
    name: t.name,
    token: t.token,
    side,
    hp: t.hp + bonusHp,
    maxHp: t.hp + bonusHp,
    move: t.move,
    power: t.power + bonusPower,
    attack: t.attack,
    range: t.range ?? 1,
    pos: { ...pos },
    isLord: t.isLord,
    isBoss: t.isBoss,
    level: lv,
    xp: progress.xp,
    moved: false,
    acted: false,
    dead: false,
  };
}
