import Phaser from 'phaser';
import { SLOT_AGGRO, SLOT_DAMAGE, SLOT_NAMES, SLOT_XP, xpToNext } from '../core/combat';
import { loadSave, newCampaign, writeSave, type CampaignSave } from '../core/save';
import { DEFAULT_FORMATION, SCENARIOS, type Scenario } from '../data/scenarios';
import { GENERALS, makeFighter } from '../data/units';
import { button, COLOR, FONT, text, W } from '../ui/theme';

/** Slot boxes, drawn left → right as 후군, 중군, 선봉 (enemies are to the right). */
const SLOT_X = [276, 180, 84]; // index = slot (0 = 선봉)
const SLOT_Y = 200;

export class FormationScene extends Phaser.Scene {
  private sc!: Scenario;
  private save!: CampaignSave;
  private formation: string[] = [];
  /** slot picked up for swapping (null = none) */
  private selected: number | null = null;
  /** slot whose details are shown */
  private infoSlot = 0;
  private layer!: Phaser.GameObjects.Container;
  private info!: Phaser.GameObjects.Text;

  constructor() {
    super('Formation');
  }

  create(data: { scenarioId: string }) {
    this.sc = SCENARIOS[data.scenarioId];
    this.save = loadSave() ?? newCampaign();
    const alive = this.sc.party.filter((id) => this.save.roster[id]?.alive !== false);
    const saved = this.save.formation ?? DEFAULT_FORMATION;
    this.formation = [...saved.filter((id) => alive.includes(id)), ...alive.filter((id) => !saved.includes(id))];
    this.selected = null;
    this.infoSlot = 0;

    text(this, W / 2, 26, `출진 준비 · ${this.sc.title}`, 18, COLOR.gold).setOrigin(0.5);
    text(this, W / 2, 54, '장수를 탭해 고른 뒤, 다른 자리를 탭하면 서로 바뀝니다.', 12, COLOR.dim).setOrigin(0.5);
    text(this, W - 14, 96, '적 ▶', 13, COLOR.red).setOrigin(1, 0.5);

    this.layer = this.add.container(0, 0);
    this.info = text(this, 16, 300, '', 13).setWordWrapWidth(W - 32, true);
    this.add.rectangle(W / 2, 292, W - 16, 278, COLOR.panel).setOrigin(0.5, 0).setStrokeStyle(1, COLOR.panelLine).setDepth(-1);

    const fallen = this.sc.party.filter((id) => this.save.roster[id]?.alive === false).map((id) => GENERALS[id].name);
    if (fallen.length) text(this, W / 2, 580, `전사: ${fallen.join(', ')}`, 12, COLOR.red).setOrigin(0.5);

    button(this, W / 2, 610, 200, 44, '출진!', () => this.depart());
    this.render();
  }

  /** Tap = pick up a general; tap another slot = swap; tap the same slot = put down. */
  private onSlotTap(slot: number) {
    if (slot >= this.formation.length) return;
    if (this.selected === null) {
      this.selected = slot;
    } else if (this.selected === slot) {
      this.selected = null;
    } else {
      const f = this.formation;
      [f[this.selected], f[slot]] = [f[slot], f[this.selected]];
      this.selected = null;
    }
    this.infoSlot = slot;
    this.render();
  }

  private render() {
    this.layer.removeAll(true);
    for (let slot = 0; slot < 3; slot++) {
      const x = SLOT_X[slot];
      const id = this.formation[slot];
      const isSel = slot === this.selected && !!id;
      const isInfo = slot === this.infoSlot && !isSel;
      const box = this.add
        .rectangle(x, SLOT_Y, 88, 150, slot === 0 ? 0x3d2a1c : 0x2a231b)
        .setStrokeStyle(isSel ? 3 : isInfo ? 2 : 1, isSel ? 0xffd23b : isInfo ? 0x8a7350 : COLOR.panelLine);
      box.setInteractive({ useHandCursor: true }).on('pointerup', () => this.onSlotTap(slot));
      const label = text(this, x, SLOT_Y - 62, SLOT_NAMES[slot], 15, slot === 0 ? COLOR.gold : COLOR.text).setOrigin(0.5);
      const items: Phaser.GameObjects.GameObject[] = [box, label];
      if (id) {
        const g = GENERALS[id];
        const lv = this.save.roster[id]?.level ?? 1;
        const circle = this.add.circle(x, SLOT_Y - 8, 26, COLOR.player).setStrokeStyle(2, g.isLord ? 0xffe08a : 0xffffff);
        const tok = this.add.text(x, SLOT_Y - 8, g.token, { fontFamily: FONT, fontSize: '22px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        const name = text(this, x, SLOT_Y + 34, `${g.name}`, 14).setOrigin(0.5);
        const lvT = text(this, x, SLOT_Y + 54, `Lv ${lv}`, 12, COLOR.dim).setOrigin(0.5);
        items.push(circle, tok, name, lvT);
      } else {
        items.push(text(this, x, SLOT_Y, '(비어 있음)', 12, COLOR.dim).setOrigin(0.5));
      }
      this.layer.add(items);
    }
    this.renderInfo();
  }

  private renderInfo() {
    const slot = this.infoSlot;
    const id = this.formation[slot];
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    const slotLine =
      `[${SLOT_NAMES[slot]}] 공격력 ${pct(SLOT_DAMAGE[slot])} · 적의 단일 공격 대상 가중치 ${pct(SLOT_AGGRO[slot])} · 경험치 ×${SLOT_XP[slot]}`;
    if (!id) {
      this.info.setText(slotLine);
      return;
    }
    const g = GENERALS[id];
    const prog = this.save.roster[id] ?? { level: 1, xp: 0, alive: true };
    const f = makeFighter(id, g, 'player', prog);
    const skills = g.skills.map((s, i) => `${i + 1}. ${s.name}${s.ultimate ? ' (필살)' : s.cooldown ? ` (쿨 ${s.cooldown})` : ''} — ${s.desc}`);
    this.info.setText(
      [
        `${g.name}  Lv ${prog.level}  (경험치 ${prog.xp}/${xpToNext(prog.level)})`,
        g.title,
        `체력 ${f.maxHp}   공격 ${f.atk}   방어 ${f.def}   속도 ${f.spd}`,
        '',
        slotLine,
        '',
        ...skills,
      ].join('\n'),
    );
  }

  private depart() {
    writeSave({ ...this.save, formation: this.formation });
    this.scene.start('Battle', { scenarioId: this.sc.id });
  }
}
