export interface Pos {
  x: number;
  y: number;
}

export type Terrain = 'plain' | 'forest' | 'mountain' | 'river' | 'village';
export type Side = 'player' | 'enemy';

/**
 * melee  : hit one adjacent tile
 * push   : hit one adjacent tile, then push the target 1 tile away
 * pierce : hit 2 tiles in a straight line
 * ranged : projectile — hits the first unit in a straight line (up to `range`)
 */
export type AttackKind = 'melee' | 'push' | 'pierce' | 'ranged';

export interface Unit {
  id: string;
  name: string;
  token: string; // single Korean character shown on the board
  side: Side;
  hp: number;
  maxHp: number;
  move: number;
  power: number;
  attack: AttackKind;
  range: number; // only used by ranged
  pos: Pos;
  isLord?: boolean; // death = game over
  isBoss?: boolean;
  level: number;
  xp: number;
  moved: boolean;
  acted: boolean;
  dead: boolean;
}

/** Enemy's declared attack: a direction relative to its position at resolve time. */
export interface Intent {
  unitId: string;
  dir: Pos;
}

export type Objective = { type: 'defeatBoss'; bossId: string } | { type: 'survive'; turns: number };

export interface Reinforcement {
  turn: number; // appears at the end of the enemy phase that starts this turn
  unit: Unit;
}

export interface BattleState {
  width: number;
  height: number;
  terrain: Terrain[][]; // [y][x]
  units: Unit[];
  intents: Intent[];
  turn: number;
  objective: Objective;
  reinforcements: Reinforcement[];
}

export type Outcome = 'ongoing' | 'victory' | 'defeat';

/** Things that happened, so the scene can animate / show numbers. */
export type BattleEvent =
  | { type: 'damage'; unitId: string; amount: number; pos: Pos }
  | { type: 'death'; unitId: string; pos: Pos }
  | { type: 'pushed'; unitId: string; from: Pos; to: Pos }
  | { type: 'bump'; unitId: string; pos: Pos }
  | { type: 'levelUp'; unitId: string; level: number };
