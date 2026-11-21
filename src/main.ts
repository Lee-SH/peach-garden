import Phaser from 'phaser';
import { H, W } from './ui/theme';
import { TitleScene } from './scenes/TitleScene';
import { StoryScene } from './scenes/StoryScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';
import { FormationScene } from './scenes/FormationScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#14110e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  // Crisper Korean text on high-DPI phones
  render: { antialias: true },
  scene: [TitleScene, StoryScene, FormationScene, BattleScene, ResultScene],
});

// Dev-only handle for browser automation / debugging
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
