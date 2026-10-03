import { el } from './el.ts';
import { writeFileSync } from 'node:fs';
const l: any = await el('GET', '/v1/convai/agents?page_size=100');
const mine = l.agents.filter((a: any) => a.name.startsWith('scg-spike-'));
const del: any[] = [];
for (const a of mine) { const r: any = await el('DELETE', `/v1/convai/agents/${a.agent_id}`, undefined, true); del.push({ name: a.name, id: a.agent_id, status: r.status }); }
const after: any = await el('GET', '/v1/convai/agents?page_size=100');
const out = { deleted: del, remaining_agents: after.agents.map((a: any) => ({ name: a.name, id: a.agent_id })), remaining_scg_spike: after.agents.filter((a: any) => a.name.startsWith('scg-spike-')).length };
writeFileSync('spike/cleanup_proof.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
