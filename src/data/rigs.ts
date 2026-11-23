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
}

/** A pose: bone angles plus body offset (rig units, negative = up). */
export type Pose = Partial<Record<BoneName, number>> & { bodyY?: number };

const BACK = 0xb8b8c0;

function liubei(): RigDef {
  const torso: PartDef = { img: 'torso', scale: 0.77, pivot: [92, 200] };
  // torso-image points → rig units relative to the torso pivot
  const t = (x: number, y: number): Vec => [(x - torso.pivot[0]) * torso.scale, (y - torso.pivot[1]) * torso.scale];
  const upper = (tint?: number): PartDef => ({ img: 'upperarm', scale: 0.45, pivot: [95, 18], tip: [55, 165], tint });
  const fore = (tint?: number): PartDef => ({ img: 'forearm', scale: 0.45, pivot: [60, 18], tip: [80, 212], tint });
  const sword = (tint?: number): PartDef => ({ img: 'sword', scale: 0.55, pivot: [28, 255], tint });
  const shin = (tint?: number): PartDef => ({ img: 'shin', scale: 0.63, pivot: [48, 22], tip: [52, 214], tint });
  const bones: RigDef['bones'] = {
    hips: { part: null, parent: null, at: [0, -205] },
    torso: { part: torso, parent: 'hips', at: [0, 0] },
    skirt: { part: { img: 'skirt', scale: 0.68, pivot: [105, 12] }, parent: 'torso', at: t(92, 186) },
    head: { part: { img: 'head', scale: 1, pivot: [117, 262] }, parent: 'torso', at: t(82, 34) },
    aB1: { part: upper(BACK), parent: 'torso', at: t(30, 66) },
    aB2: { part: fore(BACK), parent: 'aB1', at: 'tip' },
    sB: { part: sword(BACK), parent: 'aB2', at: 'tip' },
    aF1: { part: upper(), parent: 'torso', at: t(158, 66) },
    aF2: { part: fore(), parent: 'aF1', at: 'tip' },
    sF: { part: sword(), parent: 'aF2', at: 'tip' },
    lB1: { part: { img: 'thigh_b', scale: 0.62, pivot: [55, 20], tip: [52, 170], tint: BACK }, parent: 'hips', at: [-16, 0] },
    lB2: { part: shin(BACK), parent: 'lB1', at: 'tip' },
    lF1: { part: { img: 'thigh_f', scale: 0.62, pivot: [50, 20], tip: [55, 172] }, parent: 'hips', at: [16, 0] },
    lF2: { part: shin(), parent: 'lF1', at: 'tip' },
  };
  return {
    bones,
    drawOrder: ['sB', 'aB2', 'aB1', 'lB2', 'lB1', 'lF2', 'lF1', 'torso', 'skirt', 'head', 'sF', 'aF2', 'aF1'],
    hipHeight: 205,
    height: 596,
    imgScale: 0.4,
  };
}

export const RIGS: Record<string, () => RigDef> = { liubei };
export const RIG_PARTS = ['head', 'torso', 'skirt', 'upperarm', 'forearm', 'thigh_b', 'thigh_f', 'shin', 'sword'];

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
