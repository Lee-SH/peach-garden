import Phaser from 'phaser';

export const W = 360;
export const H = 640;

export const FONT = '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

export const COLOR = {
  bg: 0x14110e,
  panel: 0x231d17,
  panelLine: 0x5c4a35,
  text: '#f3e9d2',
  dim: '#a8977a',
  gold: '#e8c15a',
  red: '#ff6b5b',
  blue: '#7cc4ff',
  player: 0x2f6fd6,
  enemy: 0xc9a227,
  boss: 0xd9482b,
  move: 0x4aa3ff,
  danger: 0xff3b30,
  preview: 0xffa53b,
  terrain: {
    plain: 0x55603b,
    forest: 0x2f5530,
    mountain: 0x6b5f55,
    river: 0x2b5a85,
    village: 0x8a6b45,
  },
};

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 14, color = COLOR.text) {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, lineSpacing: 4 });
}

export interface Button {
  container: Phaser.GameObjects.Container;
  setEnabled(on: boolean): void;
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
): Button {
  const bg = scene.add.rectangle(0, 0, w, h, 0x3a2f24).setStrokeStyle(2, COLOR.panelLine);
  const t = text(scene, 0, 0, label, 15).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, t]).setSize(w, h);
  let enabled = true;
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => enabled && bg.setFillStyle(0x5c4a35));
  c.on('pointerout', () => bg.setFillStyle(0x3a2f24));
  c.on('pointerup', () => {
    bg.setFillStyle(0x3a2f24);
    if (enabled) onClick();
  });
  return {
    container: c,
    setEnabled(on: boolean) {
      enabled = on;
      c.setAlpha(on ? 1 : 0.35);
    },
  };
}

export function setButtonLabel(btn: Button, label: string) {
  btn.container.list.forEach((o) => o instanceof Phaser.GameObjects.Text && o.setText(label));
}
