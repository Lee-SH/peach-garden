import Phaser from 'phaser';
import { devSaveAt, devWinCurrent } from '../core/simulate';
import { writeSave } from '../core/save';
import { SCENARIO_ORDER, SCENARIOS } from '../data/scenarios';
import { setDev } from '../ui/prefs';
import { button, COLOR, H, hd, text, W } from '../ui/theme';

/**
 * 개발 모드 menu: start at any battle of any chapter with a save as if every earlier battle had been
 * won on auto (levels, soldiers, refined gear), straight to the town or into the battle.
 */
export class DevScene extends Phaser.Scene {
  constructor() {
    super('Dev');
  }

  create() {
    hd(this);
    text(this, 14, 12, '개발 모드', 20, COLOR.gold);
    button(this, W - 52, 26, 84, 30, '타이틀', () => this.scene.start('Title'));
    text(this, 14, 44, '앞의 화를 자동 전투로 모두 이긴 상태로 시작해요.', 11, COLOR.dim);

    const go = (id: string | 'end', where: 'Town' | 'Battle') => {
      const save = id === 'end' ? devWinCurrent(devSaveAt(SCENARIO_ORDER[SCENARIO_ORDER.length - 1])) : devSaveAt(id);
      writeSave(save);
      if (where === 'Battle') this.scene.start('Formation', { scenarioId: save.scenarioId });
      else this.scene.start('Town');
    };

    // chapters, then their battles
    let y = 74;
    const chapters = [...new Set(SCENARIO_ORDER.map((id) => SCENARIOS[id].chapter))];
    for (const ch of chapters) {
      text(this, 16, y, ch, 14, COLOR.gold);
      y += 24;
      SCENARIO_ORDER.filter((id) => SCENARIOS[id].chapter === ch).forEach((id) => {
        const n = SCENARIO_ORDER.indexOf(id) + 1;
        text(this, 16, y + 16, `${n}화 ${SCENARIOS[id].title}`, 13).setOrigin(0, 0.5);
        button(this, 236, y + 16, 64, 30, '진영', () => go(id, 'Town'));
        button(this, 308, y + 16, 64, 30, '전투', () => go(id, 'Battle'));
        y += 40;
      });
      y += 6;
    }
    button(this, W / 2, y + 18, W - 32, 34, '1장 완결 상태로 (진영)', () => go('end', 'Town'));
    text(this, W / 2, y + 48, '2장부터는 시나리오가 추가되면 여기에 나와요.', 11, COLOR.dim).setOrigin(0.5, 0);

    text(this, 16, H - 92, '전투 중: 위쪽 [승리] 버튼으로 즉시 이겨요.\n진영: [⏭ 건너뛰기]로 이 화를 깬 것으로 해요.', 11, COLOR.dim);
    button(this, W / 2, H - 30, 200, 36, '개발 모드 끄기', () => {
      setDev(false);
      this.scene.start('Title');
    });
  }
}
