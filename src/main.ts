import Phaser from 'phaser';
import { H, RES, W } from './ui/theme';
import { TitleScene } from './scenes/TitleScene';
import { StoryScene } from './scenes/StoryScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';
import { FormationScene } from './scenes/FormationScene';
import { RigLabScene } from './scenes/RigLabScene';
import { CampScene } from './scenes/CampScene';

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
  scene: [TitleScene, StoryScene, FormationScene, CampScene, BattleScene, ResultScene, RigLabScene],
});

// Dev-only handle for browser automation / debugging
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
