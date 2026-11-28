#!/usr/bin/env node
/**
 * Cut a cutout-parts sheet into named parts by SHAPE, not by grid cell (the image AI often draws
 * long weapons across cells or squeezes in a fourth column).
 *
 *   node tools/parts-cut.mjs <sheet.png> <outDir>
 *
 * - background = near-white pixels connected to the border; parts = connected blobs (small specks dropped)
 * - weapon = the tallest upright thin blob in the right part; other weapon-like blobs are dropped
 * - an extra drawing in the bottom-right corner (a small reference figure) is dropped
 * - the 7 largest remaining blobs, by height on the sheet: the top 3 left→right are head, torso,
 *   skirt; the next 2 upper arm, forearm; the last 2 thigh, shin. Anything else (a reference
 *   figure, labels) is dropped.
 * Writes <outDir>/<name>.png trimmed, with a soft edge.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const [sheet, outDir] = process.argv.slice(2);
if (!sheet || !outDir) {
  console.error('usage: parts-cut.mjs <sheet.png> <outDir>');
  process.exit(1);
}
const img = PNG.sync.read(readFileSync(sheet));
const { width: W, height: H, data } = img;
const N = W * H;
const light = (i) => {
  const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
  return Math.min(r, g, b) > 232 && Math.max(r, g, b) - Math.min(r, g, b) < 18;
};
// background flood from the border
const bg = new Uint8Array(N);
const stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const i = stack.pop();
  if (bg[i] || !light(i)) continue;
  bg[i] = 1;
  const x = i % W, y = (i / W) | 0;
  if (x > 0) stack.push(i - 1);
  if (x < W - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - W);
  if (y < H - 1) stack.push(i + W);
}
// blobs (8-connected)
const label = new Int32Array(N).fill(-1);
const blobs = [];
for (let s = 0; s < N; s++) {
  if (bg[s] || label[s] >= 0) continue;
  const id = blobs.length;
  const b = { id, n: 0, x0: W, y0: H, x1: 0, y1: 0, sx: 0, sy: 0 };
  const st = [s];
  label[s] = id;
  while (st.length) {
    const i = st.pop();
    const x = i % W, y = (i / W) | 0;
    b.n++; b.sx += x; b.sy += y;
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
    if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (!bg[j] && label[j] < 0) { label[j] = id; st.push(j); }
    }
  }
  blobs.push(b);
}
const parts = blobs.filter((b) => b.n > 1500).map((b) => ({ ...b, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1, cx: b.sx / b.n, cy: b.sy / b.n }));
// weapons are drawn in the right column, upright: tall and thin. A second one (twin weapons) is dropped.
const thin = parts.filter((b) => b.cx > W * 0.55 && b.h >= 2 * b.w && b.h > H * 0.18).sort((a, b) => b.h - a.h);
// a wide weapon (crossbow): the biggest drawing in the middle of the right column
if (!thin.length) {
  const mid = parts.filter((b) => b.cx > W * 0.62 && b.cy > H * 0.36 && b.cy < H * 0.64).sort((a, b) => b.n - a.n);
  if (mid[0]) thin.push(mid[0]);
}
const weapon = thin[0];
if (!weapon) throw new Error('no weapon-like blob found');
let rest = parts.filter((b) => !thin.includes(b)).sort((a, b) => b.n - a.n).slice(0, 8);
// an 8th big drawing is the small reference figure in the bottom-right corner
if (rest.length === 8) {
  const ref = rest.reduce((m, b) => (b.cx + b.cy > m.cx + m.cy ? b : m));
  rest = rest.filter((b) => b !== ref);
}
if (rest.length < 7) throw new Error(`only ${rest.length} body parts found: ${parts.map((b) => `${b.w}x${b.h}@${Math.round(b.cx)},${Math.round(b.cy)}`).join(' ')}`);
rest.sort((a, b) => a.cy - b.cy);
const byX = (a, b) => a.cx - b.cx;
const [r1, r2, r3] = [rest.slice(0, 3).sort(byX), rest.slice(3, 5).sort(byX), rest.slice(5, 7).sort(byX)];
const named = { head: r1[0], torso: r1[1], skirt: r1[2], upper: r2[0], fore: r2[1], thigh: r3[0], shin: r3[1], weapon };

mkdirSync(outDir, { recursive: true });
for (const [name, b] of Object.entries(named)) {
  const o = new PNG({ width: b.w, height: b.h });
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const i = (b.y0 + y) * W + b.x0 + x;
    if (label[i] !== b.id) continue;
    const d = data.subarray(i * 4, i * 4 + 4);
    // soft edge: whitish pixels next to the background fade out
    const m = Math.min(d[0], d[1], d[2]);
    const edge = [-1, 1, -W, W].some((k) => bg[i + k]);
    const a = edge && m > 190 ? Math.max(0, Math.min(255, (255 - m) * 4)) : 255;
    o.data.set([d[0], d[1], d[2], a], (y * b.w + x) * 4);
  }
  writeFileSync(join(outDir, `${name}.png`), PNG.sync.write(o));
}
console.log(Object.entries(named).map(([k, b]) => `${k} ${b.w}×${b.h}`).join(', '));
