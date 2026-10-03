// Voice-minute and $ meter for ElevenLabs Agents (Node 24 native TS, no deps).
//   node scripts/el/usage.ts [--since 2026-10-03] [--agent-prefix scg|all] [--agent-ids id1,id2] [--log WP4] [--wp-min N --wp-usd X]
// Lists conversations since the date (UTC midnight), fetches each conversation's metadata for
// call_duration_secs + charging.llm_price (LLM $) + cost_fiat (total $ incl. voice minutes),
// prints totals per agent name and overall. With --log <WP> appends ONE row to docs/usage_log.md
// (minutes/$ for that WP = totals minus the cumulative of the previous log rows). Never prints the key.
import { readFileSync, appendFileSync } from 'node:fs';
const KEY = process.env.ELEVENLABS_API_KEY; if (!KEY) throw new Error('ELEVENLABS_API_KEY missing');
const a = new Map<string, string>(); for (let i = 2; i < process.argv.length; i += 2) a.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const since = a.get('since') ?? '2026-10-03';
const sinceSecs = Math.floor(Date.parse(since + 'T00:00:00Z') / 1000);
const get = async (p: string) => { const r = await fetch('https://api.elevenlabs.io' + p, { headers: { 'xi-api-key': KEY! } }); if (!r.ok) throw new Error(`${p} -> ${r.status}`); return r.json() as Promise<any>; };

const convs: any[] = []; let cursor: string | null = null;
do {
  const j: any = await get(`/v1/convai/conversations?page_size=100&call_start_after_unix=${sinceSecs}${cursor ? '&cursor=' + cursor : ''}`);
  convs.push(...j.conversations); cursor = j.has_more ? j.next_cursor : null;
} while (cursor);

// Filter: only agents whose name starts with --agent-prefix (case-insensitive, default "scg"; pass "" or "all" for no filter)
// or whose id is in --agent-ids a,b. The unfiltered totals are printed too, for comparison. The logged row uses the FILTERED totals.
const prefixArg = a.get('agent-prefix') ?? 'scg';
const prefix = prefixArg === 'all' ? '' : prefixArg.toLowerCase();
const ids = new Set((a.get('agent-ids') ?? '').split(',').filter(Boolean));
const mine = (c: any) => prefix === '' && ids.size === 0 ? true : (prefix !== '' && String(c.agent_name ?? '').toLowerCase().startsWith(prefix)) || ids.has(c.agent_id);
const per: Record<string, { n: number; secs: number; llm: number; total: number; mine: boolean }> = {};
let secs = 0, llm = 0, total = 0, nMine = 0, secsAll = 0, llmAll = 0, totalAll = 0;
for (const c of convs) {
  let d: any; try { d = await get(`/v1/convai/conversations/${c.conversation_id}`); } catch { continue; } // conversation of a deleted agent (404): not countable
  const m = d.metadata ?? {};
  const s = m.call_duration_secs ?? c.call_duration_secs ?? 0, l = m.charging?.llm_price ?? 0, t = m.cost_fiat ?? 0;
  const k = c.agent_name ?? c.agent_id; (per[k] ??= { n: 0, secs: 0, llm: 0, total: 0, mine: mine(c) });
  per[k].n++; per[k].secs += s; per[k].llm += l; per[k].total += t; secsAll += s; llmAll += l; totalAll += t;
  if (mine(c)) { secs += s; llm += l; total += t; nMine++; }
}
const fmt = (x: number) => +x.toFixed(4);
console.log(JSON.stringify({ since, filter: prefixArg === 'all' ? 'none' : { agent_prefix: prefix, agent_ids: [...ids] },
  filtered: { conversations: nMine, voice_minutes: fmt(secs / 60), llm_usd: fmt(llm), total_usd_fiat: fmt(total) },
  unfiltered_all_agents: { conversations: convs.length, voice_minutes: fmt(secsAll / 60), llm_usd: fmt(llmAll), total_usd_fiat: fmt(totalAll) },
  note: 'voice_minutes = sum call_duration_secs; total_usd_fiat = metadata.cost_fiat (voice minutes at plan rate + LLM); on Creator the minutes are drawn from the plan allowance (credits), not billed in $ unless over',
  per_agent: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, { counted: v.mine, n: v.n, min: fmt(v.secs / 60), llm_usd: fmt(v.llm), total_usd: fmt(v.total) }])) }, null, 1));
if (+(secs / 60) >= 80) console.log('WARNING: >= 80 voice minutes, warn the orchestrator');

const wp = a.get('log');
if (wp) {
  // NOTE: deleting an agent also removes its conversations from the API, so the API total can shrink.
  // Each logged row therefore stores the API total at that moment ("api=min:X,usd:Y"); the next row's delta is
  // (API total now - API total at the last row). A row without the marker counts as API total 0
  // (the WP4 spike agents were deleted after logging). Run --log BEFORE deleting throwaway agents.
  const log = readFileSync('docs/usage_log.md', 'utf8');
  const rows = log.split('\n').filter((l) => /^\| \d{4}-\d\d-\d\d \|/.test(l));
  const last = rows[rows.length - 1]?.split('|').map((x) => x.trim());
  const prevMin = last ? Number(last[5]) || 0 : 0, prevUsd = last ? Number(last[6]) || 0 : 0;
  const mk = /api=min:([\d.]+),usd:([\d.]+)/.exec(last?.[7] ?? '');
  const baseMin = mk ? Number(mk[1]) : 0, baseUsd = mk ? Number(mk[2]) : 0;
  const apiMin = fmt(secs / 60), apiUsd = fmt(llm);
  const wpMin = a.has('wp-min') ? Number(a.get('wp-min')) : fmt(Math.max(0, apiMin - baseMin));
  const wpUsd = a.has('wp-usd') ? Number(a.get('wp-usd')) : fmt(Math.max(0, apiUsd - baseUsd));
  const cumMin = fmt(prevMin + wpMin), cumUsd = fmt(prevUsd + wpUsd);
  appendFileSync('docs/usage_log.md', `| ${new Date().toISOString().slice(0, 10)} | ${wp} | ${wpMin} | ${wpUsd} | ${cumMin} | ${cumUsd} | api=min:${apiMin},usd:${apiUsd}; ${nMine} convs since ${since}; text $ = LLM $ only (voice minutes are plan allowance) |\n`);
  console.log(`appended row for ${wp}`);
}
