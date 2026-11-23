#!/usr/bin/env node
/**
 * Prepare cutout-rig parts from a 3×3 parts sheet (see docs/design.md, "관절 애니메이션").
 *
 *   node tools/rig-prep.mjs assets/raw/liubei-parts.png public/art/liubei/rig [upperArmCrop=175] [imgScale=0.4]
 *
 * Sheet cells: ref head torso / skirt upperarm forearm / pants shin sword.
 * Pivots, scales and joint points for each part are set by hand in src/data/rigs.ts, measured on the
 * full-size parts; the saved images are shrunk by `imgScale` (must match RigDef.imgScale) because a
 * huge image drawn at 1/10 size aliases badly.
 * - upperarm: the AI drew it down to the wrist, so rows below `upperArmCrop` are dropped (elbow).
 * - pants: one piece for both legs → split down the middle into thigh_b (screen left) / thigh_f.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const [src, out, crop = '175', imgScale = '0.4'] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: rig-prep.mjs <parts-sheet.png> <outDir> [upperArmCrop]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });
execFileSync('node', [join(dirname(fileURLToPath(import.meta.url)), 'cut-sheet.mjs'), src, out, '--grid', '3x3', '--scale', '1',
  'ref', 'head', 'torso', 'skirt', 'upperarm', 'forearm', 'pants', 'shin', 'sword'], { stdio: 'inherit' });

const read = (n) => PNG.sync.read(readFileSync(join(out, `${n}.png`)));
const write = (n, png) => writeFileSync(join(out, `${n}.png`), PNG.sync.write(png));
function sub(png, x0, y0, w, h) {
  const o = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) png.data.copy(o.data, y * w * 4, ((y0 + y) * png.width + x0) * 4, ((y0 + y) * png.width + x0 + w) * 4);
  return o;
}

const arm = read('upperarm');
write('upperarm', sub(arm, 0, 0, arm.width, Math.min(arm.height, Number(crop))));

const pants = read('pants');
const half = Math.floor(pants.width / 2);
write('thigh_b', sub(pants, 0, 0, half, pants.height));
write('thigh_f', sub(pants, half, 0, pants.width - half, pants.height));
rmSync(join(out, 'pants.png'));
rmSync(join(out, 'ref.png')); // reference only, used to judge proportions
rmSync(join(out, 'anchors.json'));
for (const f of readdirSync(out).filter((f) => f.endsWith('.png'))) {
  const p = read(f.slice(0, -4));
  execFileSync('sips', ['-z', String(Math.round(p.height * Number(imgScale))), String(Math.round(p.width * Number(imgScale))), join(out, f)], { stdio: 'ignore' });
}
console.log('rig parts ready in', out);
