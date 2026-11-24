import Phaser from 'phaser';
import { loadSave, newCampaign, writeSave, type CampaignSave } from '../core/save';
import { SCENARIOS } from '../data/scenarios';
import { townOf } from '../data/town';
import { preloadArt } from '../data/art';
import { preloadRigs } from '../ui/rig';
import { preloadIcons } from '../ui/icons';
import { preloadTown } from './TownScene';
import { button, type Button, COLOR, H, hd, setButtonLabel, text, W } from '../ui/theme';
import { readPrefs, writePrefs } from '../ui/prefs';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  preload() {
    preloadArt(this);
    preloadRigs(this);
    preloadIcons(this);
    preloadTown(this);
  }

  create() {
    hd(this);
    this.drawPetals();
    text(this, W / 2, 190, '도원', 64, COLOR.gold).setOrigin(0.5);
    text(this, W / 2, 250, '桃園 · 삼국지 전술 RPG', 15, COLOR.dim).setOrigin(0.5);

    const save = loadSave();
    button(this, W / 2, 380, 200, 48, '새로 시작', () => {
      const fresh = newCampaign();
      writeSave(fresh);
      startScenario(this, fresh);
    });
    const label = save ? `이어하기 · ${townOf(save).place} 진영` : '이어하기';
    const cont = button(this, W / 2, 444, 220, 48, label, () => save && this.scene.start('Town'));
    cont.setEnabled(!!save && !!SCENARIOS[save.scenarioId]);

    // Compare the two animation styles (cutout rig vs frame art) — only affects generals with a rig
    const animLabel = () => `동작 방식: ${readPrefs().rig ? '관절 (시험 중)' : '프레임 그림'}`;
    const anim: Button = button(this, W / 2, 520, 220, 38, animLabel(), () => {
      writePrefs({ rig: !readPrefs().rig });
      setButtonLabel(anim, animLabel());
    });

    text(this, W / 2, H - 30, 'v0.10 · 1장 황건적의 난 (6화)', 12, COLOR.dim).setOrigin(0.5);
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
    next: { key: 'Formation', data: { scenarioId: sc.id } },
  });
}
