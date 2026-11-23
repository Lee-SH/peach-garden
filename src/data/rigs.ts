/**
 * Cutout (paper-doll) rigs: body parts from a parts sheet, joined at joints and posed by angle.
 * Parts come from tools/rig-prep.mjs → public/art/<id>/rig/<part>.png.
 *
 * Units: "rig units" = part-image pixels × part scale. The whole rig is then scaled so that the
 * standing character is SPRITE_H tall in the game. Angles are degrees, clockwise (screen y is down).
 * Hanging limbs (arms, legs): 0 = straight down, NEGATIVE = swung forward (toward the enemy on the right).
 * Upright parts (torso, head, sword): 0 = straight up, POSITIVE = tipped forward.
 */
export type Vec = [number, number];

export interface PartDef {
  /** image file name (without .png) */
  img: string;
  /** part-image pixel scale → rig units */
  scale: number;
  /** joint the part rotates around, in part-image pixels */
  pivot: Vec;
  /** the end of the limb (elbow, knee, hand, …) in part-image pixels; straightens the image so 0° = down */
  tip?: Vec;
  /** multiply colour (back limbs a little darker) */
  tint?: number;
}

export type BoneName =
  | 'hips' | 'torso' | 'head' | 'skirt'
  | 'aB1' | 'aB2' | 'sB' | 'aF1' | 'aF2' | 'sF'
  | 'lB1' | 'lB2' | 'lF1' | 'lF2';

export interface BoneDef {
  part: PartDef | null;
  parent: BoneName | null;
  /** where this bone's joint sits in the parent's frame (rig units); 'tip' = at the parent's tip */
  at: Vec | 'tip';
}

export interface RigDef {
  bones: Record<BoneName, BoneDef>;
  /** back → front */
  drawOrder: BoneName[];
  /** hip joint height above the feet (rig units) */
  hipHeight: number;
  /** standing height (rig units), used to scale the rig to SPRITE_H */
  height: number;
  /** the part images on disk are this fraction of the measured size (tools/rig-prep.mjs imgScale) */
  imgScale: number;
  /** twin = a sword in each hand (Liu Bei); polearm = one long weapon held in both hands */
  weapon: WeaponStyle;
}

export type WeaponStyle = 'twin' | 'polearm';

/** A pose: bone angles plus body offset (rig units, negative = up). */
export type Pose = Partial<Record<BoneName, number>> & { bodyY?: number };

const BACK = 0xb8b8c0;

/**
 * The AI art is very big-headed; heads are drawn at this fraction (around the neck, so they stay
 * attached). Feedback: "머리가 몸에 비해 너무 크다" — 0.84, then "조금 더 작게" — 0.74.
 */
export const HEAD_SCALE = 0.74;
/** head height above the neck joint at full size (rig units); used to keep the standing height right */
const HEAD_ABOVE_NECK = 262;

/**
 * Where things are on one general's parts sheet, in full-size part-image pixels
 * (measure with a grid overlay; see docs/design.md).
 */
interface Measure {
  head: { pivot: Vec };
  torso: { pivot: Vec; neck: Vec; shoulderB: Vec; shoulderF: Vec };
  skirt: { pivot: Vec; scale?: number };
  upper: { pivot: Vec; tip: Vec };
  fore: { pivot: Vec; tip: Vec };
  thighB: { pivot: Vec; tip: Vec };
  thighF: { pivot: Vec; tip: Vec };
  shin: { pivot: Vec; tip: Vec };
  weapon: { pivot: Vec; scale: number };
  style: WeaponStyle;
}

