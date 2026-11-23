import Phaser from 'phaser';
import { SLOT_AGGRO, SLOT_DAMAGE, SLOT_NAMES, SLOT_TAKEN, SLOT_XP, xpToNext } from '../core/combat';
import { CELL_X, CELL_Y, cellSpot, GRID_COLS, GRID_ROWS, moveTo, occupant, sameCell, type Cell, type Positions } from '../core/formation';
import { loadSave, newCampaign, writeSave, type CampaignSave } from '../core/save';
import { aliveParty, partyPositions, SCENARIOS, type Scenario } from '../data/scenarios';
import { GENERALS, makeFighter } from '../data/units';
import { addSprite, hasArt, SPRITE_H } from '../data/art';
import { readPrefs } from '../ui/prefs';
import { hasRig, Rig } from '../ui/rig';
import { drawField, FIELD_TOP, PANEL_Y } from '../ui/field';
import { button, COLOR, FONT, H, hd, RES, text, W } from '../ui/theme';

const CELL_W = 50;
const CELL_H = 58;
const R = 21;
/** how close (px) a drop must be to a cell centre to land on it */
const SNAP = 44;

interface Token {
  c: Phaser.GameObjects.Container;
  /** selection marker: the token's outline, or a ground ellipse under a sprite */
  mark: Phaser.GameObjects.Shape;
  tag: Phaser.GameObjects.Text;
}

/**
 * Pre-battle formation on the battlefield itself: only the party stands on a 3×3 grid.
 * Drag a general onto an empty cell to move, or onto another general to swap.
 * The column is the role (선봉 / 중군 / 후군); the row is just where they stand.
 */
export class FormationScene extends Phaser.Scene {
  private sc!: Scenario;
  private save!: CampaignSave;
  private pos: Positions = {};
  private ids: string[] = [];
  private tokens = new Map<string, Token>();
  private cells: { cell: Cell; rect: Phaser.GameObjects.Rectangle }[] = [];
  private selected = '';
  private info!: Phaser.GameObjects.Text;

  constructor() {
    super('Formation');
  }

