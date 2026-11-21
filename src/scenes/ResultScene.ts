import Phaser from 'phaser';
import { loadSave } from '../core/save';
import { button, COLOR, text, W } from '../ui/theme';
import { startScenario } from './TitleScene';

export interface ResultData {
  victory: boolean;
  scenarioId: string;
  lines: string[];
  /** next scenario id after a victory, or null when the content ends here */
  next: string | null;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(data: ResultData) {
    text(this, W / 2, 120, data.victory ? '승리' : '패배', 48, data.victory ? COLOR.gold : COLOR.red).setOrigin(0.5);
    text(this, W / 2, 190, data.lines.join('\n'), 14).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(W - 32, true);

    if (data.victory) {
      if (data.next) {
        button(this, W / 2, 520, 220, 48, '다음 전투로', () => {
          const save = loadSave();
          if (save) startScenario(this, save);
        });
      } else {
        text(this, W / 2, 440, '1장 완결!\n2장 「반동탁 연합」은 준비 중입니다.', 14, COLOR.gold).setOrigin(0.5).setAlign('center');
      }
    } else {
      button(this, W / 2, 500, 220, 48, '진형 바꿔 다시 하기', () =>
        this.scene.start('Formation', { scenarioId: data.scenarioId }),
      );
    }
    button(this, W / 2, 580, 220, 44, '타이틀로', () => this.scene.start('Title'));
  }
}