function buildRig(m: Measure): RigDef {
  const torso: PartDef = { img: 'torso', scale: 0.77, pivot: m.torso.pivot };
  // torso-image points → rig units relative to the torso pivot
  const t = ([x, y]: Vec): Vec => [(x - torso.pivot[0]) * torso.scale, (y - torso.pivot[1]) * torso.scale];
  const upper = (tint?: number): PartDef => ({ img: 'upperarm', scale: 0.45, ...m.upper, tint });
  const fore = (tint?: number): PartDef => ({ img: 'forearm', scale: 0.45, ...m.fore, tint });
  const weapon = (tint?: number): PartDef => ({ img: 'weapon', scale: m.weapon.scale, pivot: m.weapon.pivot, tint });
  const shin = (tint?: number): PartDef => ({ img: 'shin', scale: 0.63, ...m.shin, tint });
  const bones: RigDef['bones'] = {
    hips: { part: null, parent: null, at: [0, -205] },
    torso: { part: torso, parent: 'hips', at: [0, 0] },
    skirt: { part: { img: 'skirt', scale: m.skirt.scale ?? 0.68, pivot: m.skirt.pivot }, parent: 'torso', at: t([m.torso.pivot[0], m.torso.pivot[1] - 18]) },
    head: { part: { img: 'head', scale: HEAD_SCALE, pivot: m.head.pivot }, parent: 'torso', at: t(m.torso.neck) },
    aB1: { part: upper(BACK), parent: 'torso', at: t(m.torso.shoulderB) },
    aB2: { part: fore(BACK), parent: 'aB1', at: 'tip' },
    // a polearm is held by the front hand only (the back hand just reaches for the shaft)
    sB: { part: m.style === 'twin' ? weapon(BACK) : null, parent: 'aB2', at: 'tip' },
    aF1: { part: upper(), parent: 'torso', at: t(m.torso.shoulderF) },
    aF2: { part: fore(), parent: 'aF1', at: 'tip' },
    sF: { part: weapon(), parent: 'aF2', at: 'tip' },
    lB1: { part: { img: 'thigh_b', scale: 0.62, ...m.thighB, tint: BACK }, parent: 'hips', at: [-16, 0] },
    lB2: { part: shin(BACK), parent: 'lB1', at: 'tip' },
    lF1: { part: { img: 'thigh_f', scale: 0.62, ...m.thighF }, parent: 'hips', at: [16, 0] },
    lF2: { part: shin(), parent: 'lF1', at: 'tip' },
  };
  return {
    bones,
    // a polearm passes behind the front arm but in front of the body
    drawOrder: ['sB', 'aB2', 'aB1', 'lB2', 'lB1', 'lF2', 'lF1', 'torso', 'skirt', 'head', 'sF', 'aF2', 'aF1'],
    hipHeight: 205,
    // a smaller head makes the figure shorter; scaling to this height keeps it the same size on screen
    height: 596 - HEAD_ABOVE_NECK * (1 - HEAD_SCALE),
    imgScale: 0.4,
    weapon: m.style,
  };
}

const liubei = () =>
  buildRig({
    head: { pivot: [117, 262] },
    torso: { pivot: [92, 200], neck: [82, 34], shoulderB: [30, 66], shoulderF: [158, 66] },
    skirt: { pivot: [105, 12] },
    upper: { pivot: [95, 18], tip: [55, 165] },
    fore: { pivot: [60, 18], tip: [80, 212] },
    thighB: { pivot: [55, 20], tip: [52, 170] },
    thighF: { pivot: [50, 20], tip: [55, 172] },
    shin: { pivot: [48, 22], tip: [52, 214] },
    weapon: { pivot: [28, 255], scale: 0.55 },
    style: 'twin',
  });

const guanyu = () =>
  buildRig({
    // the neck hides behind the long beard; the beard hangs over the chest
    head: { pivot: [118, 228] },
    torso: { pivot: [93, 205], neck: [88, 32], shoulderB: [25, 72], shoulderF: [160, 72] },
    skirt: { pivot: [142, 15], scale: 0.62 },
    upper: { pivot: [90, 16], tip: [60, 165] },
    fore: { pivot: [45, 20], tip: [86, 215] },
    thighB: { pivot: [52, 20], tip: [50, 170] },
    thighF: { pivot: [50, 20], tip: [52, 172] },
    shin: { pivot: [44, 20], tip: [56, 222] },
    // Green Dragon Crescent Blade: gripped on the shaft a little below the middle
    weapon: { pivot: [40, 380], scale: 1.0 },
    style: 'polearm',
  });

