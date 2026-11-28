import Phaser from 'phaser';
import { H, RES, W } from './ui/theme';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { StoryScene } from './scenes/StoryScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';
import { FormationScene } from './scenes/FormationScene';
import { RigLabScene } from './scenes/RigLabScene';
import { CampScene } from './scenes/CampScene';
import { TownScene } from './scenes/TownScene';
import { TavernScene } from './scenes/TavernScene';
import { DevScene } from './scenes/DevScene';

// Canvas text can't wait for a web font by itself: load both weights first (give up after 3 s)
const fontsReady = Promise.race([
  Promise.all(['400 16px "Gowun Batang"', '700 16px "Gowun Batang"'].map((f) => document.fonts.load(f, '도원 桃園'))),
  new Promise((r) => setTimeout(r, 3000)),
]).catch(() => undefined);

void fontsReady.then(start);

function start() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#14110e',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      // drawn at screen resolution; each scene's camera zooms the 360×640 world by RES (see hd())
      width: W * RES,
      height: H * RES,
    },
    // Crisper Korean text on high-DPI phones
    render: { antialias: true },
    scene: [BootScene, TitleScene, StoryScene, FormationScene, CampScene, TownScene, TavernScene, BattleScene, ResultScene, RigLabScene, DevScene],
  });

  // Dev-only handle for browser automation / debugging
  if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
}
