#!/usr/bin/env node
/**
 * Refill white areas that tools/cut-sheet.mjs wrongly cut out as "enclosed background holes"
 * (eye whites, teeth, blade shine, banners): every enclosed transparent region containing one of
 * the given points becomes opaque white again, and its soft edge is blended over white.
 *
 *   node tools/fill-holes.mjs <file.png> x,y [x,y ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [file, ...pts] = process.argv.slice(2);
const im = PNG.sync.read(readFileSync(file));
const { width: w, height: h, data: d } = im;
const tr = (i) => d[i * 4 + 3] < 40;
const mark = new Uint8Array(w * h);
let total = 0;
for (const p of pts) {
  const [x, y] = p.split(',').map(Number);
  // nearest transparent pixel to the point (the point may sit on an edge)
  let seed = -1;
  for (let r = 0; r < 6 && seed < 0; r++)
    for (let dy = -r; dy <= r && seed < 0; dy++)
      for (let dx = -r; dx <= r && seed < 0; dx++) {
        const i = (y + dy) * w + (x + dx);
        if (i >= 0 && i < w * h && tr(i) && !mark[i]) seed = i;
      }
  if (seed < 0) {
    console.log(`${p}: no hole here`);
    continue;
  }
  const st = [seed];
  mark[seed] = 1;
  let n = 0;
  let edge = false;
  const region = [];
  while (st.length) {
    const q = st.pop();
    region.push(q);
    n++;
    const qx = q % w;
    const qy = (q / w) | 0;
    if (qx === 0 || qy === 0 || qx === w - 1 || qy === h - 1) edge = true;
    for (const r of [q - 1, q + 1, q - w, q + w]) if (r >= 0 && r < w * h && !mark[r] && tr(r) && Math.abs((r % w) - qx) <= 1) { mark[r] = 1; st.push(r); }
  }
  if (edge) {
    console.log(`${p}: region touches the border (outside, not a hole) — skipped`);
    continue;
  }
  for (const q of region) d.set([255, 255, 255, 255], q * 4);
  // soften: partly transparent pixels next to the hole are composited over white
  for (const q of region) {
    const qx = q % w;
    const qy = (q / w) | 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const x2 = qx + dx;
        const y2 = qy + dy;
        if (x2 < 0 || y2 < 0 || x2 >= w || y2 >= h) continue;
        const k = (y2 * w + x2) * 4;
        const a = d[k + 3] / 255;
        if (a >= 1) continue;
        for (let c = 0; c < 3; c++) d[k + c] = Math.round(d[k + c] * a + 255 * (1 - a));
        d[k + 3] = 255;
      }
  }
  total += n;
  console.log(`${p}: filled ${n}px`);
}
writeFileSync(file, PNG.sync.write(im));
console.log(`${file.replace(/.*public\//, '')}: ${total}px refilled`);
