#!/usr/bin/env node
/**
 * Turn one wide battlefield picture into the two scrolling layers of the battle screen.
 *
 *   node tools/battle-bg.mjs <picture.png> <scenarioId> [--horizon 0.30]
 *
 * The picture is cut at the horizon (a fraction of its height) into
 *   public/art/battle/<id>-sky.png     sky and distant scenery (scrolls slowly)
 *   public/art/battle/<id>-ground.png  the ground the fighters stand on (scrolls fast)
 * Each layer is written as the picture followed by its mirror image, so it tiles without a seam.
 * The original is kept in assets/raw/battle/. Runs tools/art-manifest.mjs afterwards.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
const hi = args.indexOf('--horizon');
const horizon = hi >= 0 ? Number(args.splice(hi, 2)[1]) : 0.3;
const [input, id] = args;
if (!input || !id) {
  console.error('usage: battle-bg.mjs <picture.png> <scenarioId> [--horizon 0.30]');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'assets', 'raw', 'battle'), { recursive: true });
copyFileSync(input, join(root, 'assets', 'raw', 'battle', `${id}.png`));
const outDir = join(root, 'public', 'art', 'battle');
mkdirSync(outDir, { recursive: true });

const src = PNG.sync.read(readFileSync(input));
const cut = Math.round(src.height * horizon);

/** rows [y0, y1) of the picture, then the same rows mirrored left↔right */
function band(y0, y1) {
  const w = src.width;
  const h = y1 - y0;
  const out = new PNG({ width: w * 2, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y0 + y) * w + x) * 4;
      const px = src.data.subarray(s, s + 4);
      out.data.set(px, (y * w * 2 + x) * 4);
      out.data.set(px, (y * w * 2 + (w * 2 - 1 - x)) * 4);
    }
  }
  return PNG.sync.write(out);
}

writeFileSync(join(outDir, `${id}-sky.png`), band(0, cut));
writeFileSync(join(outDir, `${id}-ground.png`), band(cut, src.height));
console.log(`${id}: ${src.width}×${src.height}, horizon at ${cut}px → sky ${src.width * 2}×${cut}, ground ${src.width * 2}×${src.height - cut}`);
execFileSync('node', [join(root, 'tools', 'art-manifest.mjs')], { stdio: 'inherit' });
