import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

await rm('docs', { recursive: true, force: true });
await mkdir('docs', { recursive: true });
await cp('public', 'docs', { recursive: true });
await writeFile('docs/.nojekyll', '');
await writeFile('docs/env.js', "window.APP_ENV = { preferredMode: 'direct' };\n");
const index = await readFile('docs/index.html', 'utf8');
await writeFile('docs/404.html', index);
console.log('Synced public/ to docs/ for GitHub Pages');