const zhangfei = () =>
  buildRig({
    head: { pivot: [172, 265] },
    torso: { pivot: [100, 212], neck: [95, 30], shoulderB: [30, 80], shoulderF: [170, 76] },
    skirt: { pivot: [117, 15], scale: 0.64 },
    upper: { pivot: [95, 18], tip: [55, 160] },
    fore: { pivot: [55, 18], tip: [73, 205] },
    thighB: { pivot: [55, 20], tip: [52, 170] },
    thighF: { pivot: [50, 20], tip: [55, 172] },
    shin: { pivot: [50, 20], tip: [60, 212] },
    // Serpent Spear: drawn short on the sheet, scaled up to Guan Yu's weapon length
    weapon: { pivot: [18, 200], scale: 1.8 },
    style: 'polearm',
  });

export const RIGS: Record<string, () => RigDef> = { liubei, guanyu, zhangfei };
export const RIG_PARTS = ['head', 'torso', 'skirt', 'upperarm', 'forearm', 'thigh_b', 'thigh_f', 'shin', 'weapon'];

// ---------------------------------------------------------------------------
// Poses (shared by every general with the same skeleton)
// ---------------------------------------------------------------------------

export const REST: Required<Pose> = {
  hips: 0, torso: 0, head: 0, skirt: 0,
  aB1: 10, aB2: -20, sB: 115,
  aF1: -6, aF2: -25, sF: 115,
  lB1: 5, lB2: 0, lF1: -5, lF2: 0,
  bodyY: 0,
};

/** Breathing idle at time t (seconds). The head rides along with the body (a big chibi head that stays still looks pasted on). */
export function idlePose(t: number): Pose {
  const b = Math.sin(t * 2.4);
  return { ...REST, bodyY: b * 6, torso: b * 1.5, head: b * 2, aF1: REST.aF1 - b * 3, aB1: REST.aB1 + b * 3 };
}

/**
 * Run cycles per second (2 strides each). Chosen together with the dash speed in BattleScene so
 * each stride covers ~2 leg lengths — faster movement than the legs makes the body look dragged.
 */
export const RUN_CADENCE = 2.5;

/**
 * Run cycle at phase p (radians; one left + right stride per 2π).
 * Legs swing asymmetrically — a short reach forward (the foot lands nearly under the body) and a
 * long push back — so the leaning body leads and the legs drive it, instead of the feet pulling
 * the body along. At full spread (|sin p| = 1) the body is lifted: both feet leave the ground.
 * The recovering leg folds its knee; arms pump opposite the legs; the head follows the lean.
 */
export function runPose(p: number): Pose {
  const s = Math.sin(p);
  const c = Math.cos(p);
  const torso = 24 + 3 * Math.sin(2 * p);
  // thigh: -30° (forward) … +60° (back)
  const lF1 = 15 - 45 * s;
  const lB1 = 15 + 45 * s;
  // knee: bent ~35° when reaching forward (shin near vertical), folded while swinging forward
  const knee = (thigh: number, swingingForward: number) => 10 + Math.max(0, -thigh) * 0.9 + 90 * Math.max(0, swingingForward);
  // arms: forward -60° … back +35°, opposite the legs
  const aF1 = -12 + 47 * s;
  const aB1 = -12 - 47 * s;
  const aF2 = -100 + 15 * s;
  const aB2 = -100 - 15 * s;
  return {
    ...REST,
    torso,
    head: 2 + 4 * Math.sin(2 * p + 0.8),
    lF1,
    lB1,
    lF2: knee(lF1, c),
    lB2: knee(lB1, -c),
    aF1,
    aB1,
    aF2,
    aB2,
    // swords trail back and down: world angle ≈ 225° whatever the arms do
    sF: 225 - torso - aF1 - aF2 - 360,
    sB: 225 - torso - aB1 - aB2 - 360,
    skirt: 8 * s,
    bodyY: -45 * Math.abs(s),
  };
}

