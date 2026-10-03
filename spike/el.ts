// Shared helper for spike scripts. Never prints the API key.
export const BASE = 'https://api.elevenlabs.io';
export async function el(method: string, path: string, body?: unknown, raw = false): Promise<any> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY missing');
  const r = await fetch(BASE + path, {
    method,
    headers: { 'xi-api-key': key, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return r;
  const t = await r.text();
  let j: any; try { j = JSON.parse(t); } catch { j = t; }
  if (!r.ok) { const e: any = new Error(`${method} ${path} -> ${r.status}: ${t.slice(0, 600)}`); e.status = r.status; e.body = j; throw e; }
  return j;
}
