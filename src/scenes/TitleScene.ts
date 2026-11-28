import Phaser from 'phaser';
import { loadSave, newCampaign, writeSave, type CampaignSave } from '../core/save';
import { SCENARIOS } from '../data/scenarios';
import { townOf } from '../data/town';
import { button, type Button, COLOR, H, hd, setButtonLabel, text, W } from '../ui/theme';
import { isDev, readPrefs, setDev, writePrefs } from '../ui/prefs';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    hd(this);
    // key art (public/art/scenes/title.png): title on the sky at the top, buttons over the darkened bottom
    const art = this.textures.exists('scene-title');
    if (art) {
      const bg = this.add.image(W / 2, H / 2, 'scene-title');
      bg.setScale(Math.max(W / bg.width, H / bg.height));
      this.add.graphics().fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0).fillRect(0, 0, W, 170);
      this.add.graphics().fillGradientStyle(0x14110e, 0x14110e, 0x14110e, 0x14110e, 0, 0, 0.85, 0.85).fillRect(0, 330, W, 120);
      this.add.rectangle(W / 2, 450, W, H - 450, 0x14110e, 0.85).setOrigin(0.5, 0);
    }
    this.drawPetals();
    const ty = art ? 70 : 190;
    if (this.textures.exists('scene-logo')) {
      // brush-calligraphy logo (public/art/scenes/logo.png), gently settling in
      const logo = this.add.image(W / 2, ty + 4, 'scene-logo');
      logo.setScale(250 / logo.width).setAlpha(0);
      this.tweens.add({ targets: logo, alpha: 1, y: ty, duration: 700, ease: 'Sine.easeOut' });
    } else {
      text(this, W / 2, ty, '도원', 64, COLOR.gold).setOrigin(0.5).setShadow(0, 3, '#000', 6, true, true);
    }
    text(this, W / 2, ty + 72, '삼국지 전술 RPG', 15, art ? '#f3e9d2' : COLOR.dim).setOrigin(0.5).setShadow(0, 2, '#000', 4, true, true);

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
    const animLabel = () => `동작 방식: ${readPrefs().joints ? '관절 (시험 중)' : '그림'}`;
    const anim: Button = button(this, W / 2, 520, 220, 38, animLabel(), () => {
      writePrefs({ joints: !readPrefs().joints });
      setButtonLabel(anim, animLabel());
    });

    // tap the version 7 times to turn developer mode on or off
    let taps = 0;
    text(this, W / 2, H - 30, 'v0.11 · 1장 황건적의 난 (6화)', 12, COLOR.dim)
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerup', () => {
        if (++taps < 7) return;
        setDev(!isDev());
        this.scene.restart();
      });
    if (isDev()) button(this, W - 56, 26, 96, 30, '개발 모드', () => this.scene.start('Dev'));
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
    bg: sc.id,
    next: { key: 'Formation', data: { scenarioId: sc.id } },
  });
}
