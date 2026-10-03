// ElevenLabs REST helper for the WP8 scripts. Never prints the API key. Node 24 native TS (no deps).
export const BASE = 'https://api.elevenlabs.io';
export async function el(method: string, path: string, body?: unknown): Promise<any> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY missing (dot-source scripts/env.ps1)');
  const init = { method, headers: { 'xi-api-key': key, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined };
  let r!: Response;
  for (let i = 0; ; i++) { // network blips (ECONNRESET): retry idempotent reads only
    try { r = await fetch(BASE + path, init); break; } catch (e) { if (method !== 'GET' || i >= 3) throw e; await sleep(1500 * (i + 1)); }
  }
  const t = await r.text();
  let j: any; try { j = JSON.parse(t); } catch { j = t; }
  if (!r.ok) { const e: any = new Error(`${method} ${path} -> ${r.status}: ${t.slice(0, 700)}`); e.status = r.status; e.body = j; throw e; }
  return j;
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
