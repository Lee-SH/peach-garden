#!/usr/bin/env node
/**
 * Add a run cycle to a character from a 2×2 run sheet on white. Only the TOP row is used (frame 1 =
 * a foot landing, frame 2 = legs passing): the image AI often turns the bottom row into a standing
 * pose, and two clean frames alternating read better than four mismatched ones.
 *
 *   node tools/add-run.mjs <sheet.png> <artId> [--flip]
 *
 * The frames are cut, then scaled so they stand as tall as the character's idle picture (a runner
 * leans, so a little shorter: RUN_HEIGHT), and saved with their feet
 * anchors, as public/art/<id>/r1.png and r2.png. --flip mirrors every frame (when the sheet runs the
 * wrong way). The sheet is kept in assets/raw/<id>-run.png and the art manifest is rebuilt.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const RUN_HEIGHT = 0.95;
const args = process.argv.slice(2);
const flip = args.includes('--flip');
const [sheet, id] = args.filter((a) => !a.startsWith('--'));
if (!sheet || !id) {
  console.error('usage: add-run.mjs <sheet.png> <artId> [--flip]');
  process.exit(1);
}
const tools = dirname(fileURLToPath(import.meta.url));
const root = join(tools, '..');
const art = join(root, 'public', 'art', id);
const raw = join(root, 'assets', 'raw', `${id}-run.png`);
if (sheet !== raw) copyFileSync(sheet, raw);
const tmp = join(root, 'assets', 'raw', `${id}-runcut`);
rmSync(tmp, { recursive: true, force: true });
const names = ['r1', 'r2', 'x3', 'x4'].map((n) => (flip ? `${n}:flip` : n));
execFileSync('node', [join(tools, 'cut-sheet.mjs'), raw, tmp, '--grid', '2x2', '--scale', '1', ...names], { stdio: ['ignore', 'ignore', 'inherit'] });

const height = (f) => PNG.sync.read(readFileSync(f)).height;
const idleH = height(join(art, 'idle.png'));
const frames = ['r1', 'r2'];
const avg = frames.reduce((a, n) => a + height(join(tmp, `${n}.png`)), 0) / frames.length;
const k = (idleH * RUN_HEIGHT) / avg;
for (const n of frames) {
  const src = join(tmp, `${n}.png`);
  const p = PNG.sync.read(readFileSync(src));
  execFileSync('sips', ['-z', String(Math.round(p.height * k)), String(Math.round(p.width * k)), src, '--out', join(art, `${n}.png`)], { stdio: 'ignore' });
}
const anchors = JSON.parse(readFileSync(join(art, 'anchors.json'), 'utf8'));
const cut = JSON.parse(readFileSync(join(tmp, 'anchors.json'), 'utf8'));
for (const n of frames) anchors[n] = cut[n];
writeFileSync(join(art, 'anchors.json'), JSON.stringify(anchors, null, 2) + '\n');
rmSync(tmp, { recursive: true, force: true });
console.log(`${id}: run frames scaled ×${k.toFixed(2)} to idle height ${idleH}px`);
execFileSync('node', [join(tools, 'art-manifest.mjs')], { stdio: 'ignore' });
