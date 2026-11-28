import Phaser from 'phaser';
import { isAutoRig, isNaturalRig, rigParts, RIGS, RUN_CADENCE, STYLES, type BoneName, type Pose, type RigDef, type Style, type Vec } from '../data/rigs';

/** on-screen size of style-B rigs relative to the chibi ones */
export const AUTO_RIG_SIZE = 1.22;

const partKey = (id: string, part: string) => `rig-${id}-${part}`;

export function preloadRigs(scene: Phaser.Scene) {
  for (const id of Object.keys(RIGS))
    for (const part of rigParts(id)) scene.load.image(partKey(id, part), `${import.meta.env.BASE_URL}art/${id}/rig/${part}.png`);
}

export const hasRig = (scene: Phaser.Scene, id: string) => !!RIGS[id] && scene.textures.exists(partKey(id, 'torso'));

type Mode = 'idle' | 'run' | 'hold';

const rad = (d: number) => (d * Math.PI) / 180;
const rot = ([x, y]: Vec, a: number): Vec => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/**
 * A paper-doll character: one Image per body part inside `root`, placed every frame by forward
 * kinematics so the draw order (back arm behind the torso, front arm in front) is independent of
 * the bone hierarchy. Feet are at the root's origin; facing right.
 */
export class Rig {
  readonly root: Phaser.GameObjects.Container;
  private def: RigDef;
  private style: Style;
  private images = new Map<BoneName, Phaser.GameObjects.Image>();
  /** image rotation that makes each limb hang straight down at 0° */
  private base = new Map<BoneName, number>();
  /** limb length (rig units) for children attached at the tip */
  private len = new Map<BoneName, number>();
  /** current pose values, tweened directly while holding */
  private cur!: Required<Pose>;
  private mode: Mode = 'idle';
  private t = 0;
  private phase = 0;
  private speed = 1;
  private tween?: Phaser.Tweens.Tween;
  private readonly onUpdate: (time: number, delta: number) => void;

  /** which way the character faces when standing (enemies face left, toward the heroes) */
  private homeLeft = false;

  constructor(
    private scene: Phaser.Scene,
    id: string,
    height: number,
    faceLeft = false,
  ) {
    this.homeLeft = faceLeft;
    this.def = RIGS[id]();
    this.style = STYLES[this.def.weapon];
    this.cur = { ...this.style.rest };
    this.root = scene.add.container(0, 0);
    for (const name of this.def.drawOrder) {
      const b = this.def.bones[name];
      if (!b.part) continue;
      const p = b.part;
      const img = scene.add.image(0, 0, partKey(id, p.img));
      const k = this.def.imgScale;
      img.setOrigin((p.pivot[0] * k) / img.width, (p.pivot[1] * k) / img.height).setScale((p.scale / k) * (p.sx ?? 1), p.scale / k);
      if (p.tint) img.setTint(p.tint);
      this.images.set(name, img);
      this.root.add(img);
      if (p.tip) {
        const v: Vec = [p.tip[0] - p.pivot[0], p.tip[1] - p.pivot[1]];
        this.base.set(name, Math.atan2(v[0], v[1]));
        this.len.set(name, Math.hypot(v[0], v[1]) * p.scale);
      }
    }
    // realistic (style B) figures have small heads; drawn a bit taller so they read as well as the chibi ones
    // natural rigs match the painted pictures, which callers draw 1.12× smaller than older rigs
    const k = isNaturalRig(id) ? 1 / 1.12 : isAutoRig(id) ? AUTO_RIG_SIZE : 1;
    this.root.setScale((height * k) / this.def.height);
    this.onUpdate = (_t, delta) => this.update(delta);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    this.root.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
    this.setFacing(faceLeft);
    this.layout();
  }

  setSpeed(s: number) {
    this.speed = s;
  }

  /** Face left (mirrored) or right. */
  setFacing(left: boolean) {
    this.root.scaleX = Math.abs(this.root.scaleX) * (left ? -1 : 1);
  }

  idle() {
    this.stopTween();
    this.setFacing(this.homeLeft);
    this.mode = 'idle';
  }

  /** `back` = running away from the enemy (returning to the home spot) */
  run(back = false) {
    this.stopTween();
    this.setFacing(back ? !this.homeLeft : this.homeLeft);
    this.mode = 'run';
  }

  /** Ease into a held pose. */
  hold(pose: Pose, ms = 160) {
    this.mode = 'hold';
    return this.tweenTo({ ...this.style.rest, ...pose }, ms, 'Quad.easeOut');
  }

  raise() {
    return this.hold(this.style.raise, 180);
  }

  roar() {
    return this.hold(this.style.roar, 120);
  }

