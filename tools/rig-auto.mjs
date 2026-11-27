#!/usr/bin/env node
/**
 * Build a cutout rig from a 3×3 parts sheet with NO hand measuring (style B, 7-heads-tall figures).
 *
 *   node tools/rig-auto.mjs <parts-sheet.png> <id> <twin|polearm|single> [--flip]
 *
 * Sheet cells (white background, character facing RIGHT, every limb drawn hanging straight down):
 *   head   torso   skirt
 *   upper  forearm weapon (vertical, tip UP, grip at the bottom)
 *   thigh  shin    ref (full body, ignored)
 * --flip mirrors every part (when the sheet was drawn facing left).
 *
 * Joints are found from the part outlines (top/bottom centres, torso shoulder line) and every part
 * is scaled to fixed body proportions (rig units below), so sheets drawn at any size fit together.
 * Writes public/art/<id>/rig/<part>.png (stored at 1 px = 2 rig units) and the entry for <id> in
 * src/data/rigManifest.ts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flip = args.includes('--flip');
// --head K: head size multiplier; --neck F: neck joint height on the head image (fraction from the top),
// for heads whose image runs past the chin (Guan Yu's long beard)
const num = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args.splice(i, 2)[1]) : def;
};
const headK = num('--head', 1);
// --wlen N: weapon length grip→tip in rig units; --grip F: grip position on the weapon image (from the top)
const wlen = num('--wlen', 0);
const gripAt = num('--grip', 0);
const neckAt = num('--neck', 0);
// --order head,torso,...: the drawings in reading order when the sheet has extras (name them "skip")
const oi = args.indexOf('--order');
const order = oi >= 0 ? args.splice(oi, 2)[1].split(',') : ['head', 'torso', 'skirt', 'upper', 'fore', 'weapon', 'thigh', 'shin', 'ref'];
const [sheet, id, style = 'twin'] = args.filter((a) => !a.startsWith('--'));
if (!sheet || !id) {
  console.error('usage: rig-auto.mjs <parts-sheet.png> <id> <twin|polearm|single> [--flip]');
  process.exit(1);
}

/** Body proportions in rig units (about 700 tall). */
const T = {
  // sturdier than real proportions (about 6 heads): a big-ish head and a short body read better small
  head: 156, // head image height (hair and crown included)
  torso: 192, // base of the neck → hip joint
  upper: 118, // shoulder → elbow
  fore: 112, // elbow → fist centre
  thigh: 148, // hip → knee
  shin: 168, // knee → sole
  weapon: { twin: 220, single: 240, polearm: 540 }[style] ?? 220, // grip → tip
};
/** where the grip is on the weapon image, as a fraction of its height from the top */
const GRIP = { twin: 0.88, single: 0.88, polearm: 0.62 }[style] ?? 0.88;
const STORE = 2; // rig units per stored pixel

const tmp = join(root, 'assets', 'raw', `${id}-rigcut`);
rmSync(tmp, { recursive: true, force: true });
execFileSync('node', [join(root, 'tools', 'cut-sheet.mjs'), sheet, tmp, '--grid', '3x3', '--scale', '1', '--byorder',
  ...order], { stdio: ['ignore', 'ignore', 'inherit'] });

const read = (n) => PNG.sync.read(readFileSync(join(tmp, `${n}.png`)));
const op = (p, x, y) => p.data[(y * p.width + x) * 4 + 3] > 128;
/** opaque span of a row */
function span(p, y) {
  let l = -1;
  let r = -1;
  for (let x = 0; x < p.width; x++) if (op(p, x, y)) {
    if (l < 0) l = x;
    r = x;
  }
  return l < 0 ? null : [l, r];
}
/** average horizontal centre of the opaque pixels in rows [a, b) given as fractions of the height */
function centre(p, a, b) {
  let sx = 0;
  let n = 0;
  for (let y = Math.floor(p.height * a); y < Math.max(Math.floor(p.height * a) + 1, Math.floor(p.height * b)); y++)
    for (let x = 0; x < p.width; x++) if (op(p, x, y)) {
      sx += x;
      n++;
    }
  return n ? sx / n : p.width / 2;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function mirror(p) {
  const o = new PNG({ width: p.width, height: p.height });
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) p.data.copy(o.data, (y * p.width + (p.width - 1 - x)) * 4, (y * p.width + x) * 4, (y * p.width + x) * 4 + 4);
  return o;
}

const parts = {};
const outDir = join(root, 'public', 'art', id, 'rig');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

