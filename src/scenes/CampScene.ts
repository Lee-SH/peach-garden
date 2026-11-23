import Phaser from 'phaser';
import { applyGear, applyTroops, GRADE_NAMES, troopCap, upgradeCost, type Upgrade } from '../core/army';
import { armyOf, assignedTo, gearOf, reassign, refine, setAssign, unassigned } from '../core/campaign';
import { loadSave, newCampaign, writeSave, type CampaignSave } from '../core/save';
import { artKey, hasArt, hasPose } from '../data/art';
import { ITEM_ORDER, ITEMS, UPGRADE_LABEL } from '../data/items';
import { GENERALS, makeFighter } from '../data/units';
import { button, COLOR, hd, text, W, H } from '../ui/theme';

export interface CampData {
  /** where "돌아가기" leads */
  back: { key: string; data?: object };
  select?: string;
}

/**
 * 군영: hand soldiers to generals and refine their weapons and armour with old-style tools.
 * Every change is saved immediately.
 */
export class CampScene extends Phaser.Scene {
  private save!: CampaignSave;
  private back!: CampData['back'];
  private sel = '';
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('Camp');
  }

  create(data: CampData) {
    hd(this);
    this.save = loadSave() ?? newCampaign();
    this.back = data.back;
    const alive = Object.keys(GENERALS).filter((id) => this.save.roster[id]?.alive);
    this.sel = data.select && alive.includes(data.select) ? data.select : alive[0];
    this.layer = this.add.container(0, 0);
    this.render();
  }

  private commit(next: CampaignSave | null) {
    if (!next) return;
    this.save = next;
    writeSave(next);
    this.render();
  }

  private render() {
    this.layer.removeAll(true);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.layer.add(o);
      return o;
    };
    const btn = (x: number, y: number, w: number, h: number, label: string, on: () => void, enabled = true) => {
      const b = button(this, x, y, w, h, label, on);
      b.setEnabled(enabled);
      if (!enabled) b.container.setAlpha(0.45);
      add(b.container);
      return b;
    };
    const s = this.save;
    const id = this.sel;
    const g = GENERALS[id];
    const lv = s.roster[id].level;

    add(text(this, 14, 12, '군영', 20, COLOR.gold));
    add(text(this, 14, 42, '병력을 나눠 주고, 재련 도구로 무기와 갑옷을 강화합니다.', 11, COLOR.dim));

    // general tabs
    const alive = Object.keys(GENERALS).filter((k) => s.roster[k]?.alive);
    alive.forEach((k, i) => {
      const b = btn(62 + i * 118, 82, 110, 34, `${GENERALS[k].name} Lv${s.roster[k].level}`, () => {
        this.sel = k;
        this.render();
      });
      if (k === id) (b.container.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(3, 0xffd23b);
    });

    // portrait + effective stats
    if (hasArt(this, id) && hasPose(id, 'portrait')) {
      const p = add(this.add.image(14, 228, artKey(id, 'portrait')).setOrigin(0, 1));
      p.setScale(118 / p.height);
    }
    const t = assignedTo(s, id);
    const gear = gearOf(s, id);
    const base = makeFighter(id, g, 'player', s.roster[id]);
    const f = makeFighter(id, g, 'player', s.roster[id]);
    applyGear(f, gear);
    applyTroops(f, t);
    const up = (a: number, b: number) => (b > a ? ` (+${b - a})` : '');
    add(
      text(
        this,
        150,
        112,
        [
          `${g.name}  Lv ${lv}`,
          `체력 ${f.maxHp}${up(base.maxHp, f.maxHp)}`,
          `공격 ${f.atk}${up(base.atk, f.atk)}  · 기병 +${Math.round(t.cav / 20)}%`,
          `방어 ${f.def}${up(base.def, f.def)}  · 보병 +${(t.inf / 25).toFixed(0)}%`,
          `속도 ${f.spd}${up(base.spd, f.spd)}`,
        ].join('\n'),
        13,
      ),
    );

    // troops
    let y = 246;
    const cap = troopCap(lv);
    const free = unassigned(s);
    const army = armyOf(s);
    add(this.add.rectangle(W / 2, y - 6, W - 16, 118, COLOR.panel).setOrigin(0.5, 0).setStrokeStyle(1, COLOR.panelLine));
    add(text(this, 18, y, `병력  통솔 ${t.inf + t.cav} / ${cap}`, 14, COLOR.gold));
    add(text(this, W - 18, y + 2, `남은 병력 보병 ${free.inf} · 기병 ${free.cav}`, 11, COLOR.dim).setOrigin(1, 0));
    const row = (label: string, value: number, set: (v: number) => void, ry: number) => {
      add(text(this, 18, ry, `${label} ${value}`, 14));
      [-50, -10, 10, 50].forEach((d, i) => btn(166 + i * 46, ry + 9, 42, 28, d > 0 ? `+${d}` : `${d}`, () => set(value + d)));
    };
    row('보병', t.inf, (v) => this.commit(setAssign(s, id, { inf: v, cav: t.cav })), y + 26);
    row('기병', t.cav, (v) => this.commit(setAssign(s, id, { inf: t.inf, cav: v })), y + 58);
    btn(W - 74, y + 96, 120, 26, s.autoArmy === false ? '자동 배분 켜기' : '자동 배분 중', () => this.commit(reassign({ ...s, autoArmy: true })), s.autoArmy === false);
    add(text(this, 18, y + 90, `보유: 보병 ${army.inf} · 기병 ${army.cav}`, 11, COLOR.dim));

    // refining
    y = 380;
    add(this.add.rectangle(W / 2, y - 6, W - 16, 172, COLOR.panel).setOrigin(0.5, 0).setStrokeStyle(1, COLOR.panelLine));
    const weapon = g.skills[0].name;
    add(text(this, 18, y, `무기  ${GRADE_NAMES[gear.grade]} ${weapon} +${gear.edge}`, 14, COLOR.gold));
    add(text(this, 18, y + 76, `갑옷  옻칠 +${gear.lacquer} · 비늘 엮기 +${gear.lacing}`, 14, COLOR.gold));
    const refineBtn = (u: Upgrade, x: number, by: number) => {
      const c = upgradeCost(gear, u);
      const label = 'blocked' in c ? `${UPGRADE_LABEL[u]} (${c.blocked})` : `${UPGRADE_LABEL[u]} · ${ITEMS[c.item].name} ×${c.count}`;
      const ok = !('blocked' in c) && (s.items?.[c.item] ?? 0) >= c.count;
      btn(x, by, 166, 34, label, () => this.commit(refine(s, id, u)), ok);
    };
    refineBtn('edge', 96, y + 42);
    refineBtn('grade', 266, y + 42);
    refineBtn('lacquer', 96, y + 118);
    refineBtn('lacing', 266, y + 118);

    // tools owned
    const owned = ITEM_ORDER.map((k) => `${ITEMS[k].name} ${s.items?.[k] ?? 0}`).join(' · ');
    add(text(this, W / 2, 566, `재련 도구: ${owned}`, 11, COLOR.dim).setOrigin(0.5).setWordWrapWidth(W - 24, true).setAlign('center'));

    btn(W / 2, H - 30, 200, 40, '돌아가기', () => this.scene.start(this.back.key, this.back.data));
  }
}
