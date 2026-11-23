#!/usr/bin/env node
/**
 * Cut a character sheet (white background, poses laid out on a grid) into transparent PNGs.
 *
 *   node tools/cut-sheet.mjs <sheet.png> <outDir> [--grid CxR] [--max N | --scale K] <name>...
 *
 *   names are read left→right, top→bottom; add ":flip" to mirror one (e.g. a frame facing left).
 *   e.g. node tools/cut-sheet.mjs assets/raw/liubei-sheet.png public/art/liubei attack ult idle portrait
 *        node tools/cut-sheet.mjs assets/raw/liubei-run.png public/art/liubei --grid 2x1 --scale 0.52 run1 run2:flip
 *
 * - Background = near-white, low-saturation pixels connected to the border, plus large
 *   enclosed white holes (e.g. between an arm and the body).
 * - Each drawn blob goes to the grid cell its centre is in, so effects that cross a cell
 *   line (sword swooshes, petals) stay with their pose.
 * - Edge pixels get partial alpha with the white fringe removed.
 * - The feet position (centre of the bottom quarter, as a 0–1 ratio of the width) is merged into
 *   <outDir>/anchors.json so the game can stand every pose on the same spot despite slash effects.
 * - Output is trimmed, then every pose of the sheet is scaled by the SAME factor (macOS `sips`):
 *   --max N fits the largest pose in N px (default 360); --scale K sets the factor directly,
 *   which is how separate sheets of one character are matched to the same size.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
const opt = (flag) => {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  const [v] = args.splice(i, 2).slice(1);
  return v;
};
const [cols, rows] = (opt('--grid') ?? '2x2').split('x').map(Number);
const maxSize = Number(opt('--max') ?? 360);
const scaleArg = opt('--scale');
const fixedScale = scaleArg ? Number(scaleArg) : undefined;
const [src, outDir, ...names] = args;
if (!src || !outDir || names.length !== cols * rows) {
  console.error('usage: cut-sheet.mjs <sheet.png> <outDir> [--grid CxR] [--max N | --scale K] <name>... (one per cell)');
  process.exit(1);
}

const png = PNG.sync.read(readFileSync(src));
const { width: w, height: h, data } = png;
const N = w * h;
const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
const whiteish = (i) => {
  const [r, g, b] = px(i);
  return Math.min(r, g, b) >= 222 && Math.max(r, g, b) - Math.min(r, g, b) <= 20;
};

/** 0 = foreground, 1 = background */
const bg = new Uint8Array(N);
const neighbours4 = (i) => {
  const x = i % w;
  const out = [];
  if (x > 0) out.push(i - 1);
  if (x < w - 1) out.push(i + 1);
  if (i >= w) out.push(i - w);
  if (i < N - w) out.push(i + w);
  return out;
};

function flood(seeds, accept, mark) {
  const stack = [...seeds];
  const seen = [];
  while (stack.length) {
    const i = stack.pop();
    if (mark[i] || !accept(i)) continue;
    mark[i] = 1;
    seen.push(i);
    for (const n of neighbours4(i)) if (!mark[n]) stack.push(n);
  }
  return seen;
}

// 1) white connected to the border
const border = [];
for (let x = 0; x < w; x++) border.push(x, N - w + x);
for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
flood(border, whiteish, bg);

// 2) large enclosed white holes
const visited = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  if (bg[i] || visited[i] || !whiteish(i)) continue;
  const region = flood([i], (j) => !bg[j] && whiteish(j), visited);
  if (region.length > 400) for (const j of region) bg[j] = 1;
}