/** save a part resized so 1 px = STORE rig units; pivot/tip converted to stored pixels */
function save(name, p, scale, pivot, tip) {
  const f = scale / STORE;
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, PNG.sync.write(p));
  const w = Math.max(1, Math.round(p.width * f));
  const h = Math.max(1, Math.round(p.height * f));
  execFileSync('sips', ['-z', String(h), String(w), file], { stdio: 'ignore' });
  const k = (v) => (v ? [+(v[0] * f).toFixed(1), +(v[1] * f).toFixed(1)] : undefined);
  parts[name] = { pivot: k(pivot), ...(tip ? { tip: k(tip) } : {}) };
  return f;
}
const load = (n) => (flip ? mirror(read(n)) : read(n));

// limbs: pivot at the top centre, tip at the bottom centre
function limb(name, src, target, a = 0.06, b = 0.94) {
  const p = load(src);
  const pivot = [centre(p, 0, 0.12), p.height * a];
  const tip = [centre(p, 0.86, 1), p.height * b];
  const scale = target / dist(pivot, tip);
  save(name, p, scale, pivot, tip);
  return scale;
}
limb('upperarm', 'upper', T.upper);
limb('forearm', 'fore', T.fore, 0.05, 0.9);
limb('thigh', 'thigh', T.thigh, 0.05, 0.95);
// shin: no child; the length that matters is knee → sole
{
  const p = load('shin');
  const pivot = [centre(p, 0, 0.12), p.height * 0.05];
  const scale = T.shin / (p.height - pivot[1]);
  save('shin', p, scale, pivot, [centre(p, 0.5, 0.75), p.height]);
}

// torso: hip joint (pivot) at the bottom centre, neck at the top centre, shoulders on the upper sides
const torso = load('torso');
const tHip = [centre(torso, 0.9, 1), torso.height * 0.92];
const tNeck = [centre(torso, 0, 0.06), torso.height * 0.04];
const tScale = T.torso / dist(tHip, tNeck);
const sy = Math.round(torso.height * 0.2);
const [sl, sr] = span(torso, sy) ?? [0, torso.width];
const shoulderB = [sl + (sr - sl) * 0.24, sy];
const shoulderF = [sr - (sr - sl) * 0.24, sy];
const [hl, hr] = span(torso, Math.round(torso.height * 0.9)) ?? [0, torso.width];
save('torso', torso, tScale, tHip);
const rel = (v) => [+((v[0] - tHip[0]) * tScale).toFixed(1), +((v[1] - tHip[1]) * tScale).toFixed(1)];

// head: pivot at the bottom (neck) centre
const head = load('head');
const neckF = neckAt || 0.93;
// size by the part above the neck (a long beard shouldn't shrink the face)
const hScale = (T.head * 0.93 * headK) / (head.height * neckF);
const hPivot = [centre(head, neckF - 0.06, neckF), head.height * neckF];
save('head', head, hScale, hPivot);

// skirt hangs from the belt, drawn at the torso's scale
const skirt = load('skirt');
save('skirt', skirt, tScale, [centre(skirt, 0, 0.08), skirt.height * 0.03]);

// weapon: vertical, tip up; pivot at the grip
const weapon = load('weapon');
const grip = gripAt || GRIP;
const wGrip = [centre(weapon, grip - 0.03, grip + 0.03), weapon.height * grip];
const wScale = (wlen || T.weapon) / wGrip[1];
save('weapon', weapon, wScale, wGrip);

const hipHeight = T.thigh + T.shin;
const entry = {
  style,
  parts,
  neck: rel(tNeck),
  shoulderB: rel(shoulderB),
  shoulderF: rel(shoulderF),
  legX: +(((hr - hl) * tScale) * 0.2).toFixed(1),
  skirtAt: [0, -Math.round(T.torso * 0.08)],
  hipHeight,
  height: Math.round(hipHeight + T.torso + hPivot[1] * hScale),
};
rmSync(tmp, { recursive: true, force: true });

// merge into src/data/rigManifest.ts
const manifestFile = join(root, 'src', 'data', 'rigManifest.ts');
let all = {};
if (existsSync(manifestFile)) {
  const m = readFileSync(manifestFile, 'utf8').match(/= (\{[\s\S]*\});/);
  if (m) all = JSON.parse(m[1]);
}
all[id] = entry;
writeFileSync(
  manifestFile,
  `// Generated by tools/rig-auto.mjs — do not edit by hand.\nimport type { AutoRig } from './rigs';\n\n/** Auto-measured cutout rigs (style B). Pivots in stored part pixels (1 px = 2 rig units). */\nexport const RIG_MANIFEST: Record<string, AutoRig> = ${JSON.stringify(all, null, 2)};\n`,
);
console.log(`${id}: ${Object.keys(parts).join(', ')} → height ${entry.height}, hip ${hipHeight}`);