export interface Move {
  /** wind-up, held until the strike */
  wind: Pose;
  /** the hit itself */
  strike: Pose;
  windMs: number;
  strikeMs: number;
  /** spin the whole body during the strike */
  spin?: boolean;
}

/** Attack poses, matching the frame art's atk1–atk4. */
export const MOVES: Record<string, Move> = {
  // horizontal slash
  atk1: {
    wind: { torso: -10, head: 4, aF1: 150, aF2: -30, sF: 40, aB1: -40, aB2: -40, lF1: -25, lB1: 22 },
    strike: { torso: 16, head: -6, aF1: -105, aF2: -10, sF: 100, aB1: 45, aB2: -20, lF1: -30, lB1: 28 },
    windMs: 140,
    strikeMs: 80,
  },
  // forward thrust
  atk2: {
    wind: { torso: -12, aF1: 45, aF2: -115, sF: 180, aB1: -30, lF1: -10, lB1: 12 },
    strike: { torso: 22, head: -10, aF1: -88, aF2: 0, sF: 180, aB1: 50, lF1: -48, lF2: 12, lB1: 42, lB2: 12, bodyY: 30 },
    windMs: 150,
    strikeMs: 70,
  },
  // leaping overhead cross-slash
  atk3: {
    wind: { torso: -6, head: 6, aF1: 168, aF2: -10, sF: 180, aB1: 172, aB2: -10, sB: 180, lF2: 45, lB2: 45, lF1: -20, lB1: 10, bodyY: -70 },
    strike: { torso: 22, head: -8, aF1: -55, aF2: -15, sF: 180, aB1: -40, aB2: -15, sB: 180, lF1: -30, lB1: 25, lF2: 10, lB2: 10, bodyY: 10 },
    windMs: 170,
    strikeMs: 90,
  },
  // spinning slash, arms out
  atk4: {
    wind: { torso: -8, aF1: -90, aF2: 0, sF: 180, aB1: 90, aB2: 0, sB: 180, lF1: -15, lB1: 15 },
    strike: { torso: 8, aF1: -95, aF2: 0, sF: 180, aB1: 95, aB2: 0, sB: 180, lF1: -20, lB1: 20 },
    windMs: 120,
    strikeMs: 160,
    spin: true,
  },
};

/** Sword raised to the sky (ultimates, rallying, healing). */
export const RAISE: Pose = { ...REST, aF1: 172, aF2: -8, sF: 180, head: 6, torso: -3, aB1: -15, aB2: -30 };

/** Flinch when hit. */
export const FLINCH: Pose = { torso: -16, head: -12, aF1: 25, aB1: -15, bodyY: 6 };

// ---------------------------------------------------------------------------
// Polearm style (Guan Yu, Zhang Fei): one long weapon, front hand on the shaft, back hand reaching
// ---------------------------------------------------------------------------

/** Set the front weapon so it points at `world` degrees (0 = up, 90 = forward) whatever the arm does. */
function aim(p: Pose, world: number): Pose {
  return { ...p, sF: world - (p.torso ?? 0) - (p.aF1 ?? 0) - (p.aF2 ?? 0) };
}

const P_REST: Required<Pose> = {
  ...REST,
  aF1: -25, aF2: -55,
  aB1: -15, aB2: -55,
  sB: 0,
  sF: 0,
};
P_REST.sF = aim(P_REST, 6).sF!;

function polearmIdle(t: number): Pose {
  const b = Math.sin(t * 2.2);
  return aim({ ...P_REST, bodyY: b * 6, torso: b * 1.5, head: b * 2, aF1: P_REST.aF1 - b * 2, aB1: P_REST.aB1 + b * 2 }, 6 + b);
}