// 3) foreground blobs → quadrants
const label = new Int32Array(N).fill(-1);
const boxes = [];
for (let i = 0; i < N; i++) {
  if (bg[i] || label[i] >= 0) continue;
  const id = boxes.length;
  const box = { x0: w, y0: h, x1: 0, y1: 0, n: 0 };
  const stack = [i];
  label[i] = id;
  while (stack.length) {
    const j = stack.pop();
    const x = j % w;
    const y = (j - x) / w;
    box.n++;
    box.x0 = Math.min(box.x0, x);
    box.y0 = Math.min(box.y0, y);
    box.x1 = Math.max(box.x1, x);
    box.y1 = Math.max(box.y1, y);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (!bg[k] && label[k] < 0) {
          label[k] = id;
          stack.push(k);
        }
      }
  }
  boxes.push(box);
}
const quadOf = (b) =>
  Math.min(rows - 1, Math.floor(((b.y0 + b.y1) / 2 / h) * rows)) * cols + Math.min(cols - 1, Math.floor(((b.x0 + b.x1) / 2 / w) * cols));
const keep = boxes.map((b) => b.n >= 40);

mkdirSync(outDir, { recursive: true });
const written = [];
const anchorFile = join(outDir, 'anchors.json');
const anchors = existsSync(anchorFile) ? JSON.parse(readFileSync(anchorFile, 'utf8')) : {};
names.forEach((spec, q) => {
  const [name, mod] = spec.split(':');
  const mine = boxes.map((b, id) => keep[id] && quadOf(b) === q);
  const parts = boxes.filter((_, id) => mine[id]);
  if (!parts.length) return console.warn(`${name}: nothing found`);
  const pad = 4;
  const x0 = Math.max(0, Math.min(...parts.map((b) => b.x0)) - pad);
  const y0 = Math.max(0, Math.min(...parts.map((b) => b.y0)) - pad);
  const x1 = Math.min(w - 1, Math.max(...parts.map((b) => b.x1)) + pad);
  const y1 = Math.min(h - 1, Math.max(...parts.map((b) => b.y1)) + pad);
  const out = new PNG({ width: x1 - x0 + 1, height: y1 - y0 + 1 });
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      const ox = mod === 'flip' ? x1 - x : x - x0;
      const o = ((y - y0) * out.width + ox) * 4;
      if (bg[i] || label[i] < 0 || !mine[label[i]]) {
        out.data[o + 3] = 0;
        continue;
      }
      let [r, g, b] = px(i);
      let a = 1;
      const edge = neighbours4(i).some((n) => bg[n]);
      if (edge) {
        // soften the anti-aliased fringe: the closer to white, the more transparent
        a = Math.min(1, Math.max(0.15, (255 - Math.min(r, g, b)) / 70));
        const un = (c) => Math.max(0, Math.min(255, Math.round((c - 255 * (1 - a)) / a)));
        [r, g, b] = [un(r), un(g), un(b)];
      }
      out.data[o] = r;
      out.data[o + 1] = g;
      out.data[o + 2] = b;
      out.data[o + 3] = Math.round(a * 255);
    }
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, PNG.sync.write(out));
  // feet: mean x of solid pixels in the bottom quarter
  let sx = 0;
  let cnt = 0;
  for (let y = Math.floor(out.height * 0.75); y < out.height; y++)
    for (let x = 0; x < out.width; x++)
      if (out.data[(y * out.width + x) * 4 + 3] > 128) {
        sx += x;
        cnt++;
      }
  anchors[name] = cnt ? Math.round((sx / cnt / out.width) * 1000) / 1000 : 0.5;
  written.push({ file, w: out.width, h: out.height });
});
const k = fixedScale ?? Math.min(1, maxSize / Math.max(...written.map((o) => Math.max(o.w, o.h))));
for (const o of written) {
  const [nw, nh] = [Math.round(o.w * k), Math.round(o.h * k)];
  execFileSync('sips', ['-z', String(nh), String(nw), o.file], { stdio: 'ignore' });
  console.log(`${o.file}  ${o.w}×${o.h} → ${nw}×${nh}`);
}
writeFileSync(anchorFile, JSON.stringify(anchors, null, 2) + '\n');
