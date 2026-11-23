import Phaser from 'phaser';
import { RIGS, STYLES } from '../data/rigs';
import { COLOR, hd, text, W } from '../ui/theme';
import { Rig } from '../ui/rig';

/** Dev check: one rig per pose, side by side (open with window.__game.scene.start('RigLab')). */
export class RigLabScene extends Phaser.Scene {
  constructor() {
    super('RigLab');
  }

  create(data: { id?: string; size?: number }) {
    hd(this);
    const id = data.id ?? 'liubei';
    const size = data.size ?? 150;
    const { rest: REST, run: runPose, moves: MOVES, raise: RAISE } = STYLES[RIGS[id]().weapon];
    this.add.rectangle(0, 0, W, 640, 0x6b5a3c).setOrigin(0);
    const poses: [string, (r: Rig) => void][] = [
      ['rest', (r) => void r.hold(REST, 1)],
      ...[0, 45, 90, 135, 180, 225, 270, 315].map((d): [string, (r: Rig) => void] => [`run ${d}`, (r) => void r.hold(runPose((d * Math.PI) / 180), 1)]),
      ...Object.entries(MOVES).flatMap(([k, m]): [string, (r: Rig) => void][] => [
        [`${k} wind`, (r) => void r.hold(m.wind, 1)],
        [`${k} hit`, (r) => void r.hold(m.strike, 1)],
      ]),
      ['raise', (r) => void r.hold(RAISE, 1)],
    ];
    const cols = 4;
    poses.forEach(([name, apply], i) => {
      const x = 50 + (i % cols) * 87;
      const y = 175 + Math.floor(i / cols) * 160;
      const r = new Rig(this, id, size * 0.6);
      r.root.setPosition(x, y);
      apply(r);
      this.add.line(0, 0, x - 40, y, x + 40, y, 0xff0000).setOrigin(0);
      text(this, x, y + 8, name, 10, COLOR.text).setOrigin(0.5, 0);
    });
  }
}
