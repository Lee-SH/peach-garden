import Phaser from 'phaser';
import { applyGear, applyTroops, CAV_ATK, CAV_SPD, GRADE_NAMES, INF_DEF, INF_HP, MAX_LEVEL, troopCap, undoRefund, upgradeCost, type ItemId, type Troops, type Upgrade } from '../core/army';
import { xpToNext } from '../core/combat';
import { assignedTo, gearOf, refine, setAssign, unassigned, unrefine } from '../core/campaign';
import { loadSave, newCampaign, writeSave, type CampaignSave } from '../core/save';
import { artKey, hasArt, hasPose } from '../data/art';
import { ITEMS, UPGRADE_LABEL } from '../data/items';
import { GENERALS, makeFighter } from '../data/units';
import { icon, type IconKey } from '../ui/icons';
import { button, COLOR, FONT, hd, RES, text, W } from '../ui/theme';

export interface CampData {
  /** where "돌아가기" leads */
  back: { key: string; data?: object };
  select?: string;
}

/** Which tool each refining track uses, and what one step does. */
const TRACK: { u: Upgrade; item: (grade: number) => ItemId; effect: (lv: number) => string }[] = [
  { u: 'edge', item: () => 'whetstone', effect: (lv) => `공격 +${lv * 3}%` },
  { u: 'grade', item: (g) => (g === GRADE_NAMES.length - 2 ? 'manual' : 'steel'), effect: (lv) => `${GRADE_NAMES[lv]} · 공격 +${lv * 8}%` },
  { u: 'lacquer', item: () => 'lacquer', effect: (lv) => `방어 +${lv * 4}%` },
  { u: 'lacing', item: () => 'rawhide', effect: (lv) => `체력 +${lv * 3}%` },
];

/** percent with one decimal while small (+1.5%), whole numbers after that */
const pct = (v: number) => `${v < 10 ? Math.round(v * 10) / 10 : Math.round(v)}%`;

/**
 * 군영: the camp's storehouse (loot nobody has yet), the three generals with what they carry, and the
 * selected general's soldiers and gear. Everything is shown as icons (placeholder circles until art
 * exists), every change is saved at once, and every refining step can be undone for a full refund.
 */
