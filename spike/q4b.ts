import { el } from './el.ts';
import { writeFileSync, readFileSync } from 'node:fs';
const out: any = {};
const id = 'agent_7401m40a6hdjfa4vn78g1g76mdr8';
const b = await el('GET', `/v1/convai/agents/${id}/branches`);
out.branches = b.results.map((x: any) => ({ id: x.id, name: x.name, current_live_percentage: x.current_live_percentage, draft_exists: x.draft_exists, protection_status: x.protection_status, calls_7d: x.calls_7d }));
const bd = await el('GET', `/v1/convai/agents/${id}/branches/${b.results[0].id}`);
out.versions_on_main = bd.most_recent_versions.map((v: any) => ({ id: v.id, seq: v.seq_no_in_branch, desc: v.version_description, t: v.time_committed_secs }));
out.agent_tip_version_id = (await el('GET', `/v1/convai/agents/${id}`)).version_id;
// conversation version ids vs PATCH versions
const q5 = JSON.parse(readFileSync('spike/q5_server_metrics.json', 'utf8'));
out.conversation_versions = {};
for (const [k, v] of Object.entries<any>(q5)) for (const cid of v.convs) { const c = await el('GET', `/v1/convai/conversations/${cid}`); out.conversation_versions[`${k}:${cid}`] = { version_id: c.version_id, branch_id: c.branch_id }; }
for (const [lab, cid] of [['langswitch_v3_A (before PATCH)', 'conv_9501m40a8xmwe8v9ymycgr3apwn7'], ['langswitch_v3_B (after PATCH, no publish)', 'conv_9401m40acdrgechtfv4kvsvhyq97']]) { const c = await el('GET', `/v1/convai/conversations/${cid}`); out.conversation_versions[lab] = { version_id: c.version_id, branch_id: c.branch_id }; }
const lat = await el('GET', `/v1/convai/agents/agent_6401m40awh39fbxty2b7zd9z0pam/branches`);
out.lat_opus_agent_live = lat.results.map((x: any) => ({ live: x.current_live_percentage }));
writeFileSync('spike/q4b_versions_live.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
