// Local pilot server for development and browser tests: serves dist-web/ and answers /api with the
// same handler the Edge Function uses, backed by an in-memory store.
// Usage: EDT_API_URL=/api node scripts/build.mjs --web && node --import tsx scripts/dev-server.ts [port]
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { randomBytes } from 'node:crypto';
import { handleApi } from '../src/server/handler.ts';
import { MemoryStore } from '../src/server/memoryStore.ts';
import { MAX_REQUEST_BYTES, sha256Hex } from '../src/server/api.ts';
import { defaultIds } from '../src/session/controller.ts';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist-web');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

export async function startDevServer(port = 0, facilitatorKey = 'fk_local_dev_key'): Promise<{ url: string; store: MemoryStore; server: Server; facilitatorKey: string }> {
  const store = new MemoryStore();
  store.facilitatorHashes.add(await sha256Hex(facilitatorKey));
  const deps = { store, ids: defaultIds, randomBytes: (n: number) => new Uint8Array(randomBytes(n)) };
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]!.split('#')[0]!);
    if (path === '/api') {
      if (req.method !== 'POST') {
        res.writeHead(405).end();
        return;
      }
      let body = '';
      req.on('data', (c: Buffer) => {
        body += c.toString('utf8');
        if (body.length > MAX_REQUEST_BYTES) req.destroy();
      });
      req.on('end', async () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, code: 'BAD_REQUEST', message: 'Malformed request.' }));
          return;
        }
        const out = await handleApi(parsed, deps);
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out));
      });
      return;
    }
    const file = normalize(join(dist, path === '/' ? 'index.html' : path === '/facilitator' ? 'facilitator.html' : path));
    if (!file.startsWith(dist)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const data = readFileSync(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(data);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', () => r()));
  const addr = server.address();
  const actual = typeof addr === 'object' && addr ? addr.port : port;
  return { url: `http://127.0.0.1:${actual}`, store, server, facilitatorKey };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const port = Number(process.argv[2]) || 5174;
  const s = await startDevServer(port);
  console.log(`Pilot dev server on ${s.url}  ·  facilitator: ${s.url}/facilitator.html  ·  key: ${s.facilitatorKey}`);
}
