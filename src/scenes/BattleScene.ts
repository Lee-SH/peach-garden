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
  SLOT_NAMES,
  startWave,
  useSkill,
} from '../core/combat';
import { applyBattleResult, loadSave, newCampaign, writeSave, type CampaignSave } from '../core/save';
import { grantLootDetail } from '../core/campaign';
import type { Battle, CombatEvent, EffectType, Fighter, Skill } from '../core/types';
import { buildParty, buildWave, scenarioLoot, SCENARIO_ORDER, SCENARIOS, stageOf, type Scenario } from '../data/scenarios';
import { GENERALS } from '../data/units';
import { button, type Button, COLOR, FONT, H, hd, RES, setButtonLabel, text, W } from '../ui/theme';
import type { ResultData } from './ResultScene';
import { drawField, FIELD_TOP, PANEL_Y, preloadField } from '../ui/field';
import { cellSpot } from '../core/formation';
import { isDev, readPrefs, SPEEDS, writePrefs } from '../ui/prefs';
import { hasRig, Rig } from '../ui/rig';
import { addSprite, artKey, ATTACK_POSES, CHAR_SCALE, hasArt, hasPose, playRun, setPose, SPRITE_H, type Pose } from '../data/art';
import { enemyHeight, pickEnemyArt } from '../data/enemyArt';
import { briefingLine } from '../data/briefing';
import { isShout, playFx, SKILL_FX } from '../ui/fx';
import { icon } from '../ui/icons';




interface View {
  c: Phaser.GameObjects.Container;
  /** what flashes when hit and receives taps: the sprite, or the round token */
  body: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc | Phaser.GameObjects.Container;
  /** cutout rig (generals with rig parts, when the rig option is on) */
  rig?: Rig;
  /** dust puffs while a rig runs */
  dust?: Phaser.Time.TimerEvent;
  /** soldiers left (generals with troops) */
  troopText?: Phaser.GameObjects.Text;
  /** frame art (generals without a rig, enemies with a drawn look) */
  sprite?: Phaser.GameObjects.Sprite;
  /** which art folder the sprite uses (enemy looks vary per fighter) */
  artId?: string;
  /** running effects while the run cycle plays */
  running?: boolean;
  ring: Phaser.GameObjects.Shape;
  bars: Phaser.GameObjects.Graphics;
  /** status icons above the head (rebuilt when the effects change) */
  fx: Phaser.GameObjects.Container;
  fxSig?: string;
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
  private speed = 1;
  private useRig = true;
  private over = false;

  private pending: { actor: Fighter; resolve: (c: Choice) => void } | null = null;
  private selectedSkill: Skill | null = null;
  private fallen: string[] = [];

  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgNear!: Phaser.GameObjects.TileSprite | null;
  private bgGround!: Phaser.GameObjects.TileSprite;
  private waveText!: Phaser.GameObjects.Text;
  private skillButtons: SkillButton[] = [];
  private actorText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private autoBtn!: Button;
  private speedBtn!: Button;

  constructor() {
    super('Battle');
  }

  preload() {
    // this battle's background pictures, if drawn (loaded on demand, not at startup)
    preloadField(this, (this.sys.settings.data as { scenarioId: string }).scenarioId);
  }

