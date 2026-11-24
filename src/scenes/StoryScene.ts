import Phaser from 'phaser';
import type { Line } from '../data/scenarios';
import { ENEMIES, GENERALS } from '../data/units';
import { artKey, hasArt, hasPose } from '../data/art';
import { button, COLOR, H, hd, text, W } from '../ui/theme';

export interface StoryData {
  heading?: string;
  lines: Line[];
  /** background picture: public/art/scenes/<bg>.png (or a town picture of that name, e.g. 'tavern') */
  bg?: string;
  next: { key: string; data?: object };
}

export class StoryScene extends Phaser.Scene {
  private story!: StoryData;
  private index = 0;
  private speakerBadge!: Phaser.GameObjects.Container;
  private speakerName!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private portrait!: Phaser.GameObjects.Image;
  private bgImg?: Phaser.GameObjects.Image;
  private bgName?: string;
  private heading: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Story');
  }

  init(data: StoryData) {
    this.story = data;
    this.index = 0;
  }

  create() {
    hd(this);
    // pictures: the story's own, and any line can switch to another (crossfade)
    this.bgImg = undefined;
    this.bgName = undefined;
    const names = [this.story.bg, ...this.story.lines.map((l) => l.bg)];
    const pic = names.some((n) => this.picKey(n));
    this.setBg([this.story.lines[0]?.bg, this.story.bg].find((n) => this.picKey(n)));
    if (pic) {
      // darken a little, and fade to black behind the dialogue box
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.15);
      this.add.graphics().fillGradientStyle(0x14110e, 0x14110e, 0x14110e, 0x14110e, 0, 0, 1, 1).fillRect(0, 300, W, 100);
      this.add.rectangle(W / 2, 400, W, H - 400, 0x14110e).setOrigin(0.5, 0);
    }
    this.heading = [];
    if (this.story.heading) {
      if (pic) this.heading.push(this.add.rectangle(W / 2, 150, W, 84, 0x000000, 0.55));
      this.heading.push(text(this, W / 2, 150, this.story.heading, 22, COLOR.gold).setOrigin(0.5).setAlign('center'));
    }

    const boxY = 400;
    // Speaker portrait stands on the dialogue box (generals with art only)
    this.portrait = this.add.image(20, boxY, '__DEFAULT').setOrigin(0, 1).setVisible(false);
    this.add.rectangle(W / 2, boxY + 95, W - 16, 190, COLOR.panel).setStrokeStyle(2, COLOR.panelLine);
    const circle = this.add.circle(0, 0, 22, COLOR.player).setStrokeStyle(2, 0xffffff);
    const tok = text(this, 0, 0, '', 20).setOrigin(0.5);
    this.speakerBadge = this.add.container(42, boxY + 30, [circle, tok]);
    this.speakerName = text(this, 74, boxY + 20, '', 17, COLOR.gold);
    this.body = text(this, 24, boxY + 64, '', 16).setWordWrapWidth(W - 48, true);
    text(this, W - 24, boxY + 176, '탭하여 계속 ▶', 12, COLOR.dim).setOrigin(1, 0.5);

    button(this, W - 52, 28, 84, 32, '건너뛰기', () => this.finish());
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.advance();
    });
    this.show();
  }

  private picKey(name?: string) {
    return name ? [`scene-${name}`, `town-${name}`].find((k) => this.textures.exists(k)) : undefined;
  }

  /** Show picture `name` behind everything, crossfading from the previous one. */
  private setBg(name?: string) {
    const key = this.picKey(name);
    if (!key || name === this.bgName) return;
    this.bgName = name;
    const img = this.add.image(W / 2, 0, key).setOrigin(0.5, 0).setDepth(-10);
    img.setScale(Math.max(W / img.width, H / img.height));
    const old = this.bgImg;
    this.bgImg = img;
    if (old) {
      img.setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, duration: 450, onComplete: () => old.destroy() });
    }
  }

  private show() {
    const line = this.story.lines[this.index];
    if (line.bg) this.setBg(line.bg);
    // the chapter heading belongs to the opening picture; it fades once the story moves on
    if (this.index === 1 && this.heading.length) this.tweens.add({ targets: this.heading, alpha: 0, duration: 400 });
    const isNarration = !line.speaker;
    this.speakerBadge.setVisible(!isNarration);
    this.speakerName.setText(line.speaker);
    if (!isNarration) {
      const ally = Object.values(GENERALS).find((x) => x.name === line.speaker);
      const foe = Object.values(ENEMIES).find((x) => x.name === line.speaker);
      (this.speakerBadge.list[0] as Phaser.GameObjects.Arc).setFillStyle(ally ? COLOR.player : COLOR.boss);
      (this.speakerBadge.list[1] as Phaser.GameObjects.Text).setText((ally ?? foe)?.token ?? line.speaker[0]);
    }
    // Portrait: allies stand on the left, enemy officers on the right (their art faces left)
    const allyId = Object.keys(GENERALS).find((k) => GENERALS[k].name === line.speaker);
    const foeId = Object.keys(ENEMIES).find((k) => ENEMIES[k].name === line.speaker);
    const id = allyId ?? foeId;
    const showPortrait = !!id && hasArt(this, id) && hasPose(id, 'portrait');
    this.portrait.setVisible(showPortrait);
    if (showPortrait) {
      this.portrait.setTexture(artKey(id, 'portrait'));
      this.portrait.setScale(170 / this.portrait.height);
      if (allyId) this.portrait.setOrigin(0, 1).setX(20);
      else this.portrait.setOrigin(1, 1).setX(W - 20);
    }
    this.body.setPosition(24, isNarration ? 424 : 464).setColor(isNarration ? COLOR.dim : COLOR.text);
    this.body.setText(line.text);
  }

  private advance() {
    this.index += 1;
    if (this.index >= this.story.lines.length) this.finish();
    else this.show();
  }

  private finish() {
    this.scene.start(this.story.next.key, this.story.next.data);
  }
}