export class CampScene extends Phaser.Scene {
  private save!: CampaignSave;
  private back!: CampData['back'];
  private sel = '';
  /** last tapped icon's description ('' = show the default hint) */
  private info = '';
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('Camp');
  }

  create(data: CampData) {
    hd(this);
    this.save = loadSave() ?? newCampaign();
    this.back = data.back;
    this.info = '';
    const alive = this.alive();
    this.sel = data.select && alive.includes(data.select) ? data.select : alive[0];
    this.layer = this.add.container(0, 0);
    this.render();
  }

  private alive() {
    return Object.keys(GENERALS).filter((id) => this.save.roster[id]?.alive);
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
    const btn = (x: number, y: number, w: number, h: number, label: string, on: () => void, enabled = true, size = 13) => {
      const b = button(this, x, y, w, h, label, on);
      (b.container.list[1] as Phaser.GameObjects.Text).setFontSize(size);
      b.setEnabled(enabled);
      add(b.container);
      return b;
    };
    const ico = (k: IconKey, x: number, y: number, size: number, tip?: string) => {
      const c = add(icon(this, k, x, y, size));
      if (tip) {
        c.setSize(size + 8, size + 8).setInteractive({ useHandCursor: true });
        c.on('pointerup', () => {
          this.info = tip;
          this.render();
        });
      }
      return c;
    };
    const panel = (y: number, h: number) =>
      add(this.add.rectangle(W / 2, y, W - 16, h, COLOR.panel).setOrigin(0.5, 0).setStrokeStyle(1, COLOR.panelLine));

    const s = this.save;
    const items = s.items ?? {};

    add(text(this, 14, 12, '군영', 20, COLOR.gold));
    btn(W - 52, 26, 84, 30, '돌아가기', () => this.scene.start(this.back.key, this.back.data));

    // --- spare soldiers (tools live in the town's 창고) ------------------------------------------
    panel(44, 98);
    add(text(this, 18, 50, '남은 병력', 13, COLOR.gold));
    add(text(this, W - 18, 52, '아직 아무도 거느리지 않은 병사', 11, COLOR.dim).setOrigin(1, 0));
    const free = unassigned(s);
    const spare: { k: IconKey; n: number; name: string; tip: string }[] = [
      { k: 'inf', n: free.inf, name: '보병', tip: `보병: 100명당 체력 +${INF_HP * 100}% · 방어 +${INF_DEF * 100}%` },
      { k: 'cav', n: free.cav, name: '기병', tip: `기병: 100명당 공격 +${CAV_ATK * 100}% · 속도 +${CAV_SPD}` },
    ];
    spare.forEach((it, i) => {
      const x = 44 + i * 120;
      const c = ico(it.k, x, 88, 30, it.tip);
      if (!it.n) c.setAlpha(0.3);
      add(text(this, x + 22, 88, `${it.name} ${it.n}`, 14, it.n ? COLOR.text : COLOR.dim).setOrigin(0, 0.5));
    });
    add(text(this, W / 2, 116, this.info || (free.inf + free.cav ? '장수 카드를 고르고 +10 · 채움으로 나눠 주세요.' : '병력은 전투에서 이기면 활약한 만큼 들어와요.'), 11, COLOR.dim).setOrigin(0.5, 0).setWordWrapWidth(W - 28, true).setAlign('center'));

    // --- generals: who carries what --------------------------------------------------------------
    const alive = this.alive();
    const cw = 108;
    alive.forEach((id, i) => {
      const cx = W / 2 + (i - (alive.length - 1) / 2) * (cw + 8);
      const t = assignedTo(s, id);
      const cap = troopCap(s.roster[id].level);
      const card = add(this.add.rectangle(cx, 150, cw, 118, COLOR.panel).setOrigin(0.5, 0));
      card.setStrokeStyle(id === this.sel ? 3 : 1, id === this.sel ? 0xffd23b : COLOR.panelLine);
      card.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.sel = id;
        this.render();
      });
      this.portrait(add, id, cx, 178, 44);
      add(text(this, cx, 202, `${GENERALS[id].name} Lv${s.roster[id].level}`, 12).setOrigin(0.5, 0));
      ico('inf', cx - 38, 228, 16);
      add(text(this, cx - 28, 228, `${t.inf}`, 12).setOrigin(0, 0.5));
      ico('cav', cx + 10, 228, 16);
      add(text(this, cx + 20, 228, `${t.cav}`, 12).setOrigin(0, 0.5));
      // two labelled bars: XP toward the next level, and how full the command is
      const bar = (y: number, label: string, frac: number, color: number) => {
        add(text(this, cx - 48, y, label, 10, COLOR.dim).setOrigin(0, 0.5));
        const bx = cx - 20;
        const bw = 66;
        add(this.add.rectangle(bx, y, bw, 5, 0x000000, 0.5).setOrigin(0, 0.5));
        if (frac > 0) add(this.add.rectangle(bx, y, bw * Math.min(1, frac), 5, color).setOrigin(0, 0.5));
      };
      bar(246, '경험', s.roster[id].xp / xpToNext(s.roster[id].level), 0x7cc4ff);
      bar(259, '통솔', (t.inf + t.cav) / cap, 0xe8c15a);
    });

    // --- selected general: soldiers and gear -----------------------------------------------------
    const id = this.sel;
    const g = GENERALS[id];
    const t = assignedTo(s, id);
    const cap = troopCap(s.roster[id].level);
    const gear = gearOf(s, id);
    panel(276, 346);

    add(text(this, 18, 284, `${g.name}의 병력`, 13, COLOR.gold));
    add(text(this, W - 18, 286, `통솔 ${t.inf + t.cav} / ${cap} (레벨업마다 +30)`, 11, COLOR.dim).setOrigin(1, 0));
    const room = cap - t.inf - t.cav;
    const troopRow = (k: 'inf' | 'cav', y: number) => {
      const n = t[k];
      const pool = free[k];
      const set = (v: number) => this.commit(setAssign(s, id, { ...t, [k]: v } as Troops));
      ico(k, 30, y, 24);
      add(text(this, 48, y - 15, `${k === 'inf' ? '보병' : '기병'} ${n}`, 13));
      const eff = k === 'inf' ? `체력 +${pct(INF_HP * n)} · 방어 +${pct(INF_DEF * n)}` : `공격 +${pct(CAV_ATK * n)} · 속도 +${Math.round((CAV_SPD * n) / 100)}`;
      add(text(this, 48, y + 2, eff, 11, COLOR.dim));
      const can = Math.min(pool, room);
      btn(194, y, 40, 28, '비움', () => set(0), n > 0, 12);
      btn(238, y, 40, 28, '−10', () => set(n - 10), n > 0, 12);
      btn(282, y, 40, 28, '+10', () => set(n + Math.min(10, can)), can > 0, 12);
      btn(326, y, 40, 28, '채움', () => set(n + can), can > 0, 12);
    };
    troopRow('inf', 318);
    troopRow('cav', 354);

    add(text(this, 18, 378, `${g.name}의 장비`, 13, COLOR.gold));
    add(text(this, W - 18, 380, '↶ 되돌리면 도구를 전부 돌려받아요', 11, COLOR.dim).setOrigin(1, 0));
    TRACK.forEach((tr, i) => {
      const y = 412 + i * 40;
      const lv = gear[tr.u];
      const cost = upgradeCost(gear, tr.u);
      const refund = undoRefund(gear, tr.u);
      const tool = 'blocked' in cost ? tr.item(Math.min(gear.grade, GRADE_NAMES.length - 2)) : cost.item;
      ico(tool, 30, y, 24, `${ITEMS[tool].name}(${ITEMS[tool].hanja}): ${ITEMS[tool].desc}`);
      const level = tr.u === 'grade' ? GRADE_NAMES[lv] : `+${lv}/${MAX_LEVEL}`;
      add(text(this, 48, y - 15, `${UPGRADE_LABEL[tr.u]} ${level}`, 13));
      const next =
        'blocked' in cost ? cost.blocked === '최대' ? `최대 · ${tr.effect(lv)}` : `${tr.effect(lv)} · ${cost.blocked}`
        : `${tr.effect(lv)} → 다음 ${ITEMS[cost.item].name} ${cost.count}개 (보유 ${items[cost.item] ?? 0})`;
      add(text(this, 48, y + 2, next, 11, COLOR.dim));
      const ok = !('blocked' in cost) && (items[cost.item] ?? 0) >= cost.count;
      btn(272, y, 36, 30, '↶', () => this.commit(unrefine(s, id, tr.u)), !('blocked' in refund), 15);
      btn(322, y, 56, 30, '강화', () => this.commit(refine(s, id, tr.u)), ok, 13);
    });

    // effective stats
    const base = makeFighter(id, g, 'player', s.roster[id]);
    const f = makeFighter(id, g, 'player', s.roster[id]);
    applyGear(f, gear);
    applyTroops(f, t);
    const d = (a: number, b: number) => (b > a ? `(+${b - a})` : '');
    add(this.add.rectangle(W / 2, 576, W - 40, 1, COLOR.panelLine));
    add(
      text(this, W / 2, 584, `체력 ${f.maxHp}${d(base.maxHp, f.maxHp)} · 공격 ${f.atk}${d(base.atk, f.atk)}\n방어 ${f.def}${d(base.def, f.def)} · 속도 ${f.spd}${d(base.spd, f.spd)}`, 12)
        .setOrigin(0.5, 0)
        .setAlign('center'),
    );
  }

  /** The general's face in a round frame (a lettered token until there is a portrait). */
  private portrait(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T, id: string, x: number, y: number, size: number) {
    add(this.add.circle(x, y, size / 2, COLOR.player).setStrokeStyle(2, 0xf3e9d2, 0.8));
    if (hasArt(this, id) && hasPose(id, 'portrait')) {
      const p = add(this.add.image(x, y + size / 2 - 1, artKey(id, 'portrait')).setOrigin(0.5, 1));
      p.setScale((size * 1.05) / p.height);
    } else {
      add(this.add.text(x, y, GENERALS[id].token, { fontFamily: FONT, fontSize: '20px', color: '#fff', fontStyle: 'bold', resolution: RES }).setOrigin(0.5));
    }
  }
}
