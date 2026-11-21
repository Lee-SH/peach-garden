import Phaser from 'phaser';
import {
  attackShape,
  checkOutcome,
  effectiveDamage,
  getUnit,
  moveUnit,
  planEnemyTurn,
  playerAttack,
  resolveIntent,
  spawnReinforcements,
  startPlayerTurn,
  undoMove,
  waitUnit,
  xpToNext,
} from '../core/battle';
import { DIRS, eq, livingUnits, reachableTiles, unitAt } from '../core/grid';
import { applyBattleResult, loadSave, newCampaign, writeSave, type CampaignSave } from '../core/save';
import type { BattleEvent, BattleState, Outcome, Pos, Unit } from '../core/types';
import { buildBattle, SCENARIOS, type Scenario } from '../data/scenarios';
import { GENERALS, ENEMIES } from '../data/units';
import { button, COLOR, FONT, text, W, type Button } from '../ui/theme';
import type { ResultData } from './ResultScene';

const CELL = 44;
const BOARD_X = (W - CELL * 8) / 2;
const BOARD_Y = 66;
const PANEL_Y = BOARD_Y + CELL * 8 + 8;

const ATTACK_NAME = { melee: '근접', push: '밀치기', pierce: '관통', ranged: '사격' } as const;

export class BattleScene extends Phaser.Scene {
  private sc!: Scenario;
  private save!: CampaignSave;
  private s!: BattleState;

  private selected: Unit | null = null;
  private inspected: Unit | null = null;
  private pendingDir: Pos | null = null;
  private lastMove: { unitId: string; from: Pos } | null = null;
  private busy = false;
  private levelUps: string[] = [];
  private fallen: string[] = [];

  private boardLayer!: Phaser.GameObjects.Container;
  private labels: Phaser.GameObjects.Text[] = [];
  private hud!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private btnUndo!: Button;
  private btnWait!: Button;
  private btnEnd!: Button;

  constructor() {
    super('Battle');
  }

