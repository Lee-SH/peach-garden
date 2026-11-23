import Phaser from 'phaser';
import { FIELD_TOP } from './field';

/**
 * Visual effects for area skills, so a skill used from where the fighter stands visibly travels to
 * its targets. Each effect resolves at the moment of impact (show damage then) and cleans itself up.
 */
export type FxKind = 'shout' | 'warcry' | 'crescent' | 'volley' | 'slashes' | 'blackwind' | 'lightning';

/** Area skills → effect. Unlisted area attacks use 'slashes'. */
export const SKILL_FX: Record<string, FxKind> = {
  zhangfei2: 'shout', // 대갈일성: the roar at Changban bridge
  guanyu3: 'crescent', // 청룡참
  archer2: 'volley', // 일제사격
  cyz2: 'warcry', // 황천의 함성
  zl2: 'warcry', // 인공의 호령
  chf2: 'slashes', // 포위 공격
  zb2: 'blackwind', // 흑풍
  zj2: 'lightning', // 황천뇌화
};

/** Shouts are delivered with a roar pose instead of a weapon swing. */
export const isShout = (k: FxKind) => k === 'shout' || k === 'warcry';

type P = { x: number; y: number };
const D = 35;

const wait = (scene: Phaser.Scene, ms: number) => new Promise<void>((r) => scene.time.delayedCall(ms, r));

export function playFx(scene: Phaser.Scene, kind: FxKind, from: P, targets: P[], dir: 1 | -1): Promise<void> {
  if (!targets.length) return Promise.resolve();
  switch (kind) {
    case 'shout':
      return rings(scene, from, targets, 0xfff1b0, 0.007);
    case 'warcry':
      return rings(scene, from, targets, 0xff7a4a, 0.005);
    case 'crescent':
      return crescent(scene, from, targets, dir);
    case 'volley':
      return volley(scene, from, targets);
    case 'blackwind':
      return blackwind(scene, from, targets);
    case 'lightning':
      return lightning(scene, targets);
    default:
      return slashes(scene, targets);
  }
}

/** Expanding shock rings from the mouth; hits land as the first ring reaches the targets. */
async function rings(scene: Phaser.Scene, from: P, targets: P[], color: number, shake: number) {
  const far = Math.max(...targets.map((t) => Phaser.Math.Distance.Between(from.x, from.y, t.x, t.y))) + 30;
  const dur = 460;
  for (let i = 0; i < 3; i++) {
    // redraw each frame so the line keeps its width while the ring grows (scaling would fatten it)
    const g = scene.add.graphics().setDepth(D);
    const o = { r: 10 };
    scene.tweens.add({
      targets: o,
      r: far,
      delay: i * 110,
      duration: dur,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        const k = 1 - (o.r - 10) / (far - 10);
        g.clear().lineStyle(4 - i, color, 0.25 + 0.75 * k).strokeEllipse(from.x, from.y, o.r * 2, o.r * 1.4);
      },
      onComplete: () => g.destroy(),
    });
  }
  // short "sound" strokes at the mouth
  const g = scene.add.graphics().setDepth(D).lineStyle(3, color, 1);
  const sx = Math.sign(targets[0].x - from.x) || 1;
  for (const a of [-0.5, 0, 0.5]) g.lineBetween(from.x + sx * 8, from.y + a * 14, from.x + sx * 22, from.y + a * 26);
  scene.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => g.destroy() });
  scene.cameras.main.shake(380, shake);
  await wait(scene, dur * 0.55);
}

