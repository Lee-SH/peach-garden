import Phaser from 'phaser';
import { artUrl, SCENE_FILES } from '../data/artManifest';
import { preloadArt } from '../data/art';
import { preloadRigs } from '../ui/rig';
import { preloadIcons } from '../ui/icons';
import { COLOR, H, hd, text, W } from '../ui/theme';
import { preloadTown } from './TownScene';

/** Story, title and splash pictures under public/art/scenes/. */
export function preloadScenes(scene: Phaser.Scene) {
  for (const name of SCENE_FILES) {
    if (!scene.textures.exists(`scene-${name}`)) scene.load.image(`scene-${name}`, artUrl('scenes', name));
  }
}

/**
 * First screen: shows the splash picture (public/art/scenes/splash.png, loaded first and alone) with
 * a progress bar while everything else loads, then opens the title.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    if (SCENE_FILES.includes('splash')) this.load.image('scene-splash', artUrl('scenes', 'splash'));
  }

  create() {
    hd(this);
    document.body.classList.add('ready'); // hide the HTML placeholder
    if (this.textures.exists('scene-splash')) {
      const bg = this.add.image(W / 2, H / 2, 'scene-splash');
      bg.setScale(Math.max(W / bg.width, H / bg.height));
      this.add.graphics().fillGradientStyle(0x14110e, 0x14110e, 0x14110e, 0x14110e, 0, 0, 0.9, 0.9).fillRect(0, H - 220, W, 120);
      this.add.rectangle(W / 2, H - 100, W, 100, 0x14110e, 0.9).setOrigin(0.5, 0);
    } else {
      text(this, W / 2, H / 2 - 60, '도원', 56, COLOR.gold).setOrigin(0.5);
      text(this, W / 2, H / 2, '桃園', 18, COLOR.dim).setOrigin(0.5);
    }

    // progress bar
    const bw = W - 80;
    const by = H - 70;
    this.add.rectangle(W / 2, by, bw + 4, 12, 0x000000, 0.6).setStrokeStyle(1, COLOR.panelLine);
    const fill = this.add.rectangle(40, by, 0, 8, 0xe8c15a).setOrigin(0, 0.5);
    const label = text(this, W / 2, by - 22, '불러오는 중… 0%', 13, '#f3e9d2').setOrigin(0.5).setShadow(0, 1, '#000', 3, true, true);
    const petal = this.add.ellipse(40, by, 10, 6, 0xf4a6b8);
    this.load.on('progress', (p: number) => {
      fill.width = bw * p;
      petal.x = 40 + bw * p;
      label.setText(`불러오는 중… ${Math.round(p * 100)}%`);
    });
    this.load.once('complete', () => {
      label.setText('준비 완료');
      this.time.delayedCall(250, () => this.scene.start('Title'));
    });

    preloadArt(this);
    preloadRigs(this);
    preloadIcons(this);
    preloadTown(this);
    preloadScenes(this);
    this.load.start();
  }
}