/** Same legs as the twin run; the weapon is carried slanted forward with both hands. */
function polearmRun(p: number): Pose {
  const base = runPose(p);
  const s = Math.sin(p);
  return aim({ ...base, aF1: -40 + 10 * s, aF2: -55, aB1: -25 - 10 * s, aB2: -75 }, 62);
}

const P_MOVES: Record<string, Move> = {
  // big sweeping cut: blade raised behind, swept down and forward
  atk1: {
    wind: aim({ torso: -12, head: 4, aF1: 150, aF2: -20, aB1: 120, aB2: -30, lF1: -25, lB1: 22 }, -55),
    strike: aim({ torso: 20, head: -6, aF1: -70, aF2: -20, aB1: -45, aB2: -40, lF1: -32, lB1: 30 }, 128),
    windMs: 170,
    strikeMs: 90,
  },
  // thrust: weapon level, pulled back, then driven forward with a lunge
  atk2: {
    wind: aim({ torso: -10, aF1: 40, aF2: -100, aB1: 25, aB2: -95, lF1: -10, lB1: 12 }, 90),
    strike: aim({ torso: 22, head: -8, aF1: -82, aF2: 0, aB1: -55, aB2: -25, lF1: -48, lF2: 12, lB1: 42, lB2: 12, bodyY: 30 }, 90),
    windMs: 150,
    strikeMs: 70,
  },
  // leaping overhead chop
  atk3: {
    wind: aim({ torso: -8, head: 6, aF1: 168, aF2: -10, aB1: 160, aB2: -10, lF2: 45, lB2: 45, lF1: -20, lB1: 10, bodyY: -70 }, -15),
    strike: aim({ torso: 24, head: -8, aF1: -60, aF2: -20, aB1: -40, aB2: -30, lF1: -30, lB1: 25, lF2: 10, lB2: 10, bodyY: 10 }, 150),
    windMs: 180,
    strikeMs: 90,
  },
  // spinning sweep, weapon level
  atk4: {
    wind: aim({ torso: -6, aF1: -90, aF2: 0, aB1: -70, aB2: -20, lF1: -15, lB1: 15 }, 90),
    strike: aim({ torso: 8, aF1: -95, aF2: 0, aB1: -75, aB2: -20, lF1: -20, lB1: 20 }, 95),
    windMs: 120,
    strikeMs: 160,
    spin: true,
  },
};

const P_RAISE: Pose = aim({ ...P_REST, aF1: 170, aF2: -5, aB1: -10, aB2: -40, head: 6, torso: -3 }, 0);

/** Roar (shouts like 대갈일성): chest out, head thrown back, arms flung wide, feet planted. */
const ROAR_BODY: Pose = { torso: -14, head: -20, lF1: -22, lB1: 22, lF2: 8, lB2: 8, bodyY: -6 };
const T_ROAR: Pose = { ...REST, ...ROAR_BODY, aF1: -55, aF2: -35, aB1: 60, aB2: -25 };
const P_ROAR: Pose = aim({ ...P_REST, ...ROAR_BODY, aF1: -35, aF2: -60, aB1: 65, aB2: -20 }, 15);

// ---------------------------------------------------------------------------

export interface Style {
  rest: Required<Pose>;
  idle: (t: number) => Pose;
  run: (p: number) => Pose;
  moves: Record<string, Move>;
  raise: Pose;
  roar: Pose;
  flinch: Pose;
}

export const STYLES: Record<WeaponStyle, Style> = {
  twin: { rest: REST, idle: idlePose, run: runPose, moves: MOVES, raise: RAISE, roar: T_ROAR, flinch: FLINCH },
  polearm: { rest: P_REST, idle: polearmIdle, run: polearmRun, moves: P_MOVES, raise: P_RAISE, roar: P_ROAR, flinch: FLINCH },
};