  /** Wind up and strike; resolves at the moment of impact (the pose is then held). */
  async attack(move: string) {
    // enemies ask for 'attack' (a plain hit) or 'special' (their big skill)
    if (move === 'attack') move = Math.random() < 0.5 ? 'atk1' : 'atk2';
    if (move === 'special') move = 'atk3';
    const m = this.style.moves[move] ?? this.style.moves.atk1;
    this.mode = 'hold';
    await this.tweenTo({ ...this.style.rest, ...m.wind }, m.windMs, 'Quad.easeOut');
    if (m.spin) {
      const sx = this.root.scaleX;
      this.scene.tweens.add({ targets: this.root, scaleX: -sx, duration: m.strikeMs / 2, yoyo: true, ease: 'Sine.easeInOut' });
    }
    await this.tweenTo({ ...this.style.rest, ...m.strike }, m.strikeMs, 'Quad.easeIn');
  }

  /** Fall over backwards and lie still (the battle fades the view out). */
  die() {
    this.stopTween();
    this.mode = 'hold';
    void this.tweenTo({ ...this.style.flinch, torso: -30, head: -25, lF1: -40, lB1: -20, bodyY: 0 }, 160, 'Quad.easeOut');
    // backwards = away from the way the character faces
    this.scene.tweens.add({ targets: this.root, angle: this.homeLeft ? 80 : -80, duration: 420, ease: 'Quad.easeIn', delay: 120 });
  }

  /** Quick flinch, then back to whatever was playing. */
  hit() {
    if (this.mode !== 'idle') return;
    this.mode = 'hold';
    void this.tweenTo({ ...this.cur, ...this.style.flinch }, 70, 'Quad.easeOut').then(() => this.idle());
  }

  // ---------------------------------------------------------------------------

  private stopTween() {
    this.tween?.stop();
    this.tween = undefined;
  }

  private tweenTo(target: Pose, ms: number, ease: string) {
    this.stopTween();
    const from = { ...this.cur };
    const keys = Object.keys(target) as (keyof Pose)[];
    return new Promise<void>((resolve) => {
      this.tween = this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        ease,
        onUpdate: (tw) => {
          const k = tw.getValue() ?? 1;
          for (const key of keys) this.cur[key] = from[key] + ((target[key] ?? from[key]) - from[key]) * k;
        },
        onComplete: () => resolve(),
        onStop: () => resolve(),
      });
    });
  }

  private update(delta: number) {
    if (!this.root.active) return;
    const dt = (delta / 1000) * this.speed;
    this.t += dt;
    if (this.mode === 'idle') this.blendTo(this.style.idle(this.t), dt * 12);
    else if (this.mode === 'run') {
      this.phase += dt * Math.PI * 2 * RUN_CADENCE;
      this.blendTo(this.style.run(this.phase), dt * 25);
    }
    this.layout();
  }

  /** Move part of the way toward a procedural pose (smooths mode changes). */
  private blendTo(p: Pose, amount: number) {
    const k = Math.min(1, amount);
    for (const key of Object.keys(p) as (keyof Pose)[]) this.cur[key] += ((p[key] ?? 0) - this.cur[key]) * k;
  }

  /**
   * Forward kinematics: place and rotate every part image from the current pose.
   * Held poses (attacks, shouts) are planted: the body drops until the lower foot is on the ground,
   * so deep lunges need no hand-tuned height; a negative bodyY still lifts it (leaps).
   */
  private layout() {
    let world = this.solveAll(this.cur.bodyY);
    if (this.mode === 'hold' && this.def.bones.lF2 && this.def.bones.lB2) {
      const foot = (leg: BoneName) => {
        const w = world.get(leg)!;
        return w.pos[1] + rot([0, this.len.get(leg) ?? 0], w.ang)[1];
      };
      world = this.solveAll(0);
      const low = Math.max(foot('lF2'), foot('lB2'));
      world = this.solveAll(-low + Math.min(0, this.cur.bodyY));
    }
    for (const [name, img] of this.images) {
      const w = world.get(name)!;
      img.setPosition(w.pos[0], w.pos[1]);
      img.setRotation(w.ang + (this.base.get(name) ?? 0));
    }
  }

  private solveAll(bodyY: number) {
    const world = new Map<BoneName, { pos: Vec; ang: number }>();
    const solve = (name: BoneName): { pos: Vec; ang: number } => {
      const hit = world.get(name);
      if (hit) return hit;
      const b = this.def.bones[name];
      const local = rad(this.cur[name] ?? 0);
      let res: { pos: Vec; ang: number };
      if (!b.parent) {
        const at = b.at as Vec;
        res = { pos: [at[0], at[1] + bodyY], ang: local };
      } else {
        const par = solve(b.parent);
        const off: Vec = b.at === 'tip' ? [0, this.len.get(b.parent) ?? 0] : b.at;
        const o = rot(off, par.ang);
        res = { pos: [par.pos[0] + o[0], par.pos[1] + o[1]], ang: par.ang + local };
      }
      world.set(name, res);
      return res;
    };
    for (const name of Object.keys(this.def.bones) as BoneName[]) solve(name);
    return world;
  }
}
