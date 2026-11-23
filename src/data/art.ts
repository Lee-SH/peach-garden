import Phaser from 'phaser';

/**
 * Character art cut from Gemini sheets with tools/cut-sheet.mjs (public/art/<id>/<pose>.png).
 * Every pose of a general is saved at the same pixel scale, plus anchors.json = feet x (0–1).
 */
export type Pose = string;
const BASE_POSES: Pose[] = ['idle', 'ult', 'portrait', 'atk1', 'atk2', 'atk3', 'atk4'];
export const ATTACK_POSES: Pose[] = ['atk1', 'atk2', 'atk3', 'atk4'];

interface RunCycle {
  /** frames in order, drawn in ONE generation so they match */
  frames: Pose[];
  /** frames where a foot lands (dust puff) */
  contact: number[];
}

/** Generals that have art, with their run cycle. Others are drawn as a round token. */
const ART: Record<string, { run: RunCycle }> = {
  // r5 (a deep kneel without swords) is replaced by r2 so the bounce stays small and the swords stay in hand
  liubei: { run: { frames: ['r1', 'r2', 'r3', 'r4', 'r2', 'r6'], contact: [1, 4] } },
};
export const ART_IDS = Object.keys(ART);

/** On-screen height of a standing general (px in the 360×640 game). */
export const SPRITE_H = 76;
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
    for (const pose of new Set([...BASE_POSES, ...ART[id].run.frames])) scene.load.image(artKey(id, pose), `${base}${pose}.png`);
    scene.load.json(anchorKey(id), `${base}anchors.json`);
  }
}

export const hasArt = (scene: Phaser.Scene, id: string) => scene.textures.exists(artKey(id, 'idle'));

const texH = (scene: Phaser.Scene, id: string, pose: Pose) => scene.textures.get(artKey(id, pose)).getSourceImage().height;

/** One scale for every pose so the character keeps its size. */
export function artScale(scene: Phaser.Scene, id: string) {
  return SPRITE_H / texH(scene, id, 'idle');
}

function feetX(scene: Phaser.Scene, id: string, pose: Pose) {
  const a = scene.cache.json.get(anchorKey(id)) as Record<string, number> | undefined;
  return a?.[pose] ?? 0.5;
}

/** Vertical origin: 1 = feet on the ground; run frames get their bounce damped. */
function originY(scene: Phaser.Scene, id: string, pose: Pose) {
  const frames = ART[id]?.run.frames ?? [];
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
export function addSprite(scene: Phaser.Scene, id: string, x: number, y: number) {
  const s = scene.add.sprite(x, y, artKey(id, 'idle')).setScale(artScale(scene, id));
  setPose(s, id, 'idle');
  return s;
}

/** Show a still pose, standing on the pose's feet anchor (mirrored when facing left). */
export function setPose(s: Phaser.GameObjects.Sprite, id: string, pose: Pose) {
  s.off(Phaser.Animations.Events.ANIMATION_UPDATE);
  s.anims.stop();
  s.setTexture(artKey(id, pose));
  anchor(s, id, pose);
}

/** Loop the run cycle; `onContact` fires when a foot lands. */
export function playRun(s: Phaser.GameObjects.Sprite, id: string, onContact?: () => void) {
  const run = ART[id].run;
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
