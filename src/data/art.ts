import Phaser from 'phaser';

/** Character art made from a 2×2 sheet with tools/cut-sheet.mjs (public/art/<id>/<pose>.png). */
export type Pose = 'idle' | 'attack' | 'ult' | 'portrait';
const POSES: Pose[] = ['idle', 'attack', 'ult', 'portrait'];

/** Generals that have art. Others are drawn as a round token with their letter. */
export const ART_IDS = ['liubei'];

/** On-screen height of a standing general (px in the 360×640 game). */
export const SPRITE_H = 76;

export const artKey = (id: string, pose: Pose) => `art-${id}-${pose}`;

export function preloadArt(scene: Phaser.Scene) {
  for (const id of ART_IDS)
    for (const pose of POSES) scene.load.image(artKey(id, pose), `${import.meta.env.BASE_URL}art/${id}/${pose}.png`);
}

export const hasArt = (scene: Phaser.Scene, id: string) => scene.textures.exists(artKey(id, 'idle'));

/** One scale for every pose so the character keeps its size (poses share the sheet's scale). */
export function artScale(scene: Phaser.Scene, id: string) {
  return SPRITE_H / scene.textures.get(artKey(id, 'idle')).getSourceImage().height;
}

/** Standing sprite with its feet at (x, y). */
export function addSprite(scene: Phaser.Scene, id: string, x: number, y: number) {
  return scene.add.image(x, y, artKey(id, 'idle')).setOrigin(0.5, 1).setScale(artScale(scene, id));
}
