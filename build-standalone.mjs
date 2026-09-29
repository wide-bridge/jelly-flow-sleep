import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { tracks } from './dist/tracks.js';

const root = dirname(fileURLToPath(import.meta.url));
const read = name => readFileSync(resolve(root, 'dist', name), 'utf8').replace(/^\uFEFF/, '');
const bundledTracks = tracks.map(track => ({
  ...track,
  src: `data:audio/mpeg;base64,${readFileSync(resolve(root, 'dist', track.src)).toString('base64')}`
}));
const css = read('style.css')
  .replace(/^@import\s+url\([^\n]+\);\s*/m, '')
  .replace("'DM Sans','Noto Sans KR',sans-serif", "'DM Sans','Noto Sans KR','맑은 고딕','Malgun Gothic',system-ui,sans-serif");
const routines = read('routineContent.js').replace(/^export /gm, '');
const app = read('app.js').replace(/^import[^\n]+\n/gm, '');
// A classic inline script has no module fetch or file:// CORS dependency.
const script = `(() => {\n'use strict';\nconst tracks = ${JSON.stringify(bundledTracks)};\n${routines}\n${app}\n})();`;
const html = read('index.html')
  .replace('<link rel="stylesheet" href="./style.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="./app.js"></script>', () => `<script>\n${script.replace(/<\/script/gi, '<\\/script')}\n</script>`);
if (/<script[^>]+src=|<link[^>]+rel="stylesheet"|^@import\b/m.test(html)) {
  throw new Error('External runtime dependency remains in the bundle');
}
mkdirSync(resolve(root, 'standalone'), { recursive:true });
const target = resolve(root, 'standalone/Jelly-flow.html');
writeFileSync(target, html.trimEnd() + '\n', 'utf8');
console.log(`Created: ${target}`);
console.log(`Size: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB; embedded tracks: ${tracks.length}`);
