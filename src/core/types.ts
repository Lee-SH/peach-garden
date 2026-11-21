export type Side = 'player' | 'enemy';

/** enemy: one enemy (player taps it) · allEnemies / allAllies: everyone on that side · self */
export type TargetType = 'enemy' | 'allEnemies' | 'allAllies' | 'self';

export type EffectType = 'atkUp' | 'defDown' | 'stun' | 'burn';

export interface EffectSpec {
  type: EffectType;
  turns: number;
  /** who receives it: the skill's targets, or the caster */
  on: 'targets' | 'self';
}

export interface Skill {
  id: string;
  name: string;
  desc: string;
  target: TargetType;
  /** damage multiplier on attack; 0 = no damage */
  power: number;
  /** turns before it can be used again (0 = always) */
  cooldown: number;
  /** needs a full morale (기세) gauge and empties it */
  ultimate?: boolean;
  /** heal as a fraction of each target's max HP */
  heal?: number;
  effects?: EffectSpec[];
  /** combat readiness pushed to all allies (0~100) */
  allyCrPush?: number;
}

export interface Effect {
  type: EffectType;
  turns: number;
}

export interface Fighter {
  id: string;
  name: string;
  token: string;
  side: Side;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  /** combat readiness 0~100; acts when it reaches 100 */
  cr: number;
  /** 기세 0~100; ultimate needs 100 */
  morale: number;
  skills: Skill[];
  cooldowns: Record<string, number>;
  effects: Effect[];
  dead: boolean;
  isLord?: boolean;
  isBoss?: boolean;
  level: number;
  xp: number;
  /** formation slot: 0 = 선봉(front), 1 = 중군, 2 = 후군. Enemies use their wave index. */
  slot: number;
  /** counters for end-of-battle XP */
  stats: { dealt: number; taken: number; kills: number };
}

export interface Battle {
  fighters: Fighter[];
  rng: () => number;
}

export type Outcome = 'ongoing' | 'victory' | 'defeat';

export type CombatEvent =
  | { type: 'damage'; id: string; amount: number; crit: boolean }
  | { type: 'heal'; id: string; amount: number }
  | { type: 'effect'; id: string; effect: EffectType }
  | { type: 'burn'; id: string; amount: number }
  | { type: 'stunned'; id: string }
  | { type: 'death'; id: string };
