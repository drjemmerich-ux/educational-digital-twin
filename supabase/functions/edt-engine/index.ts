// edt-engine: the server case engine for the Educational Digital Twin pilot.
// engine.js is generated from src/ by `npm run build:edge`; do not edit it by hand.
// Authentication is by personal-link token or facilitator key inside the request body, so the
// function is deployed without Supabase JWT verification.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { CURRENT_VERSIONS, MAX_REQUEST_BYTES, SupabaseStore, defaultIds, handleApi } from './engine.js';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const store = new SupabaseStore(createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }));

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method === 'GET') return json({ ok: true, data: { service: 'edt-engine', versions: CURRENT_VERSIONS } });
  if (req.method !== 'POST') return json({ ok: false, code: 'BAD_REQUEST', message: 'POST only.' }, 405);
  const text = await req.text();
  if (text.length > MAX_REQUEST_BYTES) return json({ ok: false, code: 'TOO_LARGE', message: 'This entry is too long to save.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, code: 'BAD_REQUEST', message: 'Malformed request.' }, 400);
  }
  const res = await handleApi(body, {
    store,
    ids: defaultIds,
    randomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
    log: (message: string, detail?: unknown) => console.error(message, detail instanceof Error ? detail.message : detail),
  });
  return json(res);
});
