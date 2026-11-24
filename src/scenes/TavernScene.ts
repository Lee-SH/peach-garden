import Phaser from 'phaser';
import { loadSave, writeSave, type CampaignSave } from '../core/save';
import { SCENARIOS } from '../data/scenarios';
import { openTalks, replayable, talkSeenFlag } from '../data/tavern';
import { button, COLOR, H, hd, text, W } from '../ui/theme';

/** 주막: the brothers' talks (one more after every battle won) and replays of the story so far. */
export class TavernScene extends Phaser.Scene {
  private save!: CampaignSave;

  constructor() {
    super('Tavern');
  }

  create() {
    hd(this);
    const save = loadSave();
    if (!save) {
      this.scene.start('Title');
      return;
    }
    this.save = save;
    // inside of the tavern (public/art/town/tavern.png, loaded with the town pictures), dimmed under the list
    if (this.textures.exists('town-tavern')) {
      const bg = this.add.image(W / 2, H / 2, 'town-tavern');
      bg.setScale(Math.max(W / bg.width, H / bg.height));
      this.add.rectangle(W / 2, H / 2, W, H, 0x14110e, 0.55);
    }
    text(this, 14, 12, '주막', 20, COLOR.gold);
    button(this, W - 52, 26, 84, 30, '돌아가기', () => this.scene.start('Town'));
    text(this, 14, 44, '의형제의 술자리 이야기와 지난 이야기를 볼 수 있어요.', 11, COLOR.dim);

    let y = 76;
    text(this, 16, y, '술자리 대화', 14, COLOR.gold);
    y += 26;
    const talks = openTalks(save);
    if (!talks.length) {
      text(this, 16, y, '전투에서 이기면 새 이야기가 열려요.', 12, COLOR.dim);
      y += 30;
    }
    for (const t of talks) {
      const fresh = !save.flags[talkSeenFlag(t.id)];
      this.row(y, t.title, fresh ? '새 이야기' : '', () => {
        writeSave({ ...this.save, flags: { ...this.save.flags, [talkSeenFlag(t.id)]: true } });
        this.scene.start('Story', { heading: `주막\n「${t.title}」`, lines: t.lines, next: { key: 'Tavern' } });
      });
      y += 44;
    }

    y += 10;
    text(this, 16, y, '지난 이야기 다시 보기', 14, COLOR.gold);
    y += 26;
    const done = replayable(save);
    if (!done.length) text(this, 16, y, '아직 끝낸 전투가 없어요.', 12, COLOR.dim);
    done.forEach((id, i) => {
      if (y > H - 40) return;
      const sc = SCENARIOS[id];
      this.row(y, `${i + 1}화 「${sc.title}」`, '', () =>
        this.scene.start('Story', { heading: `${sc.chapter}\n「${sc.title}」`, lines: [...sc.intro, ...sc.outro], next: { key: 'Tavern' } }),
      );
      y += 44;
    });
  }

  private row(y: number, label: string, badge: string, on: () => void) {
    const b = button(this, W / 2, y + 16, W - 32, 38, label, on);
    (b.container.list[1] as Phaser.GameObjects.Text).setFontSize(14);
    if (badge) {
      const tag = this.add.rectangle(W - 52, y + 16, 64, 20, 0xc0392b).setStrokeStyle(1, 0xffd23b);
      const t = text(this, W - 52, y + 16, badge, 11, '#fff8e6').setOrigin(0.5);
      this.tweens.add({ targets: [tag, t], alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
    }
  }
}
