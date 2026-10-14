// Build.
//   node scripts/build.mjs            Local build: the engine runs in the browser.
//                                     dist/index.html (self-contained), dist/artifact.html, dist/app.js, dist/app.css
//   node scripts/build.mjs --web      Pilot build: the engine runs on the server.
//                                     dist-web/index.html (participant, personal link), dist-web/facilitator.html
//                                     Fails if any hidden case string reaches the participant bundle.
//   --serve [--port 5173]             Serve the chosen output directory.
// The pilot API endpoint comes from deploy/web-config.json, or EDT_API_URL / EDT_API_KEY when set.
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const web = process.argv.includes('--web');
const out = join(root, web ? 'dist-web' : 'dist');
mkdirSync(out, { recursive: true });

const TITLE = 'Lumbar Spine Patient Encounter';
const css = readFileSync(join(root, 'src/styles/app.css'), 'utf8');

async function bundleJs(entry, define = {}) {
  const r = await build({
    entryPoints: [join(root, entry)],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    jsx: 'automatic',
    write: false,
    define: { 'process.env.NODE_ENV': '"production"', ...define },
    legalComments: 'none',
    logLevel: 'warning',
  });
  return r.outputFiles[0].text;
}

function page(title, description, js) {
  const body = `<div id="root"></div>\n<noscript>This educational prototype requires JavaScript.</noscript>`;
  const safe = js.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="referrer" content="no-referrer">\n<title>${title}</title>\n<meta name="description" content="${description}">\n<style>\n${css}\n</style>\n</head>\n<body>\n${body}\n<script>\n${safe}\n</script>\n</body>\n</html>\n`;
}

const kb = (f) => Math.round(readFileSync(join(out, f)).length / 1024);

/**
 * Every string literal of 24+ characters in the hidden case content must be absent from a participant bundle.
 * PUBLIC_DUPLICATES are labels that the hidden content shares with public interface copy
 * (investigation titles, stage names, action options, placeholder notices). They reveal no finding.
 */
const PUBLIC_DUPLICATES = new Set([
  'Routine laboratory panel',
  'Intraoperative checkpoint',
  'Synthetic operative illustration pending production.',
  'New postoperative findings',
  'Short monitored period of recumbency and wound observation',
  'Early operative re-exploration and reinforced repair',
]);
function assertNoHiddenContent(name, js) {
  const src = readFileSync(join(root, 'src/case/caseContent.ts'), 'utf8');
  const literals = [...src.matchAll(/'((?:[^'\\\n]|\\.){24,})'|`([^`$]{24,})`/g)].map((m) => (m[1] ?? m[2]).replace(/\\'/g, "'"));
  const leaked = literals.filter((l) => js.includes(l) && !PUBLIC_DUPLICATES.has(l));
  if (leaked.length) {
    console.error(`${name}: ${leaked.length} hidden case strings found in the participant bundle, for example:\n  ${leaked.slice(0, 20).join('\n  ')}`);
    process.exit(1);
  }
  console.log(`${name}: checked ${literals.length} hidden case strings; none present`);
}

async function buildLocal() {
  const js = await bundleJs('src/main.tsx');
  writeFileSync(join(out, 'app.js'), js);
  writeFileSync(join(out, 'app.css'), css);
  writeFileSync(join(out, 'index.html'), page(TITLE, 'Educational Digital Twin prototype. Fictional synthetic case for formative education.', js));
  const body = `<div id="root"></div>\n<noscript>This educational prototype requires JavaScript.</noscript>`;
  writeFileSync(join(out, 'artifact.html'), `<title>${TITLE}</title>\n<style>\n${css}\n</style>\n${body}\n<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>\n`);
  console.log(`built dist/index.html (${kb('index.html')} KB), dist/artifact.html (${kb('artifact.html')} KB)`);
}

async function buildWeb() {
  const cfg = JSON.parse(readFileSync(join(root, 'deploy/web-config.json'), 'utf8'));
  const apiUrl = process.env.EDT_API_URL ?? cfg.apiUrl;
  const apiKey = process.env.EDT_API_KEY ?? (process.env.EDT_API_URL ? '' : cfg.apiKey);
  const define = { __EDT_API_URL__: JSON.stringify(apiUrl), __EDT_API_KEY__: JSON.stringify(apiKey) };
  const participant = await bundleJs('src/mainRemote.tsx', define);
  const facilitator = await bundleJs('src/facilitator/main.tsx', define);
  assertNoHiddenContent('participant bundle', participant);
  assertNoHiddenContent('facilitator bundle', facilitator);
  writeFileSync(join(out, 'index.html'), page(TITLE, 'Educational Digital Twin pilot. Fictional synthetic case for formative education.', participant));
  writeFileSync(join(out, 'facilitator.html'), page('Facilitator · Educational Digital Twin', 'Facilitator view of the Educational Digital Twin pilot.', facilitator));
  console.log(`built dist-web/index.html (${kb('index.html')} KB), dist-web/facilitator.html (${kb('facilitator.html')} KB) → API ${apiUrl}`);
}

if (web) await buildWeb();
else await buildLocal();
// Approved image frames live in public/assets and are referenced by manifest frame_paths.
if (existsSync(join(root, 'public/assets'))) cpSync(join(root, 'public/assets'), join(out, 'assets'), { recursive: true });

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
