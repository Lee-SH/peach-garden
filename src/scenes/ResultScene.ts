import Phaser from 'phaser';
import type { Loot, Troops } from '../core/army';
import { unassigned } from '../core/campaign';
import { loadSave } from '../core/save';
import { ITEM_ORDER } from '../data/items';
import { GENERALS } from '../data/units';
import { icon, type IconKey } from '../ui/icons';
import { button, COLOR, hd, text, W } from '../ui/theme';
import { startScenario } from './TitleScene';

export interface ResultData {
  victory: boolean;
  scenarioId: string;
  lines: string[];
  /** next scenario id after a victory, or null when the content ends here */
  next: string | null;
  /** what was won, and which general got how many of the new soldiers */
  loot?: Loot & { given: Record<string, Troops>; merit?: Record<string, number>; note?: string };
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(data: ResultData) {
    hd(this);
    text(this, W / 2, 64, data.victory ? '승리' : '패배', 40, data.victory ? COLOR.gold : COLOR.red).setOrigin(0.5);
    const body = text(this, W / 2, 104, data.lines.join('\n'), 13).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(W - 32, true);
    if (data.loot) this.drawLoot(data.loot, body.y + body.height + 12);

    if (data.victory) {
      button(this, W / 2, 456, 220, 40, '군영 (병력·재련)', () => this.scene.start('Camp', { back: { key: 'Result', data } }));
      if (data.next) {
        button(this, W / 2, 520, 220, 48, '다음 전투로', () => {
          const save = loadSave();
          if (save) startScenario(this, save);
        });
      } else {
        text(this, W / 2, 516, '1장 완결!\n2장 「반동탁 연합」은 준비 중입니다.', 14, COLOR.gold).setOrigin(0.5).setAlign('center');
      }
    } else {
      button(this, W / 2, 500, 220, 48, '진형 바꿔 다시 하기', () =>
        this.scene.start('Formation', { scenarioId: data.scenarioId }),
      );
    }
    button(this, W / 2, 580, 220, 44, '타이틀로', () => this.scene.start('Title'));
  }

  /** The loot as icons, then how the new soldiers were shared out. */
  private drawLoot(loot: NonNullable<ResultData['loot']>, top: number) {
    const merit = loot.merit ?? {};
    const rows = Object.entries(loot.given)
      .filter(([, t]) => t.inf + t.cav > 0)
      .sort(([a], [b]) => (merit[b] ?? 0) - (merit[a] ?? 0));
    const save = loadSave();
    const left = save ? unassigned(save) : { inf: 0, cav: 0 };
    const h = 136 + Math.max(1, rows.length) * 22 + (loot.note ? 16 : 0) + (left.inf + left.cav ? 16 : 0);
    this.add.rectangle(W / 2, top, W - 24, h, COLOR.panel).setOrigin(0.5, 0).setStrokeStyle(1, COLOR.panelLine);
    let y = top + 8;
    text(this, W / 2, y, '전리품', 14, COLOR.gold).setOrigin(0.5, 0);
    y += 22;
    if (loot.note) {
      text(this, W / 2, y, loot.note, 11, COLOR.dim).setOrigin(0.5, 0);
      y += 16;
    }
    const got: { k: IconKey; n: number }[] = [
      { k: 'inf' as IconKey, n: loot.troops.inf },
      { k: 'cav' as IconKey, n: loot.troops.cav },
      ...ITEM_ORDER.map((k) => ({ k: k as IconKey, n: loot.items[k] ?? 0 })),
    ].filter((g) => g.n > 0);
    const step = Math.min(52, (W - 40) / got.length);
    got.forEach((g, i) => {
      const x = W / 2 + (i - (got.length - 1) / 2) * step;
      icon(this, g.k, x, y + 16, 30);
      text(this, x, y + 34, `+${g.n}`, 12).setOrigin(0.5, 0);
    });
    y += 58;
    text(this, W / 2, y, '새 병력은 활약한 만큼 나눠 받았어요', 11, COLOR.dim).setOrigin(0.5, 0);
    y += 20;
    if (!rows.length) {
      text(this, W / 2, y + 2, '모두 통솔 한도가 가득 찼어요', 12).setOrigin(0.5, 0);
      y += 22;
    }
    for (const [id, t] of rows) {
      const cy = y + 9;
      text(this, W / 2 - 104, cy, GENERALS[id].name, 13).setOrigin(0, 0.5);
      if (merit[id] !== undefined) text(this, W / 2 - 66, cy, `활약 ${merit[id]}`, 11, COLOR.dim).setOrigin(0, 0.5);
      icon(this, 'inf', W / 2 + 6, cy, 18);
      text(this, W / 2 + 18, cy, `+${t.inf}`, 13).setOrigin(0, 0.5);
      icon(this, 'cav', W / 2 + 66, cy, 18);
      text(this, W / 2 + 78, cy, `+${t.cav}`, 13).setOrigin(0, 0.5);
      y += 22;
    }
    const tail = left.inf + left.cav ? `남은 보병 ${left.inf} · 기병 ${left.cav}은 보급고에 있어요.\n` : '';
    text(this, W / 2, y + 4, `${tail}도구는 군영에서 무기·갑옷 강화에 써요.`, 11, COLOR.dim).setOrigin(0.5, 0).setAlign('center');
  }
}
