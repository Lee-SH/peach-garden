#!/usr/bin/env node
/**
 * Add a character's 2×2 sheet in one step: keep the original, cut it, update the manifest.
 *
 *   node tools/add-art.mjs <sheet.png> <artId> <hero|grunt|boss>
 *
 * Sheet layouts (all on white):
 *   hero  : attack  ult     / idle   portrait   (facing right)
 *   grunt : idle    attack  / hurt   down       (facing left)
 *   boss  : idle    attack  / special portrait  (facing left)
 * artIds for enemies are listed in src/data/enemyArt.ts.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LAYOUTS = {
  hero: ['attack', 'ult', 'idle', 'portrait'],
  grunt: ['idle', 'attack', 'hurt', 'down'],
  boss: ['idle', 'attack', 'special', 'portrait'],
};
const [sheet, id, kind] = process.argv.slice(2);
if (!sheet || !id || !LAYOUTS[kind]) {
  console.error('usage: add-art.mjs <sheet.png> <artId> <hero|grunt|boss>');
  process.exit(1);
}
const tools = dirname(fileURLToPath(import.meta.url));
const root = join(tools, '..');
const raw = join(root, 'assets', 'raw', `${id}-sheet.png`);
copyFileSync(sheet, raw);
execFileSync('node', [join(tools, 'cut-sheet.mjs'), raw, join(root, 'public', 'art', id), ...LAYOUTS[kind]], { stdio: 'inherit' });
execFileSync('node', [join(tools, 'art-manifest.mjs')], { stdio: 'inherit' });
