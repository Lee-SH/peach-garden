import Phaser from 'phaser';
import {
  battleXp,
  beginTurn,
  breather,
  canUse,
  chooseAction,
  endTurn,
  gainXp,
  getFighter,
  nextActor,
  outcome,
  previewOrder,
  SLOT_NAMES,
  startWave,
  useSkill,
} from '../core/combat';
import { applyBattleResult, loadSave, newCampaign, writeSave, type CampaignSave } from '../core/save';
import type { Battle, CombatEvent, EffectType, Fighter, Skill } from '../core/types';
import { buildParty, buildWave, SCENARIOS, type Scenario } from '../data/scenarios';
import { GENERALS } from '../data/units';
import { button, COLOR, FONT, H, text, W, type Button } from '../ui/theme';
import type { ResultData } from './ResultScene';
import { drawField, FIELD_TOP, PANEL_Y } from '../ui/field';
import { cellSpot } from '../core/formation';

const PREFS_KEY = 'peach-garden.prefs';

const EFFECT_LABEL: Record<EffectType, string> = { atkUp: '공↑', defDown: '방↓', stun: '기절', burn: '화상' };


interface View {
  c: Phaser.GameObjects.Container;
  circle: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  bars: Phaser.GameObjects.Graphics;
  fx: Phaser.GameObjects.Text;
  home: { x: number; y: number };
}

interface Choice {
  skill: Skill;
  targetId?: string;
}

interface SkillButton {
  c: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
}

export class BattleScene extends Phaser.Scene {
  private sc!: Scenario;
  private save!: CampaignSave;
  private b!: Battle;
  private wave = 0;
  private views = new Map<string, View>();
  private auto = true;
  private fast = false;
  private over = false;

  private pending: { actor: Fighter; resolve: (c: Choice) => void } | null = null;
  private selectedSkill: Skill | null = null;
  private fallen: string[] = [];

  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgNear!: Phaser.GameObjects.TileSprite;
  private bgGround!: Phaser.GameObjects.TileSprite;
  private orderLayer!: Phaser.GameObjects.Container;
  private waveText!: Phaser.GameObjects.Text;
  private skillButtons: SkillButton[] = [];
  private actorText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private autoBtn!: Button;
  private speedBtn!: Button;

  constructor() {
    super('Battle');
  }

