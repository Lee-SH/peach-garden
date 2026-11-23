import Phaser from 'phaser';

/**
 * Character art cut from Gemini sheets with tools/cut-sheet.mjs (public/art/<id>/<pose>.png).
 * Every pose of a general is saved at the same pixel scale, plus anchors.json = feet x (0–1).
 */
export type Pose = 'idle' | 'ult' | 'portrait' | 'atk1' | 'atk2' | 'atk3' | 'atk4' | 'run1' | 'pass' | 'run2';
const POSES: Pose[] = ['idle', 'ult', 'portrait', 'atk1', 'atk2', 'atk3', 'atk4', 'run1', 'pass', 'run2'];
export const ATTACK_POSES: Pose[] = ['atk1', 'atk2', 'atk3', 'atk4'];

/** Generals that have art. Others are drawn as a round token with their letter. */
export const ART_IDS = ['liubei'];

/**
 * Vertical origin overrides (default 1 = feet on the ground). The airborne "passing" run frame
 * hangs a leg below the ground line, so it is lifted only a little instead of by its full length.
 */
const ORIGIN_Y: Record<string, Partial<Record<Pose, number>>> = {
  liubei: { pass: 0.85 },
};

/** On-screen height of a standing general (px in the 360×640 game). */
export const SPRITE_H = 76;

export const artKey = (id: string, pose: Pose) => `art-${id}-${pose}`;
const anchorKey = (id: string) => `art-${id}-anchors`;
const runKey = (id: string) => `run-${id}`;

export function preloadArt(scene: Phaser.Scene) {
  for (const id of ART_IDS) {
    const base = `${import.meta.env.BASE_URL}art/${id}/`;
    for (const pose of POSES) scene.load.image(artKey(id, pose), `${base}${pose}.png`);
    scene.load.json(anchorKey(id), `${base}anchors.json`);
  }
}

export const hasArt = (scene: Phaser.Scene, id: string) => scene.textures.exists(artKey(id, 'idle'));

/** One scale for every pose so the character keeps its size. */
export function artScale(scene: Phaser.Scene, id: string) {
  return SPRITE_H / scene.textures.get(artKey(id, 'idle')).getSourceImage().height;
}

function feetX(scene: Phaser.Scene, id: string, pose: Pose) {
  const a = scene.cache.json.get(anchorKey(id)) as Record<string, number> | undefined;
  return a?.[pose] ?? 0.5;
}

/** Standing sprite with its feet at (x, y). */
export function addSprite(scene: Phaser.Scene, id: string, x: number, y: number) {
  const s = scene.add.sprite(x, y, artKey(id, 'idle')).setScale(artScale(scene, id));
  setPose(s, id, 'idle');
  return s;
}

/** Show a still pose, standing on the pose's feet anchor (mirrored when facing left). */
export function setPose(s: Phaser.GameObjects.Sprite, id: string, pose: Pose) {
  s.anims.stop();
  s.setTexture(artKey(id, pose));
  anchor(s, id, pose);
}

function anchor(s: Phaser.GameObjects.Sprite, id: string, pose: Pose) {
  const fx = feetX(s.scene, id, pose);
  s.setOrigin(s.flipX ? 1 - fx : fx, ORIGIN_Y[id]?.[pose] ?? 1);
}

/** Loop the run frames. */
export function playRun(s: Phaser.GameObjects.Sprite, id: string) {
  const scene = s.scene;
  if (!scene.anims.exists(runKey(id))) {
    scene.anims.create({
      key: runKey(id),
      // stride → passing → other stride → passing
      frames: (['run1', 'pass', 'run2', 'pass'] as Pose[]).map((p) => ({ key: artKey(id, p) })),
      frameRate: 12,
      repeat: -1,
    });
  }
  // every frame stands on its own feet anchor
  s.off(Phaser.Animations.Events.ANIMATION_UPDATE);
  s.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: unknown, frame: Phaser.Animations.AnimationFrame) =>
    anchor(s, id, frame.textureKey.slice(`art-${id}-`.length) as Pose),
  );
  s.play(runKey(id));
  anchor(s, id, 'run1');
}
