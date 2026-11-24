#!/usr/bin/env node
/**
 * Generate an image with the Gemini API (key from .env.local: GEMINI_API_KEY=..., never committed).
 *
 *   node tools/gen-image.mjs --list                          image-capable models
 *   node tools/gen-image.mjs <out.png> <prompt.txt> [ref.png ...] [--model NAME] [--aspect 9:16]
 *
 * Reference pictures (style guides) are sent along with the prompt. The key is never printed.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.local');
const key = existsSync(envFile)
  ? readFileSync(envFile, 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*GEMINI_API_KEY\s*=\s*"?([^"\s]+)"?/)).find(Boolean)?.[1]
  : undefined;
if (!key) {
  console.error('GEMINI_API_KEY not found in .env.local');
  process.exit(1);
}
const API = 'https://generativelanguage.googleapis.com/v1beta';
const headers = { 'x-goog-api-key': key, 'content-type': 'application/json' };

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};

if (args[0] === '--list') {
  const res = await fetch(`${API}/models?pageSize=1000`, { headers });
  const data = await res.json();
  if (!res.ok) {
    console.error(res.status, data.error?.message);
    process.exit(1);
  }
  for (const m of data.models ?? []) {
    const name = m.name.replace('models/', '');
    if (/image|imagen/i.test(name)) console.log(name, '|', (m.supportedGenerationMethods ?? []).join(','));
  }
  process.exit(0);
}

const model = opt('--model') ?? 'gemini-2.5-flash-image';
const aspect = opt('--aspect');
const [out, promptFile, ...refs] = args;
if (!out || !promptFile) {
  console.error('usage: gen-image.mjs <out.png> <prompt.txt> [ref.png ...] [--model NAME] [--aspect 9:16]');
  process.exit(1);
}
const parts = [
  ...refs.map((f) => ({ inlineData: { mimeType: 'image/png', data: readFileSync(f).toString('base64') } })),
  { text: readFileSync(promptFile, 'utf8') },
];
const body = {
  contents: [{ role: 'user', parts }],
  generationConfig: { responseModalities: ['IMAGE'], ...(aspect ? { imageConfig: { aspectRatio: aspect } } : {}) },
};
const res = await fetch(`${API}/models/${model}:generateContent`, { method: 'POST', headers, body: JSON.stringify(body) });
const data = await res.json();
if (!res.ok) {
  console.error(res.status, data.error?.status, data.error?.message);
  process.exit(2);
}
const img = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
if (!img) {
  const txt = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join(' ');
  console.error('no image returned', data.candidates?.[0]?.finishReason ?? '', txt ?? JSON.stringify(data.promptFeedback ?? {}));
  process.exit(3);
}
writeFileSync(out, Buffer.from(img.data, 'base64'));
console.log(`${out} (${model}${aspect ? `, ${aspect}` : ''}) tokens: ${JSON.stringify(data.usageMetadata?.totalTokenCount ?? '?')}`);
