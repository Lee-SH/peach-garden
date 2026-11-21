import Phaser from 'phaser';
import type { Line } from '../data/scenarios';
import { GENERALS } from '../data/units';
import { button, COLOR, text, W } from '../ui/theme';

export interface StoryData {
  heading?: string;
  lines: Line[];
  next: { key: string; data?: object };
}

export class StoryScene extends Phaser.Scene {
  private story!: StoryData;
  private index = 0;
  private speakerBadge!: Phaser.GameObjects.Container;
  private speakerName!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;

  constructor() {
    super('Story');
  }

  init(data: StoryData) {
    this.story = data;
    this.index = 0;
  }

  create() {
    if (this.story.heading) {
      text(this, W / 2, 150, this.story.heading, 22, COLOR.gold).setOrigin(0.5).setAlign('center');
    }

    const boxY = 400;
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

  private show() {
    const line = this.story.lines[this.index];
    const isNarration = !line.speaker;
    this.speakerBadge.setVisible(!isNarration);
    this.speakerName.setText(line.speaker);
    if (!isNarration) {
      const g = Object.values(GENERALS).find((x) => x.name === line.speaker);
      (this.speakerBadge.list[1] as Phaser.GameObjects.Text).setText(g?.token ?? line.speaker[0]);
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