  create(data: { scenarioId: string }) {
    hd(this);
    this.sc = SCENARIOS[data.scenarioId];
    this.save = loadSave() ?? newCampaign();
    this.ids = aliveParty(this.sc, this.save);
    this.pos = partyPositions(this.sc, this.save);
    this.tokens = new Map();
    this.cells = [];
    this.selected = Object.keys(this.pos).sort((a, b) => this.pos[a].col - this.pos[b].col)[0] ?? '';

    drawField(this);
    this.add.rectangle(W / 2, 0, W, FIELD_TOP, COLOR.bg).setOrigin(0.5, 0);
    text(this, 12, 12, `출진 준비 · ${this.sc.title}`, 16, COLOR.gold);
    text(this, 12, 40, '장수를 끌어서 칸에 놓으세요.\n다른 장수 위에 놓으면 서로 자리가 바뀝니다.', 12, COLOR.dim);

    this.drawGrid();
    this.drawEnemySide();
    for (const id of this.ids) this.createToken(id);
    this.setupDrag();

    this.add.rectangle(W / 2, PANEL_Y, W, H - PANEL_Y, COLOR.panel).setOrigin(0.5, 0).setStrokeStyle(1, COLOR.panelLine);
    this.info = text(this, 14, PANEL_Y + 10, '', 12).setWordWrapWidth(W - 28, true);
    const fallen = this.sc.party.filter((id) => !this.ids.includes(id)).map((id) => GENERALS[id].name);
    if (fallen.length) text(this, W - 12, 12, `전사: ${fallen.join(', ')}`, 12, COLOR.red).setOrigin(1, 0);

    button(this, W / 2, H - 30, 200, 42, '출진!', () => this.depart());
    this.refresh();
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  private drawGrid() {
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS; row++) {
        const cell = { col, row };
        const { x, y } = cellSpot(cell);
        const rect = this.add
          .rectangle(x, y + 4, CELL_W - 4, CELL_H - 6, col === 0 ? 0x8a3b22 : 0x000000, col === 0 ? 0.28 : 0.18)
          .setStrokeStyle(1, 0xf3e9d2, 0.35);
        this.cells.push({ cell, rect });
      }
      const label = text(this, CELL_X[col], CELL_Y[GRID_ROWS - 1] + 42, SLOT_NAMES[col], 12, col === 0 ? COLOR.gold : COLOR.text);
      label.setOrigin(0.5).setStroke('#000000', 3);
    }
  }

  private drawEnemySide() {
    const g = this.add.graphics();
    g.lineStyle(1, 0xff6b5b, 0.45);
    for (const [x, y] of [[238, 262], [298, 294], [238, 326]]) g.strokeCircle(x, y, R);
    text(this, 268, 372, '적 출현 위치', 11, COLOR.red).setOrigin(0.5).setStroke('#000000', 3);
  }

  private createToken(id: string) {
    const g = GENERALS[id];
    const { x, y } = cellSpot(this.pos[id]);
    const shadow = this.add.ellipse(0, R + 2, R * 2, 8, 0x000000, 0.35);
    const tag = text(this, 0, R + 12, '', 10).setOrigin(0.5).setStroke('#000000', 3);
    let parts: Phaser.GameObjects.GameObject[];
    let mark: Token['mark'];
    let hit: Phaser.Geom.Rectangle;
    if (readPrefs().rig && hasRig(this, id)) {
      // same cutout figure as in battle (idle breathing)
      mark = this.add.ellipse(0, R + 2, R * 2, 11).setStrokeStyle(2, 0xffffff, 0);
      const rig = new Rig(this, id, SPRITE_H * 1.12);
      rig.root.setPosition(0, R + 4);
      parts = [mark, shadow, rig.root, tag];
      hit = new Phaser.Geom.Rectangle(-24, R + 4 - SPRITE_H, 48, SPRITE_H + 4);
    } else if (hasArt(this, id)) {
      mark = this.add.ellipse(0, R + 2, R * 2 + 18, 14).setStrokeStyle(2, 0xffffff, 0);
      parts = [mark, shadow, addSprite(this, id, 0, R + 4), tag];
      hit = new Phaser.Geom.Rectangle(-24, R + 4 - SPRITE_H, 48, SPRITE_H + 4);
    } else {
      mark = this.add.circle(0, 0, R, COLOR.player).setStrokeStyle(2, g.isLord ? 0xffe08a : 0xffffff);
      const tok = this.add.text(0, 0, g.token, { fontFamily: FONT, fontSize: '19px', color: '#fff', fontStyle: 'bold', resolution: RES }).setOrigin(0.5);
      parts = [shadow, mark, tok, tag];
      hit = new Phaser.Geom.Rectangle(-R - 4, -R - 4, R * 2 + 8, R * 2 + 8);
    }
    const c = this.add.container(x, y, parts).setDepth(10 + y / 1000);
    c.setInteractive({ hitArea: hit, hitAreaCallback: Phaser.Geom.Rectangle.Contains, draggable: true, useHandCursor: true });
    c.setData('id', id);
    c.on('pointerdown', () => {
      this.selected = id;
      this.refresh();
    });
    this.tokens.set(id, { c, mark, tag });
  }

  // ---------------------------------------------------------------------------
  // Drag & drop
  // ---------------------------------------------------------------------------

  private setupDrag() {
    this.input.dragDistanceThreshold = 4;
    this.input.on('dragstart', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      obj.setDepth(20).setScale(1.15);
    });
    this.input.on('drag', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, x: number, y: number) => {
      obj.setPosition(Phaser.Math.Clamp(x, 0, W), Phaser.Math.Clamp(y, FIELD_TOP, PANEL_Y));
      this.highlight(this.cellNear(obj.x, obj.y), obj.getData('id'));
    });
    this.input.on('dragend', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      const id: string = obj.getData('id');
      const cell = this.cellNear(obj.x, obj.y);
      obj.setScale(1);
      this.highlight(null, id);
      if (cell) this.pos = moveTo(this.pos, id, cell);
      this.selected = id;
      this.placeTokens();
      this.refresh();
    });
  }

  private cellNear(x: number, y: number): Cell | null {
    let best: Cell | null = null;
    let bestD = SNAP;
    for (const { cell } of this.cells) {
      const s = cellSpot(cell);
      const d = Phaser.Math.Distance.Between(x, y, s.x, s.y);
      if (d < bestD) {
        bestD = d;
        best = cell;
      }
    }
    return best;
  }

  /** Outline the drop cell; fade the general who would be swapped. */
  private highlight(target: Cell | null, dragging: string) {
    for (const { cell, rect } of this.cells) {
      const on = !!target && sameCell(cell, target);
      rect.setStrokeStyle(on ? 3 : 1, on ? 0xffd23b : 0xf3e9d2, on ? 1 : 0.35);
    }
    const other = target ? occupant(this.pos, target) : undefined;
    for (const [id, t] of this.tokens) t.c.setAlpha(id !== dragging && id === other ? 0.55 : 1);
  }

  private placeTokens() {
    for (const [id, t] of this.tokens) {
      const { x, y } = cellSpot(this.pos[id]);
      t.c.setDepth(10 + y / 1000);
      this.tweens.add({ targets: t.c, x, y, duration: 160, ease: 'Quad.easeOut' });
    }
  }

  // ---------------------------------------------------------------------------
  // Info
  // ---------------------------------------------------------------------------

  /** Chance that an enemy's single-target attack picks each general (weights normalised over the party). */
  private targetChances(): Record<string, number> {
    const w = this.ids.map((id) => SLOT_AGGRO[this.pos[id].col]);
    const total = w.reduce((a, c) => a + c, 0);
    return Object.fromEntries(this.ids.map((id, i) => [id, w[i] / total]));
  }

  private refresh() {
    const chance = this.targetChances();
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    for (const [id, t] of this.tokens) {
      t.tag.setText(`표적 ${pct(chance[id])}`);
      const sel = id === this.selected;
      if (t.mark instanceof Phaser.GameObjects.Ellipse) t.mark.setStrokeStyle(3, 0xffd23b, sel ? 1 : 0);
      else t.mark.setStrokeStyle(sel ? 3 : 2, sel ? 0xffd23b : GENERALS[id].isLord ? 0xffe08a : 0xffffff);
    }

    const id = this.selected;
    if (!id) return;
    const g = GENERALS[id];
    const col = this.pos[id].col;
    const prog = this.save.roster[id] ?? { level: 1, xp: 0, alive: true };
    const f = makeFighter(id, g, 'player', prog);
    const skills = g.skills.map((s, i) => `${i + 1}. ${s.name}${s.ultimate ? ' (필살)' : s.cooldown ? ` (쿨 ${s.cooldown})` : ''} — ${s.desc}`);
    this.info.setText(
      [
        `${g.name}  Lv ${prog.level}  (경험치 ${prog.xp}/${xpToNext(prog.level)})  · ${g.title}`,
        `체력 ${f.maxHp}   공격 ${f.atk}   방어 ${f.def}   속도 ${f.spd}`,
        `[${SLOT_NAMES[col]}] 주는 피해 ${pct(SLOT_DAMAGE[col])} · 받는 피해 ${pct(SLOT_TAKEN[col])} · 경험치 ×${SLOT_XP[col]}`,
        `적의 단일 공격이 노릴 확률 ${pct(chance[id])}`,
        ...skills,
      ].join('\n'),
    );
  }

  private depart() {
    writeSave({ ...this.save, positions: this.pos });
    this.scene.start('Battle', { scenarioId: this.sc.id });
  }
}
