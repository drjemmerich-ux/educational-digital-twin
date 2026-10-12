// Build: bundles the app with esbuild into
//   dist/app.js, dist/app.css      (multi-file build)
//   dist/index.html                (self-contained single file; open directly or host anywhere)
//   dist/artifact.html             (same app, body-only markup for a claude.ai Artifact)
// Usage: node scripts/build.mjs [--serve] [--port 5173]
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist');
mkdirSync(out, { recursive: true });

const TITLE = 'Lumbar Spine Patient Encounter';

async function bundle() {
  await build({
    entryPoints: [join(root, 'src/main.tsx')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    jsx: 'automatic',
    outfile: join(out, 'app.js'),
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'none',
    logLevel: 'warning',
  });
  const js = readFileSync(join(out, 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
  const css = readFileSync(join(root, 'src/styles/app.css'), 'utf8');
  writeFileSync(join(out, 'app.css'), css);
  const body = `<div id="root"></div>\n<noscript>This educational prototype requires JavaScript.</noscript>`;
  const meta = `<meta name="description" content="Educational Digital Twin prototype 1.5. Fictional synthetic case for formative education.">`;
  writeFileSync(
    join(out, 'index.html'),
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>${TITLE}</title>\n${meta}\n<style>\n${css}\n</style>\n</head>\n<body>\n${body}\n<script>\n${js}\n</script>\n</body>\n</html>\n`,
  );
  writeFileSync(join(out, 'artifact.html'), `<title>${TITLE}</title>\n<style>\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`);
  // Approved image frames live in public/assets and are referenced by manifest frame_paths.
  if (existsSync(join(root, 'public/assets'))) cpSync(join(root, 'public/assets'), join(out, 'assets'), { recursive: true });
  const kb = (f) => Math.round(readFileSync(join(out, f)).length / 1024);
  console.log(`built dist/index.html (${kb('index.html')} KB), dist/artifact.html (${kb('artifact.html')} KB)`);
}

await bundle();

if (process.argv.includes('--serve')) {
  const port = Number(process.argv[process.argv.indexOf('--port') + 1]) || 5173;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
  createServer((req, res) => {
    const path = req.url === '/' ? '/index.html' : decodeURIComponent((req.url ?? '/').split('?')[0]);
    try {
      const file = join(out, path);
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }).listen(port, () => console.log(`Serving http://localhost:${port}`));
}
