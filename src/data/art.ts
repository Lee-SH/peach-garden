import Phaser from 'phaser';
import { ART_FILES } from './artManifest';

/**
 * Character art cut from Gemini sheets with tools/cut-sheet.mjs (public/art/<id>/<pose>.png).
 * Every pose of a general is saved at the same pixel scale, plus anchors.json = feet x (0–1).
 */
export type Pose = string;
export const ATTACK_POSES: Pose[] = ['atk1', 'atk2', 'atk3', 'atk4'];

interface RunCycle {
  /** frames in order, drawn in ONE generation so they match */
  frames: Pose[];
  /** frames where a foot lands (dust puff) */
  contact: number[];
}

/**
 * Which images exist comes from the generated manifest (tools/art-manifest.mjs). Characters whose
 * frame art has a run cycle list it here; without one the idle image bobs while moving.
 * Characters without any art are drawn as a round token.
 */
const RUNS: Record<string, RunCycle> = {};
export const ART_IDS = Object.keys(ART_FILES);

/** Missing poses fall back (see FALLBACK); hurt/down → idle. */
const FALLBACK: Record<string, Pose[]> = {
  // strong moves (atk3 leap, atk4 area) use the special-move picture when there is one
  atk1: ['attack'], atk2: ['attack'], atk3: ['ult', 'special', 'attack'], atk4: ['ult', 'special', 'attack'],
  special: ['ult', 'attack'], ult: ['special', 'attack'], attack: ['atk1'], hurt: [], down: [],
};
export function resolvePose(id: string, pose: Pose): Pose {
  const files = ART_FILES[id] ?? [];
  if (files.includes(pose)) return pose;
  return (FALLBACK[pose] ?? []).find((p) => files.includes(p)) ?? 'idle';
}
export const hasPose = (id: string, pose: Pose) => (ART_FILES[id] ?? []).includes(pose);

import { CHAR_SCALE } from './scale';
export { CHAR_SCALE };

/** On-screen height of a standing general (px in the 360×640 game). */
export const SPRITE_H = Math.round(76 * CHAR_SCALE);
const RUN_FPS = 14;
/**
 * The AI-drawn run frames crouch and leap much more than a real stride (head moves ~25px).
 * Each frame's head height is pulled this far toward the cycle average to calm the bounce.
 */
const RUN_BOUNCE_DAMP = 0.7;

export const artKey = (id: string, pose: Pose) => `art-${id}-${pose}`;
const anchorKey = (id: string) => `art-${id}-anchors`;
const runKey = (id: string) => `run-${id}`;

export function preloadArt(scene: Phaser.Scene) {
  for (const id of ART_IDS) {
    const base = `${import.meta.env.BASE_URL}art/${id}/`;
    for (const pose of ART_FILES[id]) scene.load.image(artKey(id, pose), `${base}${pose}.png`);
    scene.load.json(anchorKey(id), `${base}anchors.json`);
  }
}

export const hasArt = (scene: Phaser.Scene, id: string) => scene.textures.exists(artKey(id, 'idle'));

const texH = (scene: Phaser.Scene, id: string, pose: Pose) => scene.textures.get(artKey(id, pose)).getSourceImage().height;

/** One scale for every pose so the character keeps its size (`height` = on-screen idle height). */
export function artScale(scene: Phaser.Scene, id: string, height = SPRITE_H) {
  return height / texH(scene, id, 'idle');
}

function feetX(scene: Phaser.Scene, id: string, pose: Pose) {
  const a = scene.cache.json.get(anchorKey(id)) as Record<string, number> | undefined;
  return a?.[pose] ?? 0.5;
}

/** Vertical origin: 1 = feet on the ground; run frames get their bounce damped. */
function originY(scene: Phaser.Scene, id: string, pose: Pose) {
  const frames = RUNS[id]?.frames ?? [];
  if (!frames.includes(pose)) return 1;
  const heights = frames.map((f) => texH(scene, id, f));
  const avg = heights.reduce((a, c) => a + c, 0) / heights.length;
  const h = texH(scene, id, pose);
  return (avg + (h - avg) * RUN_BOUNCE_DAMP) / h;
}

function anchor(s: Phaser.GameObjects.Sprite, id: string, pose: Pose) {
  const fx = feetX(s.scene, id, pose);
  s.setOrigin(s.flipX ? 1 - fx : fx, originY(s.scene, id, pose));
}

/** Standing sprite with its feet at (x, y). */
export function addSprite(scene: Phaser.Scene, id: string, x: number, y: number, height = SPRITE_H) {
  const s = scene.add.sprite(x, y, artKey(id, 'idle')).setScale(artScale(scene, id, height));
  setPose(s, id, 'idle');
  return s;
}

/** Show a still pose, standing on the pose's feet anchor (mirrored when facing left). */
export function setPose(s: Phaser.GameObjects.Sprite, id: string, pose: Pose) {
  s.off(Phaser.Animations.Events.ANIMATION_UPDATE);
  s.anims.stop();
  stopBob(s);
  const p = resolvePose(id, pose);
  s.setTexture(artKey(id, p));
  anchor(s, id, p);
}

/** Without run frames: hop the idle image. */
function bob(s: Phaser.GameObjects.Sprite) {
  const y0 = (s.getData('y0') as number | undefined) ?? s.y;
  s.setData('y0', y0);
  s.setData('bob', s.scene.tweens.add({ targets: s, y: y0 - 5, duration: 110, yoyo: true, repeat: -1, ease: 'Sine.easeOut' }));
}

function stopBob(s: Phaser.GameObjects.Sprite) {
  const tw = s.getData('bob') as Phaser.Tweens.Tween | undefined;
  if (!tw) return;
  tw.stop();
  s.setData('bob', undefined);
  s.setY(s.getData('y0') as number);
}

/** Loop the run cycle; `onContact` fires when a foot lands. */
export function playRun(s: Phaser.GameObjects.Sprite, id: string, onContact?: () => void) {
  const run = RUNS[id];
  if (!run) {
    setPose(s, id, 'idle');
    bob(s);
    return;
  }
  if (!s.scene.anims.exists(runKey(id))) {
    s.scene.anims.create({
      key: runKey(id),
      frames: run.frames.map((p) => ({ key: artKey(id, p) })),
      frameRate: RUN_FPS,
      repeat: -1,
    });
  }
  s.off(Phaser.Animations.Events.ANIMATION_UPDATE);
  s.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: unknown, frame: Phaser.Animations.AnimationFrame) => {
    anchor(s, id, run.frames[frame.index - 1]);
    if (run.contact.includes(frame.index - 1)) onContact?.();
  });
  s.play(runKey(id));
  anchor(s, id, run.frames[0]);
}
