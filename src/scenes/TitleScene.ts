import Phaser from 'phaser';
import { loadSave, newCampaign, writeSave, type CampaignSave } from '../core/save';
import { SCENARIOS } from '../data/scenarios';
import { button, COLOR, H, text, W } from '../ui/theme';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.drawPetals();
    text(this, W / 2, 190, '도원', 64, COLOR.gold).setOrigin(0.5);
    text(this, W / 2, 250, '桃園 · 삼국지 전술 RPG', 15, COLOR.dim).setOrigin(0.5);

    const save = loadSave();
    button(this, W / 2, 380, 200, 48, '새로 시작', () => {
      const fresh = newCampaign();
      writeSave(fresh);
      startScenario(this, fresh);
    });
    const cont = button(this, W / 2, 444, 200, 48, '이어하기', () => save && startScenario(this, save));
    cont.setEnabled(!!save);

    text(this, W / 2, H - 30, 'v0.1 · 1장 1화', 12, COLOR.dim).setOrigin(0.5);
  }

  private drawPetals() {
    for (let i = 0; i < 24; i++) {
      const p = this.add
        .ellipse(Phaser.Math.Between(0, W), Phaser.Math.Between(-H, 0), 8, 5, 0xf4a6b8, 0.7)
        .setRotation(Math.random() * Math.PI);
      this.tweens.add({
        targets: p,
        y: H + 20,
        x: p.x + Phaser.Math.Between(-60, 60),
        rotation: p.rotation + 4,
        duration: Phaser.Math.Between(6000, 11000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 6000),
      });
    }
  }
}

/** Story intro → battle for the campaign's current scenario. */
export function startScenario(scene: Phaser.Scene, save: CampaignSave) {
  const sc = SCENARIOS[save.scenarioId];
  scene.scene.start('Story', {
    heading: `${sc.chapter}\n「${sc.title}」`,
    lines: sc.intro,
    next: { key: 'Battle', data: { scenarioId: sc.id } },
  });
}
