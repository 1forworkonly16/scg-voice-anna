// Shared helpers for the WP8 agent-as-code scripts (gen-tools, build-agent, check-agent, link, el/tests).
// No secret value is ever printed or written to a file.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { el } from './api.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const EL_DIR = resolve(ROOT, 'elevenlabs');
export const p = (...s: string[]) => resolve(ROOT, ...s);
export const readJson = (f: string): any => JSON.parse(readFileSync(f, 'utf8'));
export const writeJson = (f: string, o: unknown) => writeFileSync(f, JSON.stringify(o, null, 2) + '\n', 'utf8');
export const readText = (f: string) => readFileSync(f, 'utf8');
export const cfg = () => readJson(p('elevenlabs', 'agent_config.json'));
export const TALK_TO = (id: string) => `https://elevenlabs.io/app/talk-to?agent_id=${id}`;

/** State file elevenlabs/agents.json: ids only, no secrets. */
export function readAgents(): { agents: Record<string, any> } {
  const f = p('elevenlabs', 'agents.json');
  return existsSync(f) ? readJson(f) : { agents: {} };
}
export function agentId(name = 'scg-anna'): string {
  const id = readAgents().agents[name]?.agent_id;
  if (!id) throw new Error(`no agent_id for ${name} in elevenlabs/agents.json (run build-agent first)`);
  return id;
}

/** Loads src/contract/elevenlabs.ts (zod, single source) by bundling it with esbuild into memory (node cannot import it directly). */
export async function loadContract(): Promise<{ toElevenLabsTool: (n: string, o?: { baseUrl?: string; secretId?: string }) => any; TOOL_NAMES: string[]; TOOLS: Record<string, any> }> {
  const { build } = await import('esbuild');
  const r = await build({ entryPoints: [p('src', 'contract', 'index.ts')], bundle: true, write: false, format: 'esm', platform: 'node', target: 'node24', logLevel: 'silent' });
  const code = r.outputFiles[0]!.text;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

/** Pushes a Worker secret through `wrangler secret put` with the value on STDIN (never on a command line, never printed). */
export function putWorkerSecret(name: string, value: string): void {
  const wrangler = p('node_modules', 'wrangler', 'bin', 'wrangler.js');
  const r = spawnSync(process.execPath, [wrangler, 'secret', 'put', name], { cwd: ROOT, env: process.env, input: value, encoding: 'utf8' });
  if (r.status !== 0) {
    const why = (r.stderr || r.stdout || '').split(/\r?\n/).filter((l) => l.trim()).slice(-2).join(' | ').replaceAll(value, '***').slice(0, 300);
    throw new Error(`wrangler secret put ${name} failed: ${why}`);
  }
}

/** Persists to the Windows USER environment (value travels in the child env, not on a command line). Best effort. */
export function persistUserEnv(name: string, value: string): boolean {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `[Environment]::SetEnvironmentVariable('${name}', $env:SCG_PERSIST_VALUE, 'User')`], { env: { ...process.env, SCG_PERSIST_VALUE: value }, encoding: 'utf8' });
  return r.status === 0;
}

export async function listAllTools(): Promise<any[]> {
  const out: any[] = []; let cursor: string | null = null;
  do {
    const j: any = await el('GET', `/v1/convai/tools?page_size=100${cursor ? '&cursor=' + cursor : ''}`);
    out.push(...(j.tools ?? [])); cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return out;
}

/** Workspace secret holding SCG_TOOL_KEY. Created (type new) or updated in place; the value is read from the env and never printed. */
export async function ensureToolSecret(name: string): Promise<string> {
  const v = (process.env.SCG_TOOL_KEY ?? '').trim();
  if (!v) throw new Error('SCG_TOOL_KEY missing in env (dot-source scripts/env.ps1)');
  const list = await el('GET', '/v1/convai/secrets');
  const hit = (list.secrets ?? []).find((s: any) => s.name === name);
  if (hit) { await el('PATCH', `/v1/convai/secrets/${hit.secret_id}`, { type: 'update', name, value: v }); return hit.secret_id; }
  const c = await el('POST', '/v1/convai/secrets', { type: 'new', name, value: v });
  return c.secret_id;
}
