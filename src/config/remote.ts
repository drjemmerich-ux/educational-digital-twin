// Server endpoint for the pilot build. Injected at build time from deploy/web-config.json
// (or the EDT_API_URL environment variable for local development). Both values are public.
declare const __EDT_API_URL__: string;
declare const __EDT_API_KEY__: string;

export const REMOTE_API_URL: string = typeof __EDT_API_URL__ === 'string' ? __EDT_API_URL__ : '';
export const REMOTE_API_KEY: string = typeof __EDT_API_KEY__ === 'string' ? __EDT_API_KEY__ : '';

export function apiHeaders(): Record<string, string> {
  return REMOTE_API_KEY ? { apikey: REMOTE_API_KEY } : {};
}
