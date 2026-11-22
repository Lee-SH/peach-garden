import Phaser from 'phaser';
import { W } from './theme';

/** Battlefield band shared by the battle and formation screens. */
export const FIELD_TOP = 92;
export const GROUND_Y = 190;
export const PANEL_Y = 412;

/** Sky, parallax hills and the dirt road between FIELD_TOP and PANEL_Y. */
export function drawField(scene: Phaser.Scene) {
  makeTextures(scene);
  scene.add.rectangle(0, FIELD_TOP, W, GROUND_Y - FIELD_TOP, 0x2b3a5c).setOrigin(0);
  const far = scene.add.tileSprite(0, FIELD_TOP, W, 110, 'bg-far').setOrigin(0);
  const near = scene.add.tileSprite(0, FIELD_TOP + 50, W, 90, 'bg-near').setOrigin(0);
  const ground = scene.add.tileSprite(0, GROUND_Y, W, PANEL_Y - GROUND_Y, 'bg-ground').setOrigin(0);
  return { far, near, ground };
}

function makeTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('bg-far')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // Far: dusk sky + distant mountains
  // Banded sky (gradient fills don't survive generateTexture on every renderer)
  const sky = [0x2b3a5c, 0x3d4867, 0x575270, 0x725e6a, 0x8a6a5a];
  sky.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * 22, 360, 22));
  g.fillStyle(0x4a4a63, 1);
  for (let x = -40; x < 400; x += 90) g.fillTriangle(x, 110, x + 55, 30 + ((x * 7 + 400) % 30), x + 110, 110);
  g.generateTexture('bg-far', 360, 110);
  g.clear();
  // Near: hills with peach trees
  g.fillStyle(0x3f5a3a, 1);
  for (let x = -30; x < 400; x += 120) g.fillEllipse(x + 60, 90, 180, 70);
  for (let x = 20; x < 360; x += 75) {
    g.fillStyle(0x4a3424, 1).fillRect(x, 52, 4, 20);
    g.fillStyle(0xe89bb0, 1).fillCircle(x + 2, 48, 12);
  }
  g.generateTexture('bg-near', 360, 90);
  g.clear();
  // Ground: dirt road
  g.fillStyle(0x6b5a3c, 1).fillRect(0, 0, 360, 222);
  g.fillStyle(0x5c4d33, 1);
  for (let x = 0; x < 360; x += 40) g.fillRect(x, 30 + ((x * 13) % 150), 18, 4);
  g.fillStyle(0x4f6a3a, 1).fillRect(0, 0, 360, 10);
  g.generateTexture('bg-ground', 360, 222);
  g.destroy();
}