  create(data: { scenarioId: string }) {
    this.sc = SCENARIOS[data.scenarioId];
    this.save = loadSave() ?? newCampaign();
    this.b = { fighters: buildParty(this.sc, this.save), rng: Math.random };
    this.wave = 0;
    this.views = new Map();
    this.pending = null;
    this.selectedSkill = null;
    this.fallen = [];
    this.skillButtons = [];
    this.over = false;
    const prefs = readPrefs();
    this.auto = prefs.auto;
    this.fast = prefs.fast;

    ({ far: this.bgFar, near: this.bgNear, ground: this.bgGround } = drawField(this));

    this.createHeader();
    this.createPanel();
    this.applySpeed();

    startWave(this.b, buildWave(this.sc, 0));
    for (const f of this.b.fighters) this.createView(f);
    this.layout();
    this.refresh(null);
    void this.run();
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------

  private async run() {
    await this.runIn();
    this.announceWave();
    for (;;) {
      if (!this.scene.isActive()) return;
      const o = outcome(this.b);
      if (o === 'defeat') return this.finish(false);
      if (o === 'victory') {
        this.wave += 1;
        if (this.wave >= this.sc.waves.length) return this.finish(true);
        await this.nextWave();
        continue;
      }

      const actor = nextActor(this.b);
      this.refresh(actor);
      await this.wait(180);

      const { events, skip } = beginTurn(this.b, actor);
      if (events.length) {
        this.showEvents(events);
        this.refresh(actor);
        await this.wait(450);
      }
      if (skip) {
        endTurn(actor);
        continue;
      }

      const choice = actor.side === 'player' && !this.auto ? await this.askPlayer(actor) : await this.aiChoice(actor);
      const ev = useSkill(this.b, actor, choice.skill, choice.targetId);
      await this.animateSkill(actor, choice, ev);
      endTurn(actor);
      this.refresh(null);
    }
  }

  private async aiChoice(actor: Fighter): Promise<Choice> {
    this.refreshPanel(actor);
    await this.wait(actor.side === 'player' ? 300 : 380);
    return chooseAction(this.b, actor);
  }

  private askPlayer(actor: Fighter): Promise<Choice> {
    this.selectedSkill = actor.skills[0];
    return new Promise((resolve) => {
      this.pending = { actor, resolve };
      this.refresh(actor);
    });
  }

  private resolvePending(choice: Choice) {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    this.selectedSkill = null;
    p.resolve(choice);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  private onSkillTap(i: number) {
    const p = this.pending;
    if (!p) return;
    const skill = p.actor.skills[i];
    if (!skill || !canUse(p.actor, skill)) return;
    // Non-targeted skills fire on the second tap
    if (this.selectedSkill === skill && skill.target !== 'enemy') {
      this.resolvePending({ skill });
      return;
    }
    this.selectedSkill = skill;
    this.refresh(p.actor);
  }

  private onFighterTap(f: Fighter) {
    const p = this.pending;
    const s = this.selectedSkill;
    if (!p || !s || f.dead) return;
    if (f.side === 'enemy' && s.target === 'enemy') this.resolvePending({ skill: s, targetId: f.id });
    else if (f.side === 'enemy' && s.target === 'allEnemies') this.resolvePending({ skill: s });
    else if (f.side === 'player' && (s.target === 'allAllies' || s.target === 'self')) this.resolvePending({ skill: s });
  }

  private toggleAuto() {
    this.auto = !this.auto;
    writePrefs({ auto: this.auto, fast: this.fast });
    setButtonLabel(this.autoBtn, this.autoLabel());
    if (this.auto && this.pending) this.resolvePending(chooseAction(this.b, this.pending.actor));
    else this.refresh(this.pending?.actor ?? null);
  }

  private toggleSpeed() {
    this.fast = !this.fast;
    writePrefs({ auto: this.auto, fast: this.fast });
    this.applySpeed();
  }

  private applySpeed() {
    const s = this.fast ? 2 : 1;
    this.time.timeScale = s;
    this.tweens.timeScale = s;
    if (this.speedBtn) setButtonLabel(this.speedBtn, `x${s}`);
  }

  private autoLabel() {
    return this.auto ? '자동 ON' : '자동 OFF';
  }

  // ---------------------------------------------------------------------------
  // Waves: run to the right edge, switch scene, run in
  // ---------------------------------------------------------------------------

  private announceWave() {
    const boss = this.b.fighters.find((f) => f.side === 'enemy' && f.isBoss && !f.dead);
    this.waveText.setText(`${this.sc.title} · 무리 ${this.wave + 1}/${this.sc.waves.length}`);
    this.banner(boss ? `${boss.name} 등장!` : `무리 ${this.wave + 1} / ${this.sc.waves.length}`, boss ? COLOR.red : COLOR.text);
  }

  private async nextWave() {
    this.banner('돌파!', COLOR.gold);
    await this.wait(450);
    // 숨 고르기: heal a little while running to the next group
    const healed = breather(this.b);
    await this.runOut();
    this.cameras.main.fadeOut(220);
    await this.wait(240);
    for (const [id, v] of [...this.views]) {
      const f = getFighter(this.b, id);
      if (f.side === 'enemy' || f.dead) {
        v.c.destroy();
        this.views.delete(id);
      }
    }
    startWave(this.b, buildWave(this.sc, this.wave));
    for (const f of this.b.fighters) if (f.side === 'enemy') this.createView(f);
    this.layout();
    this.refresh(null);
    this.cameras.main.fadeIn(220);
    await this.runIn();
    for (const [id, amount] of Object.entries(healed)) {
      const v = this.views.get(id);
      if (v && amount > 0) this.floatAt(v.c.x, v.c.y - 24, `+${amount}`, '#7cff8a', 14);
    }
    this.announceWave();
  }

  private heroViews() {
    return [...this.views.entries()].filter(([id]) => getFighter(this.b, id).side === 'player').map(([, v]) => v);
  }

  /** Heroes run in from off-screen left to their spots while the background scrolls. */
  private async runIn() {
    const heroes = this.heroViews();
    for (const v of heroes) v.c.setPosition(v.home.x - 200, v.home.y);
    this.scrollBackground(850);
    for (const v of heroes) this.runTween(v, v.home.x, 850);
    await this.wait(900);
  }

  private async runOut() {
    this.scrollBackground(850);
    for (const v of this.heroViews()) this.runTween(v, W + 60, 850);
    await this.wait(900);
  }

  private runTween(v: View, x: number, duration: number) {
    this.tweens.add({ targets: v.c, x, duration, ease: 'Linear' });
    this.tweens.add({ targets: v.c, y: v.home.y - 7, duration: 105, yoyo: true, repeat: Math.max(0, Math.floor(duration / 210) - 1) });
  }

  private scrollBackground(duration: number) {
    const o = { t: 0 };
    const start = [this.bgFar.tilePositionX, this.bgNear.tilePositionX, this.bgGround.tilePositionX];
    this.tweens.add({
      targets: o,
      t: 1,
      duration,
      onUpdate: () => {
        this.bgFar.tilePositionX = start[0] + o.t * 60;
        this.bgNear.tilePositionX = start[1] + o.t * 160;
        this.bgGround.tilePositionX = start[2] + o.t * 300;
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Skill animation & events
  // ---------------------------------------------------------------------------

  private async animateSkill(actor: Fighter, choice: Choice, events: CombatEvent[]) {
    const v = this.views.get(actor.id);
    if (!v) return;
    const s = choice.skill;
    const dir = actor.side === 'player' ? 1 : -1;
    if (s.ultimate) await this.ultimateCutIn(actor, s);
    else this.floatAt(v.c.x, v.c.y - 46, s.name, actor.side === 'player' ? COLOR.blue : '#ffd27a', 13);

    const t = choice.targetId ? this.views.get(choice.targetId) : undefined;
    if (t) {
      const dx = t.c.x - v.c.x - dir * 50;
      const dy = t.c.y - v.c.y;
      await this.tweenAsync({ targets: v.c, x: v.c.x + dx, y: v.c.y + dy, duration: 150, ease: 'Quad.easeIn' });
      this.showEvents(events);
      this.refresh(null);
      await this.tweenAsync({ targets: v.c, x: v.home.x, y: v.home.y, duration: 190, ease: 'Quad.easeOut' });
    } else {
      await this.tweenAsync({ targets: v.c, x: v.home.x + dir * 24, duration: 110, yoyo: true });
      if (s.power > 0) this.cameras.main.shake(140, 0.006);
      this.showEvents(events);
      this.refresh(null);
      await this.wait(220);
    }
    await this.wait(220);
  }

  private async ultimateCutIn(actor: Fighter, s: Skill) {
    const bandColor = actor.side === 'player' ? 0x1e3f7a : 0x7a1e1e;
    const band = this.add.rectangle(W / 2, 250, W, 70, bandColor, 0.92).setDepth(40);
    const t = text(this, -W, 250, `${actor.name} 「${s.name}」`, 24, COLOR.gold).setOrigin(0.5).setDepth(41).setStroke('#000', 4);
    this.cameras.main.flash(150, 255, 240, 200);
    await this.tweenAsync({ targets: t, x: W / 2, duration: 260, ease: 'Back.easeOut' });
    await this.wait(420);
    band.destroy();
    t.destroy();
  }

  private showEvents(events: CombatEvent[]) {
    for (const e of events) {
      const f = getFighter(this.b, e.id);
      const v = this.views.get(e.id);
      if (!v) continue;
      switch (e.type) {
        case 'damage':
          this.floatAt(v.c.x, v.c.y - 20, e.crit ? `치명 ${e.amount}` : `${e.amount}`, e.crit ? '#ffcf3b' : COLOR.red, e.crit ? 20 : 17);
          this.tweens.add({ targets: v.circle, alpha: 0.3, duration: 70, yoyo: true, repeat: 1 });
          break;
        case 'burn':
          this.floatAt(v.c.x, v.c.y - 20, `화상 ${e.amount}`, '#ff8a3b', 15);
          break;
        case 'heal':
          if (e.amount > 0) this.floatAt(v.c.x, v.c.y - 20, `+${e.amount}`, '#7cff8a', 16);
          break;
        case 'effect':
          break; // shown persistently above the token
        case 'stunned':
          this.floatAt(v.c.x, v.c.y - 20, '기절!', '#e0d0ff', 15);
          break;
        case 'death':
          this.tweens.add({ targets: v.c, alpha: 0, y: v.c.y + 10, duration: 450, delay: 150 });
          if (f.side === 'player') {
            this.fallen.push(f.name);
            if (!f.isLord) this.banner(`${f.name} 전사…`, COLOR.red);
          }
          break;
      }
    }
  }

  private finish(victory: boolean) {
    if (this.over) return;
    this.over = true;
    this.pending = null;
    const party = this.b.fighters.filter((f) => f.side === 'player');
    const lines: string[] = [];
    if (victory) {
      for (const f of party) {
        if (f.dead) continue;
        const before = f.level;
        const xp = battleXp(f);
        const levels = gainXp(f, xp);
        lines.push(`${f.name} (${SLOT_NAMES[f.slot]})  경험치 +${xp}${levels.length ? `  Lv ${before} → ${f.level}` : ''}`);
      }
      if (this.fallen.length) lines.push('', `전사: ${this.fallen.join(', ')}`);
    } else {
      lines.push(party.some((f) => f.isLord && f.dead) ? '유비가 쓰러졌다…' : '모든 장수가 쓰러졌다…');
      lines.push('', '진형을 바꿔 다시 도전하자.', '(패배한 전투의 경험치와 전사는 기록되지 않는다)');
    }
    const result: ResultData = { victory, scenarioId: this.sc.id, lines, next: this.sc.next };
    this.time.delayedCall(900, () => {
      if (victory) {
        // Permanent: levels and deaths are written to the campaign save
        writeSave(applyBattleResult(this.save, party, this.sc.next));
        this.scene.start('Story', { lines: this.sc.outro, next: { key: 'Result', data: result } });
      } else {
        this.scene.start('Result', result);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  private createView(f: Fighter) {
    const fill = f.side === 'player' ? COLOR.player : f.isBoss ? COLOR.boss : COLOR.enemy;
    const r = radius(f);
    const ring = this.add.circle(0, 0, r + 6).setStrokeStyle(3, 0xffe08a).setVisible(false);
    const shadow = this.add.ellipse(0, r + 2, r * 2, 8, 0x000000, 0.35);
    const circle = this.add.circle(0, 0, r, fill).setStrokeStyle(2, f.isLord || f.isBoss ? 0xffe08a : 0xffffff);
    const tok = this.add
      .text(0, 0, f.token, { fontFamily: FONT, fontSize: f.isBoss ? '24px' : '19px', color: f.side === 'player' ? '#ffffff' : '#1b1306', fontStyle: 'bold' })
      .setOrigin(0.5);
    const bars = this.add.graphics();
    const fx = text(this, 0, -r - 14, '', 11, '#e0d0ff').setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [shadow, ring, circle, tok, bars, fx];
    const c = this.add.container(0, 0, parts).setDepth(10);
    circle.setInteractive({ useHandCursor: true }).on('pointerup', () => this.onFighterTap(f));
    this.views.set(f.id, { c, circle, ring, bars, fx, home: { x: 0, y: 0 } });
  }

  /** Heroes stand on their formation cell; enemies stagger on the right. */
  private layout() {
    for (const f of this.b.fighters) {
      const v = this.views.get(f.id);
      if (!v || f.side !== 'player') continue;
      v.home = cellSpot({ col: f.slot, row: f.row });
      v.c.setPosition(v.home.x, v.home.y);
    }
    const enemies = this.b.fighters.filter((f) => f.side === 'enemy' && this.views.has(f.id));
    const step = enemies.length > 3 ? 46 : 56;
    enemies.forEach((f, i) => {
      const v = this.views.get(f.id)!;
      v.home = { x: [238, 298][i % 2], y: 290 + (i - (enemies.length - 1) / 2) * step };
      v.c.setPosition(v.home.x, v.home.y);
    });
  }

  private refresh(actor: Fighter | null) {
    for (const f of this.b.fighters) {
      const v = this.views.get(f.id);
      if (!v || f.dead) continue;
      const r = radius(f);
      const w = r * 2 + 6;
      v.bars.clear();
      v.bars.fillStyle(0x000000, 0.6).fillRect(-w / 2, r + 7, w, 6);
      v.bars.fillStyle(f.side === 'player' ? 0x5ee06a : 0xff6b4a, 1).fillRect(-w / 2, r + 7, (w * f.hp) / f.maxHp, 6);
      if (f.side === 'player') {
        v.bars.fillStyle(0x000000, 0.6).fillRect(-w / 2, r + 14, w, 3);
        v.bars.fillStyle(f.morale >= 100 ? 0xffd23b : 0xd9a441, 1).fillRect(-w / 2, r + 14, (w * f.morale) / 100, 3);
      }
      v.fx.setText(f.effects.map((e) => EFFECT_LABEL[e.type]).join(' '));
      v.ring.setVisible(f === actor);
      const s = this.selectedSkill;
      const targetable = !!this.pending && !!s && f.side === 'enemy' && (s.target === 'enemy' || s.target === 'allEnemies');
      v.circle.setStrokeStyle(targetable ? 3 : 2, targetable ? 0xff3b30 : f.isLord || f.isBoss ? 0xffe08a : 0xffffff);
    }
    this.refreshOrder();
    this.refreshPanel(actor);
  }

  private refreshOrder() {
    this.orderLayer.removeAll(true);
    previewOrder(this.b, 8).forEach((f, i) => {
      const x = 58 + i * 36;
      const fill = f.side === 'player' ? COLOR.player : f.isBoss ? COLOR.boss : COLOR.enemy;
      const c = this.add.circle(x, 68, i === 0 ? 15 : 12, fill).setStrokeStyle(i === 0 ? 2 : 1, 0xffffff);
      const t = this.add
        .text(x, 68, f.token, { fontFamily: FONT, fontSize: i === 0 ? '14px' : '12px', color: f.side === 'player' ? '#fff' : '#1b1306', fontStyle: 'bold' })
        .setOrigin(0.5);
      this.orderLayer.add([c, t]);
    });
  }

  private refreshPanel(actor: Fighter | null) {
    const mine = !!this.pending && actor === this.pending.actor;
    if (!actor) {
      this.actorText.setText('');
    } else if (actor.side === 'player') {
      this.actorText.setText(
        `${actor.name}의 차례 · ${SLOT_NAMES[actor.slot]}   Lv ${actor.level}\n체력 ${actor.hp}/${actor.maxHp}   기세 ${actor.morale}%   ${GENERALS[actor.id]?.title ?? ''}`,
      );
    } else {
      this.actorText.setText(`적의 차례 · ${actor.name} (Lv ${actor.level})\n체력 ${actor.hp}/${actor.maxHp}`);
    }

    const skills = actor?.side === 'player' ? actor.skills : [];
    this.skillButtons.forEach((btn, i) => {
      const s = skills[i];
      btn.c.setVisible(!!s);
      if (!s || !actor) return;
      const usable = canUse(actor, s);
      const cd = actor.cooldowns[s.id] ?? 0;
      btn.name.setText(s.name);
      btn.sub.setText(s.ultimate ? `필살 · 기세 ${actor.morale}%` : cd > 0 ? `${cd}턴 후 사용` : s.cooldown ? `쿨타임 ${s.cooldown}` : '기본 공격');
      btn.c.setAlpha(usable ? (mine || this.auto ? 1 : 0.6) : 0.35);
      const selected = mine && this.selectedSkill === s;
      btn.bg.setStrokeStyle(selected ? 3 : 1, selected ? 0xffd23b : s.ultimate && usable ? 0xff9f3b : COLOR.panelLine);
      btn.bg.setFillStyle(s.ultimate && usable ? 0x5a3416 : 0x3a2f24);
    });

    const sel = mine ? this.selectedSkill : null;
    if (sel) {
      const how = sel.target === 'enemy' ? '공격할 적을 탭하세요.' : '스킬을 한 번 더 탭하면 사용합니다.';
      this.descText.setText(`${sel.desc}\n▶ ${how}`);
    } else if (actor?.side === 'player' && this.auto) {
      this.descText.setText('자동 전투 중… (자동 OFF로 직접 스킬을 고를 수 있습니다)');
    } else if (!actor) {
      this.descText.setText(this.sc.objectiveText);
    } else {
      this.descText.setText('');
    }
  }

  // ---------------------------------------------------------------------------
  // Static UI
  // ---------------------------------------------------------------------------

  private createHeader() {
    this.add.rectangle(W / 2, 0, W, FIELD_TOP, COLOR.bg).setOrigin(0.5, 0).setDepth(5);
    this.waveText = text(this, 12, 12, this.sc.title, 14, COLOR.gold).setDepth(6);
    text(this, 12, 68, '순서', 11, COLOR.dim).setOrigin(0, 0.5).setDepth(6);
    this.orderLayer = this.add.container(0, 0).setDepth(6);
    this.autoBtn = button(this, W - 108, 22, 84, 30, this.autoLabel(), () => this.toggleAuto());
    this.speedBtn = button(this, W - 32, 22, 50, 30, 'x1', () => this.toggleSpeed());
    this.autoBtn.container.setDepth(6);
    this.speedBtn.container.setDepth(6);
  }

  private createPanel() {
    const panel = this.add.container(0, 0).setDepth(20);
    const bg = this.add.rectangle(W / 2, PANEL_Y, W, H - PANEL_Y, COLOR.panel).setOrigin(0.5, 0).setStrokeStyle(1, COLOR.panelLine);
    this.actorText = text(this, 14, PANEL_Y + 10, '', 13);
    panel.add([bg, this.actorText]);
    const bw = 108;
    for (let i = 0; i < 3; i++) {
      const x = 14 + bw / 2 + i * (bw + 9);
      const rect = this.add.rectangle(0, 0, bw, 70, 0x3a2f24).setStrokeStyle(1, COLOR.panelLine);
      const name = text(this, 0, -12, '', 15).setOrigin(0.5);
      const sub = text(this, 0, 14, '', 11, COLOR.dim).setOrigin(0.5);
      const c = this.add.container(x, PANEL_Y + 98, [rect, name, sub]).setSize(bw, 70);
      c.setInteractive({ useHandCursor: true }).on('pointerup', () => this.onSkillTap(i));
      panel.add(c);
      this.skillButtons.push({ c, bg: rect, name, sub });
    }
    this.descText = text(this, 14, PANEL_Y + 144, '', 13).setWordWrapWidth(W - 28, true);
    panel.add(this.descText);
  }



  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private floatAt(x: number, y: number, s: string, color: string, size: number) {
    const t = text(this, x, y, s, size, color).setOrigin(0.5).setDepth(30).setStroke('#000', 3);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 900, delay: 150, onComplete: () => t.destroy() });
  }

  private banner(s: string, color: string) {
    const t = text(this, W / 2, 150, s, 22, color).setOrigin(0.5).setDepth(35).setStroke('#000', 4);
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 400, onComplete: () => t.destroy() });
  }

  private wait(ms: number) {
    return new Promise<void>((res) => this.time.delayedCall(ms, res));
  }

  private tweenAsync(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((res) => this.tweens.add({ ...cfg, onComplete: () => res() }));
  }
}

const radius = (f: Fighter) => (f.isBoss ? 27 : 21);

function setButtonLabel(btn: Button, label: string) {
  btn.container.list.forEach((o) => o instanceof Phaser.GameObjects.Text && o.setText(label));
}

function readPrefs(): { auto: boolean; fast: boolean } {
  try {
    return { auto: true, fast: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { auto: true, fast: false };
  }
}

function writePrefs(p: { auto: boolean; fast: boolean }) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // preferences just won't persist
  }
}