  create(data: { scenarioId: string }) {
    hd(this);
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
    this.speed = prefs.speed;
    this.useRig = prefs.rig;

    ({ far: this.bgFar, near: this.bgNear, ground: this.bgGround } = drawField(this, this.sc.id));

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
    if (!(await this.briefing())) return;
    for (;;) {
      if (!this.scene.isActive()) return;
      const o = outcome(this.b);
      if (o === 'defeat') return this.finish(false);
      if (o === 'victory') {
        this.wave += 1;
        if (this.wave >= this.sc.waves.length) return this.finish(true);
        await this.nextWave();
        // on auto the whole battle plays through; manual play pauses before every group
        if (!this.auto && !(await this.briefing())) return;
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
    writePrefs({ auto: this.auto, speed: this.speed });
    setButtonLabel(this.autoBtn, this.autoLabel());
    if (this.auto && this.pending) this.resolvePending(chooseAction(this.b, this.pending.actor));
    else this.refresh(this.pending?.actor ?? null);
  }

  private toggleSpeed() {
    // x1 → x2 → x3 → x1
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
    writePrefs({ auto: this.auto, speed: this.speed });
    this.applySpeed();
  }

  private applySpeed() {
    const s = this.speed;
    this.time.timeScale = s;
    this.tweens.timeScale = s;
    for (const v of this.views?.values() ?? []) v.rig?.setSpeed(s);
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

  /**
   * Pause before each group: Liu Bei says a line, the player taps "전투 시작" (→ true) or leaves
   * for the title (→ false; like a defeat, the battle isn't recorded).
   */
  private briefing(): Promise<boolean> {
    const boss = this.b.fighters.find((f) => f.side === 'enemy' && f.isBoss && !f.dead);
    const enemies = this.b.fighters.filter((f) => f.side === 'enemy' && !f.dead).length;
    const total = this.sc.waves.length;
    const line = briefingLine(this.wave, total, boss?.name, this.sc.waves[this.wave].line);
    const D = 30;
    const items: Phaser.GameObjects.GameObject[] = [];
    items.push(this.add.rectangle(W / 2, PANEL_Y, W, H - PANEL_Y, COLOR.panel).setOrigin(0.5, 0).setStrokeStyle(1, COLOR.panelLine).setDepth(D));
    const textX = hasPose('liubei', 'portrait') && this.textures.exists(artKey('liubei', 'portrait')) ? 128 : 16;
    if (textX > 16) {
      const p = this.add.image(10, H - 64, artKey('liubei', 'portrait')).setOrigin(0, 1).setDepth(D);
      p.setScale(140 / p.height);
      items.push(p);
    }
    items.push(text(this, textX, PANEL_Y + 14, '유비', 16, COLOR.gold).setDepth(D));
    items.push(text(this, textX, PANEL_Y + 40, line, 15).setWordWrapWidth(W - textX - 14, true).setDepth(D));
    items.push(
      text(this, textX, PANEL_Y + 128, `무리 ${this.wave + 1} / ${total} · 적 ${enemies}명${boss ? ` · 적장 ${boss.name}` : ''}`, 12, COLOR.dim).setDepth(D),
    );
    return new Promise((resolve) => {
      const done = (go: boolean) => {
        for (const o of items) o.destroy();
        resolve(go);
      };
      const start = button(this, W - 108, H - 32, 190, 44, '전투 시작 ▶', () => done(true));
      const quit = button(this, 62, H - 32, 104, 40, '타이틀로', () => {
        done(false);
        this.scene.start('Title');
      });
      start.container.setDepth(D + 1);
      quit.container.setDepth(D + 1);
      items.push(start.container, quit.container);
    });
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
    for (const v of heroes) this.stopRunFor(v);
  }

  private async runOut() {
    this.scrollBackground(850);
    for (const v of this.heroViews()) this.runTween(v, W + 60, 850);
    await this.wait(900);
    for (const v of this.heroViews()) this.stopRunFor(v);
  }

  private runTween(v: View, x: number, duration: number) {
    this.tweens.add({ targets: v.c, x, duration, ease: 'Linear' });
    const id = this.idOf(v);
    if ((v.sprite || v.rig) && id) this.startRun(v, id);
    else this.tweens.add({ targets: v.c, y: v.home.y - 7, duration: 105, yoyo: true, repeat: Math.max(0, Math.floor(duration / 210) - 1) });
  }

  private stopRunFor(v: View) {
    const id = this.idOf(v);
    this.stopRun(v);
    if (id) this.setPose(v, id, 'idle');
  }

  private idOf(v: View) {
    for (const [id, w] of this.views) if (w === v) return id;
    return undefined;
  }

  private scrollBackground(duration: number) {
    const o = { t: 0 };
    const start = [this.bgFar.tilePositionX, this.bgNear?.tilePositionX ?? 0, this.bgGround.tilePositionX];
    this.tweens.add({
      targets: o,
      t: 1,
      duration,
      onUpdate: () => {
        this.bgFar.tilePositionX = start[0] + o.t * 60;
        if (this.bgNear) this.bgNear.tilePositionX = start[1] + o.t * 160;
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
    // enemies: officers show their special image for their big skills; soldiers just attack
    const pose = actor.side === 'enemy' ? (s.cooldown > 0 ? 'special' : 'attack') : this.skillPose(s);
    // Ultimates and support skills raise the sword before anything else
    if (s.ultimate || s.power === 0) this.setPose(v, actor.id, 'ult');
    const animated = !!(v.sprite || v.rig);
    if (s.ultimate) await this.ultimateCutIn(actor, s);
    else this.floatAt(v.c.x, v.c.y - 46, s.name, actor.side === 'player' ? COLOR.blue : '#ffd27a', 13);

    const t = choice.targetId ? this.views.get(choice.targetId) : undefined;
    if (t && animated) {
      // Run up to the target, strike, run back
      const dx = t.c.x - v.c.x - dir * 54;
      const dy = t.c.y - v.c.y;
      this.startRun(v, actor.id);
      await this.tweenAsync({ targets: v.c, x: v.c.x + dx, y: v.c.y + dy, duration: 480, ease: 'Linear' });
      this.stopRun(v);
      if (v.rig) await v.rig.attack(pose);
      else {
        this.setPose(v, actor.id, pose);
        await this.tweenAsync({ targets: v.c, x: v.c.x + dir * 10, duration: 70, ease: 'Quad.easeOut' });
      }
      this.showEvents(events);
      this.refresh(null);
      await this.wait(260);
      this.startRun(v, actor.id, true);
      await this.tweenAsync({ targets: v.c, x: v.home.x, y: v.home.y, duration: 440, ease: 'Linear' });
      this.stopRun(v);
    } else if (t) {
      const dx = t.c.x - v.c.x - dir * 50;
      const dy = t.c.y - v.c.y;
      await this.tweenAsync({ targets: v.c, x: v.c.x + dx, y: v.c.y + dy, duration: 150, ease: 'Quad.easeIn' });
      this.showEvents(events);
      this.refresh(null);
      await this.tweenAsync({ targets: v.c, x: v.home.x, y: v.home.y, duration: 190, ease: 'Quad.easeOut' });
    } else if (s.power > 0) {
      // Area attack from where the fighter stands: a pose, then an effect that travels to the targets
      const kind = SKILL_FX[s.id] ?? 'slashes';
      if (isShout(kind)) {
        if (v.rig) await v.rig.roar();
        else this.setPose(v, actor.id, pose);
      } else if (v.rig) await v.rig.attack(pose);
      else {
        this.setPose(v, actor.id, pose);
        await this.tweenAsync({ targets: v.c, x: v.home.x + dir * 16, duration: 110, yoyo: true });
      }
      const hit = [...new Set(events.filter((e) => e.type === 'damage').map((e) => e.id))];
      const targets = hit.map((id) => this.views.get(id)).filter((t): t is View => !!t).map((t) => ({ x: t.c.x, y: t.c.y }));
      const h = actor.side === 'player' ? SPRITE_H : 50;
      const mouth = { x: v.c.x + dir * 10, y: v.c.y + radius(actor) + 4 - h * 0.78 };
      await playFx(this, kind, mouth, targets, dir as 1 | -1);
      this.showEvents(events);
      this.refresh(null);
      await this.wait(kind === 'shout' ? 380 : 220);
    } else {
      await this.tweenAsync({ targets: v.c, x: v.home.x + dir * 24, duration: 110, yoyo: true });
      this.showEvents(events);
      this.refresh(null);
      await this.wait(220);
    }
    this.setPose(v, actor.id, 'idle');
    await this.wait(220);
  }

  /** Basic attacks vary; cooldown strikes and single-target ultimates leap; area attacks spin. */
  private skillPose(s: Skill): Pose {
    if (s.target === 'allEnemies') return 'atk4';
    if (s.cooldown > 0 || s.ultimate) return 'atk3';
    return ATTACK_POSES[Math.floor(Math.random() * 3)];
  }

  private setPose(v: View, _id: string, pose: Pose) {
    if (v.sprite && v.artId) setPose(v.sprite, v.artId, pose);
    if (v.rig) {
      if (pose === 'idle') v.rig.idle();
      else if (pose === 'ult') void v.rig.raise();
      else void v.rig.attack(pose);
    }
  }

  /** Run cycle with dust puffs on each foot contact. `back` = running back to the left (mirrored). */
  private startRun(v: View, id: string, back = false) {
    this.stopRun(v);
    const puff = () => {
      const p = this.add.ellipse(v.c.x + (back ? 8 : -8), v.c.y + 24, 10, 6, 0xd8c8a0, 0.65).setDepth(9);
      this.tweens.add({ targets: p, x: p.x + (back ? 16 : -16), y: p.y - 5, scale: 1.9, alpha: 0, duration: 400, onComplete: () => p.destroy() });
    };
    if (v.rig) {
      v.rig.run(back);
      v.dust = this.time.addEvent({ delay: 192, loop: true, callback: puff });
    } else if (v.sprite) {
      v.sprite.setFlipX(back);
      playRun(v.sprite, v.artId ?? id, puff);
      v.sprite.anims.timeScale = this.speed;
    } else return;
    v.running = true;
  }

  private stopRun(v: View) {
    if (!v.running) return;
    v.running = false;
    v.dust?.remove();
    v.dust = undefined;
    v.rig?.idle();
    v.sprite?.anims.stop();
    v.sprite?.setFlipX(false);
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
          this.tweens.add({ targets: v.body, alpha: 0.3, duration: 70, yoyo: true, repeat: 1 });
          v.rig?.hit();
          this.flinch(v, f);
          break;
        case 'burn':
          this.floatAt(v.c.x, v.c.y - 20, `화상 ${e.amount}`, '#ff8a3b', 15);
          break;
        case 'heal':
          if (e.amount > 0) this.floatAt(v.c.x, v.c.y - 20, `+${e.amount}`, '#7cff8a', 16);
          break;
        case 'effect':
          break; // shown persistently above the token
        case 'troops':
          if (v.troopText) {
            v.troopText.setColor('#ff8a7a');
            this.time.delayedCall(400, () => v.troopText?.setColor('#d8c8a0'));
          }
          break;
        case 'stunned':
          this.floatAt(v.c.x, v.c.y - 20, '기절!', '#e0d0ff', 15);
          break;
        case 'death': {
          const down = !!(v.sprite && v.artId && hasPose(v.artId, 'down'));
          if (down) setPose(v.sprite!, v.artId!, 'down');
          this.tweens.add({ targets: v.c, alpha: 0, y: v.c.y + 10, duration: 450, delay: down ? 450 : 150 });
          if (f.side === 'player') {
            this.fallen.push(f.name);
            if (!f.isLord) this.banner(`${f.name} 전사…`, COLOR.red);
          }
          break;
        }
      }
    }
  }

  /** Show the hurt image briefly (frame art that has one). */
  private flinch(v: View, f: Fighter) {
    const sp = v.sprite;
    const id = v.artId;
    if (!sp || !id || f.dead || !hasPose(id, 'hurt') || v.running) return;
    setPose(sp, id, 'hurt');
    this.time.delayedCall(300, () => {
      if (!f.dead && sp.texture.key === artKey(id, 'hurt')) setPose(sp, id, 'idle');
    });
  }

  private finish(victory: boolean) {
    if (this.over) return;
    this.over = true;
    this.pending = null;
    const party = this.b.fighters.filter((f) => f.side === 'player');
    const lines: string[] = [];
    /** this battle's merit (= the XP earned) decides who gets the new soldiers */
    const merit: Record<string, number> = {};
    if (victory) {
      for (const f of party) {
        if (f.dead) continue;
        const before = f.level;
        const xp = (merit[f.id] = battleXp(f));
        const levels = gainXp(f, xp);
        lines.push(`${f.name} (${SLOT_NAMES[f.slot]})  경험치 +${xp}${levels.length ? `  Lv ${before} → ${f.level}` : ''}`);
      }
      if (this.fallen.length) lines.push('', `전사: ${this.fallen.join(', ')}`);
    } else {
      lines.push(party.some((f) => f.isLord && f.dead) ? '유비가 쓰러졌다…' : '모든 장수가 쓰러졌다…');
      lines.push('', '진형을 바꿔 다시 도전하자.', '(패배한 전투의 경험치와 전사는 기록되지 않는다)');
    }
    const result: ResultData = { victory, scenarioId: this.sc.id, lines, next: this.sc.next };
    // Permanent: levels and deaths are written to the campaign save, then the loot is handed out
    let saved: CampaignSave | null = null;
    if (victory) {
      const loot = scenarioLoot(this.sc);
      const r = grantLootDetail(applyBattleResult(this.save, party, this.sc.next), loot, merit);
      saved = r.save;
      result.loot = {
        ...loot,
        given: r.given,
        merit,
        note: stageOf(this.sc) === 1 ? '중산의 상인 장세평·소쌍이 말과 철을 바쳤다.' : undefined,
      };
    }
    this.time.delayedCall(900, () => {
      if (saved) {
        writeSave(saved);
        this.scene.start('Story', { lines: this.sc.outro, bg: this.sc.id, next: { key: 'Result', data: result } });
      } else {
        this.scene.start('Result', result);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  /** Status icons in a row above the head, each with the turns left. */
  private drawStatus(v: View, f: Fighter) {
    const sig = f.effects.map((e) => `${e.type}${e.turns}`).join(',');
    if (sig === v.fxSig) return;
    v.fxSig = sig;
    v.fx.removeAll(true);
    const size = 19;
    const gap = 3;
    f.effects.forEach((e, i) => {
      const x = (i - (f.effects.length - 1) / 2) * (size + gap);
      v.fx.add(icon(this, e.type as EffectType, x, 0, size));
      if (e.turns > 0)
        v.fx.add(
          this.add
            .text(x + size / 2 - 1, size / 2 - 1, `${e.turns}`, { fontFamily: FONT, fontSize: '10px', color: '#ffffff', fontStyle: 'bold', resolution: RES })
            .setOrigin(0.5)
            .setStroke('#000000', 3),
        );
    });
  }

  private createView(f: Fighter) {
    const fill = f.side === 'player' ? COLOR.player : f.isBoss ? COLOR.boss : COLOR.enemy;
    const r = radius(f);
    const useRig = f.side === 'player' && this.useRig && hasRig(this, f.id);
    const enemyType = f.id.split('-')[2] ?? f.id;
    const stage = SCENARIO_ORDER.indexOf(this.sc.id) + 1;
    const artId =
      useRig ? undefined
      : f.side === 'player' ? (hasArt(this, f.id) ? f.id : undefined)
      : pickEnemyArt(enemyType, stage, (a) => hasArt(this, a), Math.random) ?? undefined;
    const art = !!artId;
    const height = f.side === 'player' ? SPRITE_H : enemyHeight(enemyType, !!f.isBoss);
    let rig: Rig | undefined;
    const bars = this.add.graphics();
    let parts: Phaser.GameObjects.GameObject[];
    let body: View['body'];
    let ring: View['ring'];
    let sprite: Phaser.GameObjects.Sprite | undefined;
    let fx: Phaser.GameObjects.Container;
    // shadow and actor marker under a drawn figure follow the character size
    const sr = Math.round(r * (f.side === 'player' ? CHAR_SCALE : CHAR_SCALE * 1.2));
    if (useRig) {
      ring = this.add.ellipse(0, r + 2, sr * 2 + 14, 11).setStrokeStyle(3, 0xffe08a).setVisible(false);
      const shadow = this.add.ellipse(0, r + 2, sr * 2, 7, 0x000000, 0.35);
      // the rig is slimmer than the frame art, so it stands a little taller to read the same size
      rig = new Rig(this, f.id, SPRITE_H * 1.12);
      rig.root.setPosition(0, r + 4);
      rig.setSpeed(this.speed);
      // tap area in rig units (the rig root is scaled down)
      const k = 1 / rig.root.scaleY;
      rig.root.setInteractive(new Phaser.Geom.Rectangle(-20 * k, -SPRITE_H * k, 40 * k, (SPRITE_H + 4) * k), Phaser.Geom.Rectangle.Contains);
      fx = this.add.container(0, r + 4 - SPRITE_H - 10);
      body = rig.root;
      parts = [ring, shadow, rig.root, bars, fx];
    } else if (art) {
      // Feet on the shadow; the actor marker is a gold ellipse on the ground
      ring = this.add.ellipse(0, r + 2, sr * 2 + 14, 11).setStrokeStyle(3, 0xffe08a).setVisible(false);
      const shadow = this.add.ellipse(0, r + 2, sr * 2, 7, 0x000000, 0.35);
      sprite = addSprite(this, artId!, 0, r + 4, height);
      fx = this.add.container(0, r + 4 - height - 10);
      body = sprite;
      parts = [ring, shadow, sprite, bars, fx];
    } else {
      ring = this.add.circle(0, 0, r + 6).setStrokeStyle(3, 0xffe08a).setVisible(false);
      const shadow = this.add.ellipse(0, r + 2, r * 2, 8, 0x000000, 0.35);
      const circle = this.add.circle(0, 0, r, fill).setStrokeStyle(2, f.isLord || f.isBoss ? 0xffe08a : 0xffffff);
      const tok = this.add
        .text(0, 0, f.token, { fontFamily: FONT, fontSize: f.isBoss ? '24px' : '19px', color: f.side === 'player' ? '#ffffff' : '#1b1306', fontStyle: 'bold', resolution: RES })
        .setOrigin(0.5);
      fx = this.add.container(0, -r - 14);
      body = circle;
      parts = [shadow, ring, circle, tok, bars, fx];
    }
    let troopText: Phaser.GameObjects.Text | undefined;
    if (f.troops && f.troops.inf0 + f.troops.cav0 > 0) {
      troopText = text(this, 0, r + 25, '', 10, '#d8c8a0').setOrigin(0.5, 0).setStroke('#000000', 3);
      parts.push(troopText);
    }
    const c = this.add.container(0, 0, parts).setDepth(10);
    if (!rig) body.setInteractive({ useHandCursor: true });
    body.on('pointerup', () => this.onFighterTap(f));
    this.views.set(f.id, { c, body, sprite, artId, rig, ring, bars, fx, troopText, home: { x: 0, y: 0 } });
  }

  /** Heroes stand on their formation cell; enemies stagger on the right. */
  private layout() {
    for (const f of this.b.fighters) {
      const v = this.views.get(f.id);
      if (!v || f.side !== 'player') continue;
      v.home = cellSpot({ col: f.slot, row: f.row });
      v.c.setPosition(v.home.x, v.home.y).setDepth(10 + v.home.y / 1000);
    }
    const enemies = this.b.fighters.filter((f) => f.side === 'enemy' && this.views.has(f.id));
    const step = enemies.length > 3 ? 46 : 56;
    enemies.forEach((f, i) => {
      const v = this.views.get(f.id)!;
      v.home = { x: [238, 298][i % 2], y: 290 + (i - (enemies.length - 1) / 2) * step };
      v.c.setPosition(v.home.x, v.home.y).setDepth(10 + v.home.y / 1000);
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
      this.drawStatus(v, f);
      if (v.troopText && f.troops) v.troopText.setText(`병 ${f.troops.inf + f.troops.cav}`);
      v.ring.setVisible(f === actor);
      const s = this.selectedSkill;
      const targetable = !!this.pending && !!s && f.side === 'enemy' && (s.target === 'enemy' || s.target === 'allEnemies');
      if (v.body instanceof Phaser.GameObjects.Arc)
        v.body.setStrokeStyle(targetable ? 3 : 2, targetable ? 0xff3b30 : f.isLord || f.isBoss ? 0xffe08a : 0xffffff);
      else if (v.sprite) {
        if (targetable) v.sprite.setTint(0xff9a9a);
        else v.sprite.clearTint();
      }
    }
    this.refreshPanel(actor);
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
    this.autoBtn = button(this, W - 108, 22, 84, 30, this.autoLabel(), () => this.toggleAuto());
    this.speedBtn = button(this, W - 32, 22, 50, 30, 'x1', () => this.toggleSpeed());
    this.autoBtn.container.setDepth(6);
    this.speedBtn.container.setDepth(6);
    if (isDev()) {
      // developer shortcut: win the whole battle now (every group), with the usual rewards
      const win = button(this, W - 32, 62, 50, 24, '승리', () => {
        if (this.over) return;
        this.wave = this.sc.waves.length - 1;
        for (const f of this.b.fighters) if (f.side === 'enemy') {
          f.hp = 0;
          f.dead = true;
        }
        this.finish(true);
      });
      win.container.setDepth(6);
    }
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