/** A green crescent blade wave sweeping across the enemy line. */
async function crescent(scene: Phaser.Scene, from: P, targets: P[], dir: 1 | -1) {
  const ys = targets.map((t) => t.y);
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(60, Math.max(...ys) - Math.min(...ys) + 50);
  const g = scene.add.graphics().setDepth(D);
  const draw = () => {
    g.clear();
    g.lineStyle(12, 0x3fbf72, 0.55).beginPath().arc(0, 0, span / 2, -1.2, 1.2).strokePath();
    g.lineStyle(5, 0xd6ffe4, 0.95).beginPath().arc(0, 0, span / 2, -1.1, 1.1).strokePath();
  };
  draw();
  g.setPosition(from.x + dir * 10, midY).setScale(dir, 1);
  const nearest = dir > 0 ? Math.min(...targets.map((t) => t.x)) : Math.max(...targets.map((t) => t.x));
  const end = dir > 0 ? 400 : -40;
  const dur = 420;
  scene.tweens.add({ targets: g, x: end, duration: dur, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
  scene.tweens.add({ targets: g, alpha: 0.2, delay: dur * 0.7, duration: dur * 0.3 });
  // impact when the wave reaches the first target (ease-in: distance ∝ t²)
  const frac = Math.sqrt(Math.min(1, Math.abs(nearest - from.x) / Math.abs(end - from.x)));
  await wait(scene, dur * frac);
  scene.cameras.main.shake(200, 0.005);
}

/** Arrows arcing to every target. */
async function volley(scene: Phaser.Scene, from: P, targets: P[]) {
  const dur = 380;
  targets.forEach((t, ti) =>
    [0, 1].forEach((k) => {
      const arrow = scene.add.rectangle(from.x, from.y, 14, 2, 0xe8dcc0).setDepth(D);
      const o = { p: 0 };
      const ty = t.y - 10 + k * 8;
      const tx = t.x + (k ? 6 : -4);
      scene.tweens.add({
        targets: o,
        p: 1,
        delay: ti * 50 + k * 70,
        duration: dur,
        onUpdate: () => {
          const x = Phaser.Math.Linear(from.x, tx, o.p);
          const y = Phaser.Math.Linear(from.y, ty, o.p) - Math.sin(o.p * Math.PI) * 60;
          const dx = tx - from.x;
          const dy = ty - from.y - Math.cos(o.p * Math.PI) * 60 * Math.PI;
          arrow.setPosition(x, y).setRotation(Math.atan2(dy, dx));
        },
        onComplete: () => arrow.destroy(),
      });
    }),
  );
  await wait(scene, dur + 60);
}

/** Dark whirlwinds drifting onto each target. */
async function blackwind(scene: Phaser.Scene, from: P, targets: P[]) {
  const dur = 480;
  for (const t of targets) {
    const c = scene.add.container(from.x, from.y - 10).setDepth(D);
    for (let i = 0; i < 6; i++) c.add(scene.add.ellipse(Math.cos(i) * 8, Math.sin(i * 1.7) * 6, 18 - i * 2, 7, i % 2 ? 0x3a2a4a : 0x151018, 0.8));
    scene.tweens.add({ targets: c, x: t.x, y: t.y - 14, rotation: 6, duration: dur, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: c, alpha: 0, scale: 1.8, delay: dur, duration: 220, onComplete: () => c.destroy() });
  }
  await wait(scene, dur);
}

/** Yellow lightning from the sky onto each target. */
async function lightning(scene: Phaser.Scene, targets: P[]) {
  await wait(scene, 160);
  for (const t of targets) {
    const g = scene.add.graphics().setDepth(D);
    const pts: P[] = [{ x: t.x + Phaser.Math.Between(-20, 20), y: FIELD_TOP }];
    const steps = 6;
    for (let i = 1; i <= steps; i++) pts.push({ x: t.x + (i === steps ? 0 : Phaser.Math.Between(-14, 14)), y: Phaser.Math.Linear(FIELD_TOP, t.y - 6, i / steps) });
    for (const [w, col, a] of [[7, 0xffd23b, 0.6], [3, 0xffffff, 1]] as const) {
      g.lineStyle(w, col, a).beginPath().moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.strokePath();
    }
    scene.tweens.add({ targets: g, alpha: 0, delay: 120, duration: 260, onComplete: () => g.destroy() });
  }
  scene.cameras.main.flash(120, 255, 240, 160);
  scene.cameras.main.shake(220, 0.006);
}

/** Quick slash marks on every target. */
async function slashes(scene: Phaser.Scene, targets: P[]) {
  targets.forEach((t, i) => {
    scene.time.delayedCall(i * 70, () => {
      const g = scene.add.graphics().setDepth(D);
      g.lineStyle(4, 0xffffff, 0.95).lineBetween(-16, -14, 16, 14);
      g.setPosition(t.x, t.y - 12).setScale(0.2, 1);
      scene.tweens.add({ targets: g, scaleX: 1, duration: 90 });
      scene.tweens.add({ targets: g, alpha: 0, delay: 150, duration: 200, onComplete: () => g.destroy() });
    });
  });
  await wait(scene, targets.length * 70 + 90);
}
