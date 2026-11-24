import Phaser from 'phaser';
import type { ItemId } from '../core/army';
import { ICON_FILES } from '../data/artManifest';
import { FONT, RES } from './theme';

/**
 * Pictures for loot: soldiers and smithing tools. Until real art exists each one is a coloured
 * circle with a hanja glyph (like the enemy tokens). Art lives at public/art/icons/<key>.png (about
 * 128px, transparent), cut from assets/raw/icons-sheet.png with
 * `tools/cut-sheet.mjs <sheet> <dir> --grid 4x2 --max 128 inf cav whetstone lacquer rawhide steel manual empty`;
 * run `node tools/art-manifest.mjs` afterwards.
 */
export type StatusKey = 'atkUp' | 'defDown' | 'stun' | 'burn';
export type IconKey = 'inf' | 'cav' | ItemId | StatusKey;

export const ICON_LOOK: Record<IconKey, { glyph: string; color: number; name: string; arrow?: 'up' | 'down' }> = {
  inf: { glyph: '步', color: 0x4f7a3a, name: '보병' },
  cav: { glyph: '騎', color: 0x9a5a2c, name: '기병' },
  whetstone: { glyph: '礪', color: 0x6f7682, name: '숫돌' },
  lacquer: { glyph: '漆', color: 0x7a1f22, name: '옻' },
  rawhide: { glyph: '韋', color: 0xa4824e, name: '소가죽 끈' },
  steel: { glyph: '鋼', color: 0x3f6d94, name: '백련강' },
  manual: { glyph: '秘', color: 0xb8901c, name: '간장·막야의 비전' },
  // battle states shown above a fighter's head
  atkUp: { glyph: '攻', color: 0xc0392b, name: '공격 상승', arrow: 'up' },
  defDown: { glyph: '防', color: 0x2f5f9a, name: '방어 하락', arrow: 'down' },
  stun: { glyph: '暈', color: 0x7a4fb0, name: '기절' },
  burn: { glyph: '火', color: 0xd9641e, name: '화상' },
};

const key = (k: IconKey) => `icon-${k}`;

export function preloadIcons(scene: Phaser.Scene) {
  for (const k of ICON_FILES) scene.load.image(key(k as IconKey), `${import.meta.env.BASE_URL}art/icons/${k}.png`);
}

/** An icon centred at (x, y), `size` px across. */
export function icon(scene: Phaser.Scene, k: IconKey, x: number, y: number, size: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  if (scene.textures.exists(key(k))) {
    const img = scene.add.image(0, 0, key(k));
    img.setScale(size / Math.max(img.width, img.height)); // fit inside the square, keep the shape
    c.add(img);
    return c;
  }
  const look = ICON_LOOK[k];
  const r = size / 2;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillCircle(1, 2, r);
  g.fillStyle(look.color, 1).fillCircle(0, 0, r);
  g.lineStyle(Math.max(1.5, size / 16), 0xf3e9d2, 0.85).strokeCircle(0, 0, r - 1);
  const t = scene.add
    .text(0, 0, look.glyph, { fontFamily: FONT, fontSize: `${Math.round(size * 0.55)}px`, color: '#fff8e6', fontStyle: 'bold', resolution: RES })
    .setOrigin(0.5);
  c.add([g, t]);
  if (look.arrow) {
    // a small arrow at the corner: up = raised, down = lowered
    const a = scene.add.graphics();
    const ax = r * 0.75;
    const ay = -r * 0.55;
    const k = r * 0.55;
    const up = look.arrow === 'up';
    a.fillStyle(up ? 0x7cff8a : 0xff6b5b, 1).lineStyle(1, 0x000000, 0.8);
    const pts = up ? [ax, ay - k, ax - k * 0.8, ay + k * 0.4, ax + k * 0.8, ay + k * 0.4] : [ax, ay + k, ax - k * 0.8, ay - k * 0.4, ax + k * 0.8, ay - k * 0.4];
    a.fillTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]).strokeTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
    c.add(a);
  }
  return c;
}
