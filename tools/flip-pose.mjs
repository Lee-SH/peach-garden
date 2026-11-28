#!/usr/bin/env node
/**
 * Mirror cut poses left↔right (when a drawing faces the wrong way) and fix their feet anchors.
 *
 *   node tools/flip-pose.mjs <artId> <pose> [pose ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const [id, ...poses] = process.argv.slice(2);
if (!id || !poses.length) {
  console.error('usage: flip-pose.mjs <artId> <pose> [pose ...]');
  process.exit(1);
}
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art', id);
const anchors = JSON.parse(readFileSync(join(dir, 'anchors.json'), 'utf8'));
for (const pose of poses) {
  const file = join(dir, `${pose}.png`);
  const p = PNG.sync.read(readFileSync(file));
  const o = new PNG({ width: p.width, height: p.height });
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) p.data.copy(o.data, (y * p.width + (p.width - 1 - x)) * 4, (y * p.width + x) * 4, (y * p.width + x) * 4 + 4);
  writeFileSync(file, PNG.sync.write(o));
  if (anchors[pose] !== undefined) anchors[pose] = +(1 - anchors[pose]).toFixed(3);
  console.log(`${id}/${pose} flipped`);
}
writeFileSync(join(dir, 'anchors.json'), JSON.stringify(anchors, null, 2) + '\n');