  create(data: { scenarioId: string }) {
    this.sc = SCENARIOS[data.scenarioId];
    this.save = loadSave() ?? newCampaign();
    this.s = buildBattle(this.sc, this.save);
    this.selected = this.inspected = null;
    this.pendingDir = null;
    this.lastMove = null;
    this.busy = false;
    this.levelUps = [];
    this.fallen = [];

    // Enemies declare their first attacks before the player's first turn
    planEnemyTurn(this.s);

    this.hud = text(this, 12, 10, '', 14);
    this.add.rectangle(W / 2, PANEL_Y + 64, W - 8, 128, COLOR.panel).setStrokeStyle(1, COLOR.panelLine);
    this.info = text(this, 16, PANEL_Y + 8, '', 13).setWordWrapWidth(W - 32, true);
    this.boardLayer = this.add.container(0, 0);

    const by = 600;
    this.btnUndo = button(this, 66, by, 112, 44, '되돌리기', () => this.onUndo());
    this.btnWait = button(this, W / 2, by, 100, 44, '대기', () => this.onWait());
    this.btnEnd = button(this, W - 66, by, 112, 44, '턴 종료', () => this.onEndTurn());

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const x = Math.floor((p.x - BOARD_X) / CELL);
      const y = Math.floor((p.y - BOARD_Y) / CELL);
      if (x >= 0 && y >= 0 && x < this.s.width && y < this.s.height) this.onTap({ x, y });
    });

    this.render();
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  private onTap(cell: Pos) {
    if (this.busy) return;
    const sel = this.selected;
    const occ = unitAt(this.s, cell);

    // Tapping a unit inside one of the attack shapes aims that attack (tap again to confirm).
    // Empty tiles are for moving, so a 1-tile step never gets mistaken for an attack.
    const dir = sel && !sel.acted && occ && occ !== sel ? this.attackDirTo(sel, cell) : null;
    if (sel && dir) {
      if (this.pendingDir && eq(this.pendingDir, dir)) {
        this.doAttack(sel, dir);
      } else {
        this.pendingDir = dir;
        this.inspected = sel;
        this.render();
      }
      return;
    }

    if (sel && !sel.moved && !occ && reachableTiles(this.s, sel).some((p) => eq(p, cell))) {
      this.lastMove = { unitId: sel.id, from: { ...sel.pos } };
      moveUnit(this.s, sel, cell);
      this.pendingDir = null;
      this.render();
      return;
    }

    this.pendingDir = null;
    if (occ?.side === 'player') {
      this.selected = occ;
      this.inspected = occ;
    } else {
      this.selected = null;
      this.inspected = occ ?? null;
    }
    this.render();
  }

  /** Direction whose attack would hit `cell`, preferring enemy targets over allies. */
  private attackDirTo(u: Unit, cell: Pos): Pos | null {
    const target = unitAt(this.s, cell);
    if (!target || (target.side === 'player' && u.attack !== 'pierce')) return null;
    return DIRS.find((d) => attackShape(this.s, u, d).hits.some((p) => eq(p, cell))) ?? null;
  }

  private doAttack(unit: Unit, dir: Pos) {
    const events = playerAttack(this.s, unit, dir);
    this.pendingDir = null;
    this.lastMove = null;
    this.playEvents(events);
    this.selectNextReady(unit);
    this.render();
    this.afterAction();
  }

  private onUndo() {
    if (this.busy || !this.lastMove) return;
    const u = getUnit(this.s, this.lastMove.unitId);
    if (u.acted) return;
    undoMove(u, this.lastMove.from);
    this.lastMove = null;
    this.selected = this.inspected = u;
    this.pendingDir = null;
    this.render();
  }

  private onWait() {
    if (this.busy || !this.selected || this.selected.acted) return;
    waitUnit(this.selected);
    this.lastMove = null;
    this.pendingDir = null;
    this.selectNextReady(this.selected);
    this.render();
  }

  private selectNextReady(after?: Unit) {
    const ready = livingUnits(this.s, 'player').filter((u) => !u.acted);
    this.selected = ready.find((u) => u !== after) ?? null;
    this.inspected = this.selected;
  }

  // ---------------------------------------------------------------------------
  // Turn flow
  // ---------------------------------------------------------------------------

  private afterAction() {
    const o = checkOutcome(this.s);
    if (o !== 'ongoing') this.finish(o);
  }

  private async onEndTurn() {
    if (this.busy) return;
    this.busy = true;
    this.selected = this.inspected = null;
    this.pendingDir = null;
    this.lastMove = null;
    this.render();

    for (const intent of [...this.s.intents]) {
      const attacker = getUnit(this.s, intent.unitId);
      if (attacker.dead) continue;
      this.flashUnit(attacker);
      await this.wait(260);
      this.playEvents(resolveIntent(this.s, intent));
      this.render();
      await this.wait(380);
      const o = checkOutcome(this.s);
      if (o !== 'ongoing') return this.finish(o);
    }

    this.s.intents = [];
    this.s.turn += 1;
    const o = checkOutcome(this.s);
    if (o !== 'ongoing') return this.finish(o);

    planEnemyTurn(this.s);
    const spawned = spawnReinforcements(this.s);
    if (spawned.length) this.banner(`황건적 증원 ${spawned.length}명!`, COLOR.red);
    startPlayerTurn(this.s);
    this.selectNextReady();
    this.busy = false;
    this.render();
  }

  private finish(outcome: Outcome) {
    this.busy = true;
    this.render();
    const victory = outcome === 'victory';
    const lines: string[] = [];
    if (this.levelUps.length) lines.push(...this.levelUps);
    if (this.fallen.length) lines.push(`전사: ${this.fallen.join(', ')}`);

    const result: ResultData = {
      victory,
      scenarioId: this.sc.id,
      lines: victory ? (lines.length ? lines : ['모든 장수가 무사하다.']) : ['유비가 쓰러졌다…', '전투를 처음부터 다시 한다.'],
      next: this.sc.next,
    };

    this.time.delayedCall(900, () => {
      if (victory) {
        // Permanent: levels and deaths are written to the campaign save
        writeSave(applyBattleResult(this.save, this.s, this.sc.next));
        this.scene.start('Story', { lines: this.sc.outro, next: { key: 'Result', data: result } });
      } else {
        this.scene.start('Result', result);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  private playEvents(events: BattleEvent[]) {
    for (const e of events) {
      const u = getUnit(this.s, e.unitId);
      if (e.type === 'damage') this.floatText(e.pos, `-${e.amount}`, COLOR.red);
      if (e.type === 'levelUp') {
        this.floatText(u.pos, `Lv ${e.level}!`, COLOR.gold, -18);
        this.levelUps.push(`${u.name} 레벨 ${e.level} 달성`);
      }
      if (e.type === 'death' && u.side === 'player') {
        this.fallen.push(u.name);
        if (!u.isLord) this.banner(`${u.name} 전사…`, COLOR.red);
      }
      if (e.type === 'bump') this.cameras.main.shake(80, 0.004);
    }
  }

  private floatText(p: Pos, s: string, color: string, dy = 0) {
    const t = text(this, cx(p.x), cy(p.y) - 10 + dy, s, 16, color).setOrigin(0.5).setDepth(20).setStroke('#000', 3);
    this.tweens.add({ targets: t, y: t.y - 26, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  private banner(s: string, color: string) {
    const t = text(this, W / 2, BOARD_Y + CELL * 4, s, 22, color).setOrigin(0.5).setDepth(30).setStroke('#000', 4);
    this.tweens.add({ targets: t, alpha: 0, delay: 1100, duration: 500, onComplete: () => t.destroy() });
  }

  private flashUnit(u: Unit) {
    const r = this.add.rectangle(cx(u.pos.x), cy(u.pos.y), CELL, CELL, 0xffffff, 0.5).setDepth(15);
    this.tweens.add({ targets: r, alpha: 0, duration: 260, onComplete: () => r.destroy() });
  }

  private wait(ms: number) {
    return new Promise<void>((res) => this.time.delayedCall(ms, res));
  }

  // ---------------------------------------------------------------------------
  // Rendering (the whole board is rebuilt on every state change — 64 tiles is cheap)
  // ---------------------------------------------------------------------------

  private render() {
    this.boardLayer.removeAll(true);
    const g = this.add.graphics();
    this.boardLayer.add(g);
    this.drawTerrain(g);

    const sel = this.selected;
    if (sel && !this.busy) {
      if (!sel.moved) {
        g.fillStyle(COLOR.move, 0.28);
        for (const p of reachableTiles(this.s, sel)) if (!eq(p, sel.pos)) g.fillRect(tx(p.x), ty(p.y), CELL, CELL);
      }
      if (!sel.acted) {
        g.lineStyle(2, COLOR.danger, 0.9);
        for (const d of DIRS) {
          for (const p of attackShape(this.s, sel, d).hits) {
            const occ = unitAt(this.s, p);
            if (occ && occ.side === 'enemy') g.strokeRect(tx(p.x) + 3, ty(p.y) + 3, CELL - 6, CELL - 6);
          }
        }
      }
      g.lineStyle(3, 0xffffff, 1).strokeRect(tx(sel.pos.x) + 1, ty(sel.pos.y) + 1, CELL - 2, CELL - 2);
    }

    const over = this.add.graphics();
    this.labels = [];
    this.drawIntents(g, over);
    if (sel && this.pendingDir) this.drawPreview(g, sel, this.pendingDir);
    for (const u of livingUnits(this.s)) this.drawUnit(u);
    this.boardLayer.add([over, ...this.labels]);

    this.updateHud();
    this.updateInfo();
    const canAct = !this.busy;
    this.btnEnd.setEnabled(canAct);
    this.btnWait.setEnabled(canAct && !!sel && !sel.acted);
    const lm = this.lastMove;
    this.btnUndo.setEnabled(canAct && !!lm && !getUnit(this.s, lm.unitId).acted);
  }

  private drawTerrain(g: Phaser.GameObjects.Graphics) {
    for (let y = 0; y < this.s.height; y++) {
      for (let x = 0; x < this.s.width; x++) {
        const t = this.s.terrain[y][x];
        g.fillStyle(COLOR.terrain[t], 1).fillRect(tx(x), ty(y), CELL, CELL);
        g.lineStyle(1, 0x000000, 0.25).strokeRect(tx(x), ty(y), CELL, CELL);
        const X = tx(x);
        const Y = ty(y);
        if (t === 'forest') {
          g.fillStyle(0x1d3a1f, 1);
          g.fillTriangle(X + 10, Y + 30, X + 18, Y + 12, X + 26, Y + 30);
          g.fillTriangle(X + 20, Y + 36, X + 28, Y + 18, X + 36, Y + 36);
        } else if (t === 'mountain') {
          g.fillStyle(0x857868, 1).fillTriangle(X + 6, Y + 38, X + 22, Y + 8, X + 38, Y + 38);
          g.fillStyle(0xd8d0c4, 1).fillTriangle(X + 17, Y + 18, X + 22, Y + 8, X + 27, Y + 18);
        } else if (t === 'river') {
          g.lineStyle(2, 0x6fa2cf, 0.7);
          g.lineBetween(X + 6, Y + 16, X + 20, Y + 12);
          g.lineBetween(X + 22, Y + 30, X + 38, Y + 26);
        } else if (t === 'village') {
          g.fillStyle(0x4a3826, 1).fillRect(X + 12, Y + 20, 20, 14);
          g.fillStyle(0xa0522d, 1).fillTriangle(X + 8, Y + 22, X + 22, Y + 10, X + 36, Y + 22);
        }
      }
    }
  }

  /** Danger tiles go under units; arrows and damage numbers go on top so tokens don't hide them. */
  private drawIntents(under: Phaser.GameObjects.Graphics, over: Phaser.GameObjects.Graphics) {
    for (const intent of this.s.intents) {
      const e = getUnit(this.s, intent.unitId);
      if (e.dead) continue;
      const { path, hits } = attackShape(this.s, e, intent.dir);
      under.fillStyle(COLOR.danger, 0.18);
      for (const p of path) under.fillRect(tx(p.x), ty(p.y), CELL, CELL);
      under.fillStyle(COLOR.danger, 0.45);
      for (const p of hits) under.fillRect(tx(p.x), ty(p.y), CELL, CELL);

      // Arrow from the attacker's edge toward the target
      const d = intent.dir;
      const last = path[path.length - 1] ?? e.pos;
      const sx = cx(e.pos.x) + d.x * 17;
      const sy = cy(e.pos.y) - 3 + d.y * 17;
      // stop at the target token's edge so its letter stays readable
      const ex = cx(last.x) - d.x * 27;
      const ey = cy(last.y) - 3 - d.y * 27;
      over.lineStyle(3, COLOR.danger, 1).lineBetween(sx, sy, ex, ey);
      over.fillStyle(COLOR.danger, 1).fillTriangle(
        ex + d.x * 9, ey + d.y * 9,
        ex - d.x * 3 + d.y * 7, ey - d.y * 3 + d.x * 7,
        ex - d.x * 3 - d.y * 7, ey - d.y * 3 - d.x * 7,
      );
      for (const p of hits) {
        const t = unitAt(this.s, p);
        const dmg = t ? effectiveDamage(this.s, t, e.power) : e.power;
        over.fillStyle(0xb00000, 1).fillCircle(tx(p.x) + CELL - 9, ty(p.y) + 9, 8);
        const label = text(this, tx(p.x) + CELL - 9, ty(p.y) + 9, `${dmg}`, 12, '#ffffff').setOrigin(0.5);
        this.labels.push(label);
      }
    }
  }

  private drawPreview(g: Phaser.GameObjects.Graphics, u: Unit, dir: Pos) {
    const { path, hits } = attackShape(this.s, u, dir);
    g.fillStyle(COLOR.preview, 0.25);
    for (const p of path) g.fillRect(tx(p.x), ty(p.y), CELL, CELL);
    g.lineStyle(3, COLOR.preview, 1);
    for (const p of hits) g.strokeRect(tx(p.x) + 2, ty(p.y) + 2, CELL - 4, CELL - 4);
    if (u.attack === 'push') {
      for (const p of hits) {
        if (!unitAt(this.s, p)) continue;
        const from = { x: cx(p.x), y: cy(p.y) };
        g.lineStyle(3, COLOR.preview, 1).lineBetween(from.x, from.y, from.x + dir.x * CELL * 0.8, from.y + dir.y * CELL * 0.8);
      }
    }
  }

  private drawUnit(u: Unit) {
    const x = cx(u.pos.x);
    const y = cy(u.pos.y) - 3;
    const fill = u.side === 'player' ? COLOR.player : u.isBoss ? COLOR.boss : COLOR.enemy;
    const done = u.side === 'player' && u.acted && !this.busy;
    const circle = this.add.circle(x, y, 16, fill, done ? 0.45 : 1).setStrokeStyle(2, u.isBoss || u.isLord ? 0xffe08a : 0xffffff);
    const tok = this.add
      .text(x, y, u.token, { fontFamily: FONT, fontSize: '17px', color: u.side === 'player' ? '#ffffff' : '#1b1306', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setAlpha(done ? 0.6 : 1);
    this.boardLayer.add([circle, tok]);

    // HP pips
    const pipW = Math.min(5, 34 / u.maxHp);
    const startX = x - (pipW * u.maxHp) / 2;
    const pips = this.add.graphics();
    for (let i = 0; i < u.maxHp; i++) {
      pips.fillStyle(i < u.hp ? (u.side === 'player' ? 0x7cff8a : 0xff8a5b) : 0x222222, 1);
      pips.fillRect(startX + i * pipW, y + 19, pipW - 1, 4);
    }
    this.boardLayer.add(pips);
  }

  private updateHud() {
    const players = livingUnits(this.s, 'player').filter((u) => !u.acted).length;
    const status = this.busy ? '적의 차례…' : `행동 가능 ${players}명`;
    this.hud.setText(`${this.sc.title}   ${this.s.turn}턴   ${status}\n${this.sc.objectiveText.split('\n')[0]}`);
  }

  private updateInfo() {
    const u = this.inspected;
    if (!u) {
      this.info.setText(
        `${this.sc.objectiveText}\n\n장수를 탭해 선택 → 파란 칸을 탭해 이동 → 붉은 테두리의 적을 탭하면 공격 미리보기, 한 번 더 탭하면 실행.\n붉게 칠해진 칸은 적이 다음 턴에 공격할 곳이다.`,
      );
      return;
    }
    const tpl = u.side === 'player' ? GENERALS[u.id] : Object.values(ENEMIES).find((t) => t.name === u.name);
    const lines = [
      `${u.name}  Lv ${u.level}   체력 ${u.hp}/${u.maxHp}   공격 ${u.power}   이동 ${u.move}`,
      `[${ATTACK_NAME[u.attack]}] ${tpl?.desc ?? ''}`,
    ];
    if (u.side === 'player') {
      lines.push(`경험치 ${u.xp}/${xpToNext(u.level)}${u.acted ? '   · 행동 완료' : u.moved ? '   · 이동 완료' : ''}`);
      if (this.pendingDir && u === this.selected) {
        const { hits } = attackShape(this.s, u, this.pendingDir);
        const targets = hits.map((p) => unitAt(this.s, p)).filter((t): t is Unit => !!t);
        const desc = targets.length
          ? targets.map((t) => `${t.name} -${effectiveDamage(this.s, t, u.power)}`).join(', ')
          : '대상 없음';
        lines.push(`▶ 공격 미리보기: ${desc}  (같은 칸을 한 번 더 탭하면 실행)`);
      }
    } else {
      const intent = this.s.intents.find((i) => i.unitId === u.id);
      lines.push(intent ? '다음 턴에 붉은 칸을 공격한다.' : '이번 턴에는 공격하지 않는다.');
    }
    this.info.setText(lines.join('\n'));
  }
}

const tx = (x: number) => BOARD_X + x * CELL;
const ty = (y: number) => BOARD_Y + y * CELL;
const cx = (x: number) => tx(x) + CELL / 2;
const cy = (y: number) => ty(y) + CELL / 2;
